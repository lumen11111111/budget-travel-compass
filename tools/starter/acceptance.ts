import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";

import { projectRoot, readJsoncFile, runCommand, stripJsonComments } from "./cli-utils";
import { createControlledAdapter } from "./cloudflare-adapter";
import { parseAdapterMode, parseRemoteExecutionArgs, type CloudflareAdapterMode } from "./cloudflare-execution";
import { runControlledCloudflareWorkflow } from "./cloudflare-workflows";
import { resolveBootstrapConfig } from "./production-bootstrap";

export type AcceptanceCheckStatus = "pass" | "warn" | "action-required" | "fail" | "skip";
export type AcceptanceCheckCategory =
  | "project"
  | "code-quality"
  | "build"
  | "framework"
  | "production"
  | "seo"
  | "security"
  | "routes"
  | "browser"
  | "responsive"
  | "content";
export type AcceptanceFinalVerdict = "passed" | "passed-with-warnings" | "blocked" | "failed";
export type AcceptanceMode = "quick" | "full";
export type ProjectMode = "framework" | "instance";

export type AcceptanceCheck = {
  id: string;
  title: string;
  category: AcceptanceCheckCategory;
  required: boolean;
  status: AcceptanceCheckStatus;
  durationMs: number;
  command?: string;
  summary: string;
  details: string[];
  evidence: string[];
  suggestedAction?: string;
};

export type AcceptanceOptions = {
  mode: AcceptanceMode;
  production: boolean;
  offline: boolean;
  remote: boolean;
  adapterMode: CloudflareAdapterMode;
  accountId: string;
  skipBrowser: boolean;
  baseUrl?: string;
  report: "both" | "json" | "markdown";
  only: Set<AcceptanceCheckCategory>;
  continueOnFailure: boolean;
};

export type AcceptanceReport = {
  frameworkVersion: string;
  siteName: string;
  mode: ProjectMode;
  acceptanceMode: AcceptanceMode;
  production: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  gitCommit: string;
  baseUrl: string | null;
  viewportList: Array<{ width: number; height: number }>;
  summary: Record<AcceptanceCheckStatus, number>;
  checks: AcceptanceCheck[];
  failures: AcceptanceCheck[];
  warnings: AcceptanceCheck[];
  actionRequired: AcceptanceCheck[];
  skipped: AcceptanceCheck[];
  knownNonBlockingLogs: string[];
  finalVerdict: AcceptanceFinalVerdict;
};

type WranglerConfig = {
  name?: string;
  vars?: Record<string, string>;
  d1_databases?: Array<{ binding?: string; database_name?: string; database_id?: string }>;
  r2_buckets?: Array<{ binding?: string; bucket_name?: string }>;
};

type SiteManifest = {
  siteName?: string;
  domain?: string;
  productionUrl?: string;
  categories?: Array<{ slug?: string }>;
};

type ServerHandle = {
  baseUrl: string;
  process: ChildProcess;
  output: string[];
};

const reportJsonPath = path.join(".contentforge", "acceptance-report.json");
const reportMarkdownPath = path.join(".contentforge", "acceptance-report.md");
const knownNonBlockingPatterns = [
  "CONTENT RUNTIME production: D1 unavailable and fallback is disabled.",
  "workerd",
  "SQLITE_BUSY",
];
const viewportList = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];
const publicStaticRoutes = [
  "/",
  "/news",
  "/search",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms-of-service",
  "/cookie-policy",
  "/editorial-policy",
  "/affiliate-disclosure",
  "/dmca-copyright",
  "/definitely-missing-contentforge-acceptance-route",
];
const oldBrands = [
  "Legacy Starter Brand",
  "Aroma Haven",
  "Wellness Note",
  "Botanical Journal",
  "Wellbeing Journal",
];
const themePreviewAllowedBrands = ["Homerio", "MocktailMuse"];
const safeSecretExamples = new Set(["", "<YOUR_TOKEN>", "example-secret", "replace-me", "changeme"]);

export function parseAcceptanceArgs(args: string[]): AcceptanceOptions {
  const options: AcceptanceOptions = {
    mode: "quick",
    production: false,
    offline: true,
    remote: false,
    adapterMode: "offline",
    accountId: "",
    skipBrowser: false,
    report: "both",
    only: new Set(),
    continueOnFailure: false,
  };

  for (const arg of args) {
    if (arg === "--quick") options.mode = "quick";
    else if (arg === "--full") options.mode = "full";
    else if (arg === "--offline") options.offline = true;
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--skip-browser") options.skipBrowser = true;
    else if (arg === "--production") options.production = true;
    else if (arg === "--continue-on-failure") options.continueOnFailure = true;
    else if (arg.startsWith("--adapter=")) options.adapterMode = parseAdapterMode(arg.slice("--adapter=".length));
    else if (arg.startsWith("--account-id=")) options.accountId = arg.slice("--account-id=".length).trim();
    else if (arg.startsWith("--base-url=")) options.baseUrl = arg.slice("--base-url=".length).trim();
    else if (arg.startsWith("--report=")) {
      const report = arg.slice("--report=".length);
      if (report !== "json" && report !== "markdown" && report !== "both") throw new Error(`Invalid report mode: ${report}`);
      options.report = report;
    } else if (arg.startsWith("--only=")) {
      options.only = new Set(arg.slice("--only=".length).split(",").map((item) => item.trim()).filter(Boolean) as AcceptanceCheckCategory[]);
    } else {
      throw new Error(`Unknown acceptance argument: ${arg}`);
    }
  }

  return options;
}

export function determineExitCode(report: Pick<AcceptanceReport, "checks" | "production">) {
  if (report.checks.some((check) => check.status === "fail" && check.required)) return 1;
  if (report.production && report.checks.some((check) => check.status === "action-required" && check.required)) return 2;
  return 0;
}

export function summarizeChecks(checks: AcceptanceCheck[]): Record<AcceptanceCheckStatus, number> {
  return checks.reduce<Record<AcceptanceCheckStatus, number>>(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { pass: 0, warn: 0, "action-required": 0, fail: 0, skip: 0 },
  );
}

export function finalVerdict(checks: AcceptanceCheck[], production: boolean): AcceptanceFinalVerdict {
  if (checks.some((check) => check.required && check.status === "fail")) return "failed";
  if (production && checks.some((check) => check.required && check.status === "action-required")) return "blocked";
  if (checks.some((check) => check.status === "warn" || check.status === "action-required")) return "passed-with-warnings";
  return "passed";
}

export function redactSecret(value: string) {
  if (value.length <= 5) return "***";
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

function isSafeSecretExample(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    safeSecretExamples.has(normalized) ||
    normalized.startsWith("your-") ||
    normalized.startsWith("replace-") ||
    normalized.startsWith("a-long-") ||
    normalized.includes("example") ||
    normalized.includes("placeholder")
  );
}

export async function runAcceptance(options: AcceptanceOptions): Promise<AcceptanceReport> {
  const startedAt = new Date();
  const projectMode = detectProjectMode();
  const context = readProjectContext();
  const checks: AcceptanceCheck[] = [];
  let server: ServerHandle | null = null;
  let baseUrl = options.baseUrl ?? null;

  try {
    await add(checks, checkProjectBasics(projectMode, context, options));
    await add(checks, runCommandCheck("doctor", "Doctor", "framework", true, ["run", "doctor"]));
    await add(checks, runCommandCheck("lint", "Lint", "code-quality", true, ["run", "lint"]));
    if (options.mode === "full") {
      await add(checks, runCommandCheck("build", "Build", "build", true, ["run", "build"]));
    }
    await add(checks, runCommandCheck("typecheck", "Typecheck", "code-quality", true, ["run", "typecheck"]));
    await add(checks, runCommandCheck("manifest", "Manifest check", "project", true, ["run", "manifest:check"]));
    await add(checks, runCommandCheck("p0", "P0 tests", "content", true, ["run", "test:p0"]));
    await add(checks, runCommandCheck("production-bootstrap-tests", "Production bootstrap tests", "production", true, ["run", "test:production-bootstrap"]));
    await add(checks, runCommandCheck("theme-css-audit", "Theme CSS audit", "framework", true, ["run", "theme:css-audit"]));
    await add(checks, checkUrlConfig(context, projectMode, options));
    await add(checks, scanSecrets());
    await add(checks, scanBrands(projectMode, options));
    await add(checks, checkProductionBootstrap(options));
    if (options.production && options.remote) {
      await add(checks, await checkRemoteProductionReadiness(options));
    }

    if (options.mode === "full") {
      if (!baseUrl) {
        server = await startLocalServer();
        baseUrl = server.baseUrl;
      }
      await add(checks, await checkRoutes(baseUrl, projectMode));
      await add(checks, await checkRobots(baseUrl, options));
      await add(checks, await checkSitemap(baseUrl, options));
      await add(checks, await checkBrowserRuntime(baseUrl, options));
    } else {
      await add(checks, skipped("browser-skipped-quick", "Browser runtime checks", "browser", "Quick mode does not start a browser."));
    }
  } finally {
    if (server) await stopLocalServer(server);
  }

  const filteredChecks = filterChecks(checks, options.only);
  const finishedAt = new Date();
  const report: AcceptanceReport = {
    frameworkVersion: context.frameworkVersion,
    siteName: context.siteName,
    mode: projectMode,
    acceptanceMode: options.mode,
    production: options.production,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    gitCommit: await gitCommit(),
    baseUrl,
    viewportList,
    summary: summarizeChecks(filteredChecks),
    checks: filteredChecks,
    failures: filteredChecks.filter((check) => check.status === "fail"),
    warnings: filteredChecks.filter((check) => check.status === "warn"),
    actionRequired: filteredChecks.filter((check) => check.status === "action-required"),
    skipped: filteredChecks.filter((check) => check.status === "skip"),
    knownNonBlockingLogs: collectKnownLogs(filteredChecks),
    finalVerdict: finalVerdict(filteredChecks, options.production),
  };

  writeReports(report, options.report);
  return report;
}

function checkProjectBasics(projectMode: ProjectMode, context: ReturnType<typeof readProjectContext>, options: AcceptanceOptions): AcceptanceCheck {
  const details = [`Mode: ${projectMode}`, `Site: ${context.siteName}`, `Framework version: ${context.frameworkVersion}`];
  const hasPackage = existsSync(path.join(projectRoot, "package.json"));
  const hasThemeLibrary = existsSync(path.join(projectRoot, "frontend-library"));
  const missing = [hasPackage ? "" : "package.json missing", hasThemeLibrary ? "" : "frontend-library missing"].filter(Boolean);
  if (options.production && projectMode === "framework") {
    details.push("Framework mode: production placeholders are reported but do not imply production instance validation.");
  }
  return makeCheck({
    id: "project-basics",
    title: "Project and mode detection",
    category: "project",
    required: true,
    status: missing.length ? "fail" : "pass",
    summary: missing.length ? missing.join("; ") : "Project identity loaded.",
    details,
    suggestedAction: missing.length ? "Restore the required Framework files." : undefined,
  });
}

async function runCommandCheck(
  id: string,
  title: string,
  category: AcceptanceCheckCategory,
  required: boolean,
  npmArgs: string[],
): Promise<AcceptanceCheck> {
  const started = Date.now();
  const command = npmCommand();
  const result = await runCommand(command, npmArgs, { shell: true });
  const output = `${result.stdout}\n${result.stderr}`.trim();
  const knownLogs = knownNonBlockingPatterns.filter((pattern) => output.includes(pattern));
  const warnings = extractWarningSummary(output);
  const status: AcceptanceCheckStatus = result.code === 0 ? (warnings.length ? "warn" : "pass") : "fail";
  return {
    id,
    title,
    category,
    required,
    status,
    durationMs: Date.now() - started,
    command: `${command} ${npmArgs.join(" ")}`,
    summary: result.code === 0 ? "Command exited 0." : `Command exited ${result.code ?? "unknown"}.`,
    details: warnings,
    evidence: [truncateOutput(output), ...knownLogs.map((log) => `known-non-blocking-log: ${log}`)],
    suggestedAction: status === "fail" ? `Run ${command} ${npmArgs.join(" ")} locally and fix the failure.` : undefined,
  };
}

function checkUrlConfig(context: ReturnType<typeof readProjectContext>, projectMode: ProjectMode, options: AcceptanceOptions): AcceptanceCheck {
  const issues: string[] = [];
  const siteUrl = context.siteUrl;
  const host = safeHost(siteUrl);
  if (!siteUrl) issues.push("Missing canonical site URL.");
  if (options.production && /example\.com/i.test(siteUrl)) issues.push("Production URL uses example.com.");
  if (options.production && /localhost|127\.0\.0\.1/i.test(siteUrl)) issues.push("Production URL uses localhost.");
  if (options.production && context.productionFallback) issues.push("Production fallback is enabled.");
  if (options.production && context.customDomain && /workers\.dev$/i.test(host)) issues.push("Custom domain config uses workers.dev.");
  const status: AcceptanceCheckStatus = issues.length === 0 ? "pass" : options.production && projectMode === "instance" ? "fail" : "warn";
  return makeCheck({
    id: "site-url-config",
    title: "Site URL and canonical config",
    category: "seo",
    required: true,
    status,
    summary: issues.length ? issues.join("; ") : "Canonical URL config is acceptable for this mode.",
    details: [`siteUrl=${siteUrl || "missing"}`, `host=${host || "missing"}`],
    suggestedAction: issues.length ? "Set production URL, canonical host, and fallback flags before launch." : undefined,
  });
}

async function scanSecrets(): Promise<AcceptanceCheck> {
  const started = Date.now();
  const scanRoots = [".env", ".env.local", ".dev.vars", "env.example", ".dev.vars.example", ".contentforge", "docs", "scripts", "tools", "src", "public"].filter((item) =>
    existsSync(path.join(projectRoot, item)),
  );
  const findings: string[] = [];
  for (const file of walkFiles(scanRoots)) {
    const relative = normalize(path.relative(projectRoot, file));
    if (file.includes("node_modules") || file.includes(".next")) continue;
    const text = readTextFile(file);
    if (!text) continue;
    text.split(/\r?\n/).forEach((line, index) => {
      const assignment = line.match(/^\s*(ADMIN_PASSWORD|SESSION_SECRET|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_ACCOUNT_TOKEN|ACCOUNT_TOKEN|AUTHORIZATION)\s*=\s*(.*)$/i);
      if (assignment) {
        const value = assignment[2].trim().replace(/^["']|["']$/g, "");
        if (value && !isSafeSecretExample(value)) findings.push(`${relative}:${index + 1} ${assignment[1]}=${redactSecret(value)}`);
      }
      const token = line.match(/(Bearer\s+[A-Za-z0-9._-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/);
      if (token) findings.push(`${relative}:${index + 1} ${redactSecret(token[1])}`);
      if (/NEXT_PUBLIC_.*(SECRET|TOKEN|PASSWORD|KEY)\s*=/i.test(line)) findings.push(`${relative}:${index + 1} client-exposed secret-like variable`);
    });
  }
  return {
    id: "secret-scan",
    title: "Secret and sensitive value scan",
    category: "security",
    required: true,
    status: findings.length ? "fail" : "pass",
    durationMs: Date.now() - started,
    summary: findings.length ? `${findings.length} sensitive value finding(s).` : "No non-empty secret values or token-like values found.",
    details: findings.slice(0, 20),
    evidence: scanRoots,
    suggestedAction: findings.length ? "Remove the value, rotate it, and keep only field names or blank examples in git." : undefined,
  };
}

function scanBrands(projectMode: ProjectMode, options: AcceptanceOptions): AcceptanceCheck {
  const findings: string[] = [];
  const allowed = new Set([readProjectContext().siteName.toLowerCase(), ...themePreviewAllowedBrands.map((brand) => brand.toLowerCase())]);
  const scanRoots = ["src", "public", "data", "starter.site.json"].filter((item) => existsSync(path.join(projectRoot, item)));
  for (const file of walkFiles(scanRoots)) {
    const relative = normalize(path.relative(projectRoot, file));
    const isThemePreview = relative.includes("theme-preview") || relative.includes("frontend-library");
    const text = readTextFile(file);
    if (!text) continue;
    for (const brand of oldBrands) {
      if (allowed.has(brand.toLowerCase())) continue;
      if (isThemePreview && projectMode === "framework") continue;
      if (text.includes(brand)) findings.push(`${relative}: contains ${brand}`);
    }
  }
  const status: AcceptanceCheckStatus = findings.length ? (options.production ? "fail" : "warn") : "pass";
  return makeCheck({
    id: "brand-residual-scan",
    title: "Brand residual scan",
    category: "content",
    required: true,
    status,
    summary: findings.length ? `${findings.length} possible old-brand reference(s).` : "No disallowed old-brand references found.",
    details: findings.slice(0, 30),
    suggestedAction: findings.length ? "Replace inherited brand strings or add a narrow mode-specific exception." : undefined,
  });
}

async function checkProductionBootstrap(options: AcceptanceOptions): Promise<AcceptanceCheck> {
  const started = Date.now();
  const { config, warnings } = resolveBootstrapConfig({});
  const manifest = readJsonSafe<Record<string, unknown>>(path.join(".contentforge", "production-bootstrap.json"));
  const issues: string[] = [];
  if (options.production) {
    if (warnings.length) issues.push(...warnings);
    if (!manifest) {
      issues.push("Production bootstrap manifest is not initialized.");
      issues.push("Production Cloudflare Worker, D1, and R2 resources are not confirmed.");
      issues.push("Production secrets are not confirmed configured.");
    }
  }
  return {
    id: "production-bootstrap",
    title: "Production bootstrap readiness",
    category: "production",
    required: true,
    status: issues.length ? "action-required" : "pass",
    durationMs: Date.now() - started,
    summary: issues.length ? `${issues.length} production action(s) required.` : "Production bootstrap config has no blocking warnings for this mode.",
    details: issues,
    evidence: [`worker=${config.workerName}`, `d1=${config.d1DatabaseName}`, `r2=${config.r2BucketName}`],
    suggestedAction: issues.length ? "Run production:setup planning and complete required manual production actions." : undefined,
  };
}

async function checkRemoteProductionReadiness(options: AcceptanceOptions): Promise<AcceptanceCheck> {
  const started = Date.now();
  const { config } = resolveBootstrapConfig({});
  const remoteArgs = ["--remote", `--adapter=${options.adapterMode}`];
  if (options.accountId) remoteArgs.push(`--account-id=${options.accountId}`);
  const remoteOptions = parseRemoteExecutionArgs(remoteArgs);
  const adapter = createControlledAdapter(remoteOptions.adapterMode);
  const report = await runControlledCloudflareWorkflow({ config, options: remoteOptions, adapter });
  const blocking = report.checks.filter((check) => ["blocked", "failed"].includes(check.status));
  const action = report.checks.filter((check) => check.status === "action-required");
  return {
    id: "remote-production-readiness",
    title: "Remote production readiness",
    category: "production",
    required: true,
    status: blocking.length ? "fail" : action.length ? "action-required" : "pass",
    durationMs: Date.now() - started,
    summary: `Remote read-only check completed with adapter=${report.adapter}.`,
    details: report.checks.map((check) => `${check.status} ${check.id}: ${check.detail}`),
    evidence: [
      `mode=${report.mode}`,
      `riskLevel=${report.riskLevel}`,
      "read-only: no Worker, D1, R2, secret, deploy, D1 write, domain, or DNS mutation",
      ...report.remoteCalls.map((call) => `adapter-call:${call}`),
    ],
    suggestedAction: action.length ? "Select an explicit adapter/account and complete production setup before launch." : undefined,
  };
}

async function checkRoutes(baseUrl: string, projectMode: ProjectMode): Promise<AcceptanceCheck> {
  const started = Date.now();
  const routes = discoverRoutes(projectMode);
  const failures: string[] = [];
  const warnings: string[] = [];
  for (const route of routes) {
    const response = await fetchWithTimeout(new URL(route, baseUrl).toString());
    if (!response.ok && !(route.includes("definitely-missing") && response.status === 404)) {
      if (response.status === 404 && isOptionalDynamicRoute(route)) {
        warnings.push(`${route} skipped because local content is unavailable.`);
        continue;
      }
      failures.push(`${route} returned ${response.status}`);
      continue;
    }
    if (!/<title[^>]*>.+<\/title>/i.test(response.text)) warnings.push(`${route} missing title.`);
    if (!/<link[^>]+rel=["']canonical["']/i.test(response.text) && !route.includes("definitely-missing")) warnings.push(`${route} missing canonical.`);
  }
  return makeCheck({
    id: "route-smoke",
    title: "Route smoke tests",
    category: "routes",
    required: true,
    status: failures.length ? "fail" : warnings.length ? "warn" : "pass",
    durationMs: Date.now() - started,
    summary: failures.length ? `${failures.length} route failure(s).` : `${routes.length} route(s) checked.`,
    details: [...failures, ...warnings].slice(0, 40),
    evidence: routes,
    suggestedAction: failures.length ? "Fix failing public routes before launch." : undefined,
  });
}

async function checkRobots(baseUrl: string, options: AcceptanceOptions): Promise<AcceptanceCheck> {
  const started = Date.now();
  const response = await fetchWithTimeout(new URL("/robots.txt", baseUrl).toString());
  const issues: string[] = [];
  if (!response.ok) issues.push(`robots.txt returned ${response.status}`);
  if (!/sitemap:\s*https?:\/\//i.test(response.text)) issues.push("robots.txt missing absolute sitemap URL.");
  if (options.production && /disallow:\s*\/\s*$/im.test(response.text)) issues.push("Production robots.txt disallows root.");
  return makeCheck({
    id: "robots",
    title: "robots.txt",
    category: "seo",
    required: true,
    status: issues.length ? "fail" : "pass",
    durationMs: Date.now() - started,
    summary: issues.length ? issues.join("; ") : "robots.txt is reachable and includes an absolute sitemap URL.",
    details: issues,
  });
}

async function checkSitemap(baseUrl: string, options: AcceptanceOptions): Promise<AcceptanceCheck> {
  const started = Date.now();
  const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();
  const response = await fetchWithTimeout(sitemapUrl);
  const head = await fetchWithTimeout(sitemapUrl, 10_000, { method: "HEAD" });
  const issues: string[] = [];
  if (!response.ok) issues.push(`sitemap.xml returned ${response.status}`);
  if (!head.ok) issues.push(`sitemap.xml HEAD returned ${head.status}`);
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/xml")) issues.push("sitemap.xml Content-Type is not application/xml.");
  const getLength = Number(response.headers.get("content-length"));
  const headLength = Number(head.headers.get("content-length"));
  if (!Number.isFinite(getLength) || getLength <= 0) issues.push("sitemap.xml GET missing Content-Length.");
  if (!Number.isFinite(headLength) || headLength <= 0) issues.push("sitemap.xml HEAD missing Content-Length.");
  if (Number.isFinite(getLength) && response.bodyLength !== getLength) issues.push("sitemap.xml GET body length does not match Content-Length.");
  if (Number.isFinite(getLength) && Number.isFinite(headLength) && getLength !== headLength) issues.push("sitemap.xml HEAD Content-Length does not match GET.");
  if ((response.headers.get("transfer-encoding") ?? "").toLowerCase().includes("chunked")) issues.push("sitemap.xml uses Transfer-Encoding: chunked.");
  if (!/<urlset[\s>]/i.test(response.text)) issues.push("sitemap.xml is not a urlset XML document.");
  if (/Invalid Date/i.test(response.text)) issues.push("sitemap.xml contains Invalid Date.");
  const urls = Array.from(response.text.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => match[1]);
  if (new Set(urls).size !== urls.length) issues.push("sitemap.xml contains duplicate URL entries.");
  if (options.production && urls.some((url) => /example\.com|localhost|127\.0\.0\.1/i.test(url))) issues.push("Production sitemap contains placeholder/local URL.");
  return makeCheck({
    id: "sitemap",
    title: "sitemap.xml",
    category: "seo",
    required: true,
    status: issues.length ? "fail" : "pass",
    durationMs: Date.now() - started,
    summary: issues.length ? issues.join("; ") : `${urls.length} sitemap URL(s) parsed.`,
    details: issues,
    evidence: urls.slice(0, 20),
  });
}

async function checkBrowserRuntime(baseUrl: string, options: AcceptanceOptions): Promise<AcceptanceCheck> {
  const started = Date.now();
  if (options.skipBrowser) {
    return skipped("browser-skipped", "Browser runtime checks", "browser", "--skip-browser was set.");
  }

  const playwright = await tryLoadPlaywright();
  if (!playwright) {
    return makeCheck({
      id: "browser-runtime",
      title: "Browser runtime checks",
      category: "browser",
      required: true,
      status: "action-required",
      durationMs: Date.now() - started,
      summary: "Playwright is not installed or Chromium is unavailable.",
      details: ["Run npm run acceptance:install-browser after installing Playwright dependency if browser checks are required."],
      suggestedAction: "Install Chromium for local browser acceptance or rerun full mode with --skip-browser.",
    });
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const errors: string[] = [];
  const warnings: string[] = [];
  const evidence = viewportList.map((viewport) => `${viewport.width}x${viewport.height}`);
  try {
    for (const viewport of viewportList) {
      const page = await browser.newPage({ viewport });
      page.on("pageerror", (error: Error) => errors.push(`pageerror ${error.message}`));
      page.on("console", (message: { type(): string; text(): string }) => {
        const text = message.text();
        if (message.type() === "error" || /hydration|unhandled/i.test(text)) errors.push(`console ${text}`);
      });
      page.on("requestfailed", (request: { url(): string; failure(): { errorText: string } | null }) => {
        const url = request.url();
        const errorText = request.failure()?.errorText ?? "";
        if (!isExpectedBrowserRequestCancellation(url, errorText)) {
          errors.push(`request failed ${url} ${errorText}`.trim());
        }
      });
      page.on("response", (response: { url(): string; status(): number }) => {
        const status = response.status();
        const url = response.url();
        if (status >= 400 && !/definitely-missing-contentforge-acceptance-route|favicon\.ico/i.test(url)) {
          errors.push(`network ${status} ${url}`);
        }
      });
      const response = await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 20_000 });
      if (!response || response.status() >= 500) errors.push(`home returned ${response?.status() ?? "no response"}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) errors.push(`horizontal overflow ${overflow}px at ${viewport.width}x${viewport.height}`);
      const brokenImages = await page.evaluate(() =>
        Array.from(document.images)
          .filter((img) => img.currentSrc && img.naturalWidth === 0)
          .map((img) => img.currentSrc),
      );
      errors.push(...(brokenImages as string[]).map((src: string) => `broken image ${src}`));
      if (viewport.width <= 430) {
        await checkMobileMenuInteraction(page, errors, warnings, evidence);
        await checkFooterAccordionInteraction(page, errors, warnings, evidence);
      }
      await page.close();
    }
    await checkSearchInteraction(browser, baseUrl, errors, warnings, evidence);
  } finally {
    await browser.close();
  }

  return makeCheck({
    id: "browser-runtime",
    title: "Browser console, hydration, network, images, overflow, and interactions",
    category: "browser",
    required: true,
    status: errors.length ? "fail" : warnings.length ? "warn" : "pass",
    durationMs: Date.now() - started,
    summary: errors.length
      ? `${errors.length} browser runtime issue(s).`
      : warnings.length
        ? `${warnings.length} browser runtime warning(s).`
        : "Browser runtime checks passed.",
    details: [...errors, ...warnings].slice(0, 50),
    evidence,
  });
}

async function checkMobileMenuInteraction(page: any, errors: string[], warnings: string[], evidence: string[]) {
  const candidates = page.locator('header button[aria-expanded][aria-controls], button[aria-label*="menu" i]');
  const candidateCount = await candidates.count();
  if (!candidateCount) {
    warnings.push("mobile menu trigger was not found.");
    return;
  }
  let trigger = candidates.first();
  let foundVisible = false;
  for (let index = 0; index < candidateCount; index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      trigger = candidate;
      foundVisible = true;
      break;
    }
  }
  if (!foundVisible) {
    warnings.push("mobile menu trigger was not visible.");
    return;
  }
  const before = await trigger.getAttribute("aria-expanded");
  await trigger.click();
  await page.waitForTimeout(150);
  const after = await trigger.getAttribute("aria-expanded");
  const controls = await trigger.getAttribute("aria-controls");
  const controlledVisible = controls ? await page.locator(`#${cssEscape(controls)}`).isVisible().catch(() => false) : false;
  if (before === after && !controlledVisible) errors.push("mobile menu did not open after trigger click.");
  if ((await trigger.getAttribute("aria-expanded")) === "true") {
    await trigger.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(150);
  }
  evidence.push("mobile-menu");
}

async function checkFooterAccordionInteraction(page: any, errors: string[], warnings: string[], evidence: string[]) {
  const trigger = page.locator('footer button[aria-expanded], footer button[class*="accordion" i]').first();
  if (!(await trigger.count())) {
    warnings.push("footer accordion trigger was not found.");
    return;
  }
  await trigger.scrollIntoViewIfNeeded();
  const before = await trigger.getAttribute("aria-expanded");
  await trigger.click({ force: true });
  await page.waitForTimeout(150);
  let after = await trigger.getAttribute("aria-expanded");
  if (before === after) {
    await trigger.evaluate((node: HTMLButtonElement) => node.click()).catch(() => undefined);
    await page.waitForTimeout(150);
    after = await trigger.getAttribute("aria-expanded");
  }
  if (before === after) errors.push("footer accordion did not toggle after trigger click.");
  evidence.push("footer-accordion");
}

async function checkSearchInteraction(browser: any, baseUrl: string, errors: string[], warnings: string[], evidence: string[]) {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  try {
    await page.goto(new URL("/search", baseUrl).toString(), { waitUntil: "networkidle", timeout: 20_000 });
    const input = page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i]').first();
    if (!(await input.count())) {
      warnings.push("search input was not found on /search.");
      return;
    }
    await input.fill("contentforge acceptance");
    await input.press("Enter").catch(async () => {
      const form = page.locator("form").filter({ has: input }).first();
      if (await form.count()) await form.evaluate((node: HTMLFormElement) => node.requestSubmit());
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    const pageErrorText = await page.locator("text=/application error|hydration failed|unhandled/i").count();
    if (pageErrorText > 0) errors.push("search interaction surfaced a runtime error.");
    evidence.push("search");
  } finally {
    await page.close();
  }
}

function cssEscape(value: string) {
  return value.replace(/["\\#.;:[\],>+~*'=|^$()]/g, "\\$&");
}

function isExpectedBrowserRequestCancellation(url: string, errorText: string) {
  return /[?&]_rsc=/.test(url) && /ERR_ABORTED|cancel/i.test(errorText);
}

async function tryLoadPlaywright(): Promise<any | null> {
  try {
    const moduleName = "playwright";
    return await import(moduleName);
  } catch {
    try {
      const moduleName = "@playwright/test";
      return await import(moduleName);
    } catch {
      return null;
    }
  }
}

function discoverRoutes(projectMode: ProjectMode) {
  const routes = [...publicStaticRoutes];
  const manifest = readJsonSafe<SiteManifest>("starter.site.json");
  const firstCategory = manifest?.categories?.find((category) => category.slug)?.slug;
  if (firstCategory) routes.push(`/category/${firstCategory}`);
  if (projectMode === "framework") routes.push("/theme-preview/homerio");
  return [...new Set(routes)];
}

function isOptionalDynamicRoute(route: string) {
  return route.startsWith("/category/") || route.startsWith("/news/") || route.startsWith("/tag/");
}

async function startLocalServer(): Promise<ServerHandle> {
  const port = await findOpenPort(3100);
  const command = npmCommand();
  const commandArgs = ["run", "start", "--", "-p", String(port), "-H", "127.0.0.1"];
  const child = spawnServerProcess(command, commandArgs);
  const output: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString("utf8")));
  child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString("utf8")));
  const baseUrl = `http://127.0.0.1:${port}`;
  const ready = await waitForServer(baseUrl, 30_000);
  if (!ready) {
    await stopProcessTree(child);
    throw new Error(`Local server did not become ready at ${baseUrl}. Output: ${output.join("\n").slice(-1000)}`);
  }
  return { baseUrl, process: child, output };
}

function spawnServerProcess(command: string, commandArgs: string[]) {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", [command, ...commandArgs].map(quoteCmdArg).join(" ")], {
      cwd: projectRoot,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  }

  return spawn(command, commandArgs, {
    cwd: projectRoot,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function quoteCmdArg(value: string) {
  if (!/[()\s"&|<>^]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

async function stopLocalServer(server: ServerHandle) {
  await stopProcessTree(server.process);
}

async function stopProcessTree(child: ChildProcess) {
  if (child.killed || child.exitCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    await runCommand("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"]);
  } else {
    child.kill("SIGTERM");
  }
}

async function waitForServer(baseUrl: string, timeoutMs: number) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetchWithTimeout(baseUrl, 2_000);
    if (response.ok || (response.status > 0 && response.status < 500)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 10_000,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; text: string; headers: Headers; bodyLength: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { ok: response.ok, status: response.status, text: new TextDecoder().decode(bytes), headers: response.headers, bodyLength: bytes.byteLength };
  } catch (error) {
    return { ok: false, status: 0, text: error instanceof Error ? error.message : "fetch failed", headers: new Headers(), bodyLength: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function findOpenPort(start: number) {
  for (let port = start; port < start + 100; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error("Unable to find an open local port for acceptance server.");
}

function canListen(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = http.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

function writeReports(report: AcceptanceReport, reportMode: AcceptanceOptions["report"]) {
  const dir = path.join(projectRoot, ".contentforge");
  mkdirSync(dir, { recursive: true });
  const safeReport = sanitizeReport(report);
  if (reportMode === "json" || reportMode === "both") {
    writeFileSync(path.join(projectRoot, reportJsonPath), `${JSON.stringify(safeReport, null, 2)}\n`, "utf8");
  }
  if (reportMode === "markdown" || reportMode === "both") {
    writeFileSync(path.join(projectRoot, reportMarkdownPath), renderMarkdownReport(safeReport), "utf8");
  }
}

function renderMarkdownReport(report: AcceptanceReport) {
  const lines = [
    "# ContentForge Acceptance Report",
    "",
    `Final verdict: ${report.finalVerdict}`,
    `Mode: ${report.mode} / ${report.acceptanceMode}${report.production ? " / production" : ""}`,
    `Site: ${report.siteName}`,
    `Git commit: ${report.gitCommit}`,
    `Base URL: ${report.baseUrl ?? "not started"}`,
    "",
    "## Summary",
    "",
    ...Object.entries(report.summary).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.status.toUpperCase()} ${check.id}: ${check.summary}`),
    "",
    "## Known Non-blocking Logs",
    "",
    ...(report.knownNonBlockingLogs.length ? report.knownNonBlockingLogs.map((log) => `- ${log}`) : ["- None"]),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function sanitizeReport<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).replace(/(Bearer\s+)[A-Za-z0-9._-]+/g, "$1***")) as T;
}

function readProjectContext() {
  const frameworkVersion = readJsonSafe<{ version?: string }>("framework.version.json")?.version ?? readTextFile(path.join(projectRoot, ".contentforge-version"))?.trim() ?? "unknown";
  const manifest = readJsonSafe<SiteManifest>("starter.site.json");
  const wrangler = readWrangler();
  const siteConfigText = readTextFile(path.join(projectRoot, "src", "instance", "site.config.ts")) || readTextFile(path.join(projectRoot, "src", "config", "site.config.ts")) || "";
  const siteName = matchString(siteConfigText, "name") || manifest?.siteName || "ContentForge";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || wrangler.vars?.NEXT_PUBLIC_SITE_URL || matchString(siteConfigText, "url") || manifest?.productionUrl || "";
  const productionFallback = /allowProductionFallback:\s*true/.test(siteConfigText) || process.env.CONTENTFORGE_ALLOW_PRODUCTION_FALLBACK === "1";
  return {
    frameworkVersion,
    siteName,
    siteUrl,
    customDomain: manifest?.domain,
    productionFallback,
  };
}

function detectProjectMode(): ProjectMode {
  const frameworkManifest = readJsonSafe<{ type?: string }>("framework.manifest.json");
  return frameworkManifest?.type === "framework" ? "framework" : "instance";
}

function readWrangler(): WranglerConfig {
  try {
    return readJsoncFile<WranglerConfig>(path.join(projectRoot, "wrangler.jsonc"));
  } catch {
    return {};
  }
}

async function gitCommit() {
  const result = await runCommand(process.platform === "win32" ? "git.exe" : "git", ["rev-parse", "HEAD"]);
  return result.code === 0 ? result.stdout.trim() : "unknown";
}

function filterChecks(checks: AcceptanceCheck[], only: Set<AcceptanceCheckCategory>) {
  if (only.size === 0) return checks;
  return checks.filter((check) => only.has(check.category));
}

async function add(checks: AcceptanceCheck[], checkOrPromise: AcceptanceCheck | Promise<AcceptanceCheck>) {
  const check = await checkOrPromise;
  checks.push(check);
}

function makeCheck(input: Omit<AcceptanceCheck, "durationMs" | "evidence" | "details"> & { durationMs?: number; evidence?: string[]; details?: string[] }): AcceptanceCheck {
  return {
    durationMs: input.durationMs ?? 0,
    evidence: input.evidence ?? [],
    details: input.details ?? [],
    ...input,
  };
}

function skipped(id: string, title: string, category: AcceptanceCheckCategory, summary: string): AcceptanceCheck {
  return makeCheck({ id, title, category, required: false, status: "skip", summary });
}

function extractWarningSummary(output: string) {
  const warnings: string[] = [];
  const eslint = output.match(/✖\s+\d+\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/);
  if (eslint && Number(eslint[2]) > 0 && Number(eslint[1]) === 0) warnings.push(`${eslint[2]} lint warning(s), 0 errors.`);
  const manifest = output.match(/Summary:\s+\d+\s+pass,\s+(\d+)\s+warn,\s+0\s+fail/i);
  if (manifest && Number(manifest[1]) > 0) warnings.push(`${manifest[1]} warning(s), 0 fail.`);
  return warnings;
}

function collectKnownLogs(checks: AcceptanceCheck[]) {
  return [...new Set(checks.flatMap((check) => check.evidence.filter((item) => item.startsWith("known-non-blocking-log:"))))];
}

function truncateOutput(output: string) {
  const clean = output.trim();
  if (clean.length <= 2000) return clean;
  return `${clean.slice(0, 1000)}\n...\n${clean.slice(-1000)}`;
}

function walkFiles(roots: string[]) {
  const files: string[] = [];
  for (const root of roots) {
    const full = path.isAbsolute(root) ? root : path.join(projectRoot, root);
    if (!existsSync(full)) continue;
    const stats = statSync(full);
    if (stats.isFile()) files.push(full);
    else if (stats.isDirectory()) {
      for (const entry of readdirSync(full)) {
        if (["node_modules", ".next", ".open-next", ".wrangler", ".git"].includes(entry)) continue;
        files.push(...walkFiles([path.join(full, entry)]));
      }
    }
  }
  return files.filter((file) => statSync(file).isFile() && statSync(file).size < 2_000_000);
}

function readJsonSafe<T>(relativePath: string): T | null {
  const filePath = path.isAbsolute(relativePath) ? relativePath : path.join(projectRoot, relativePath);
  if (!existsSync(filePath)) return null;
  const text = readFileSync(filePath, "utf8");
  return JSON.parse(filePath.endsWith(".jsonc") ? stripJsonComments(text) : text) as T;
}

function readTextFile(filePath: string) {
  if (!existsSync(filePath)) return "";
  const buffer = readFileSync(filePath);
  if (buffer.includes(0) || buffer.length > 2_000_000) return "";
  return buffer.toString("utf8");
}

function matchString(text: string, key: string) {
  return text.match(new RegExp(`\\b${key}:\\s*["']([^"']*)["']`))?.[1] ?? "";
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function normalize(input: string) {
  return input.replace(/\\/g, "/");
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}


async function main() {
  try {
    const options = parseAcceptanceArgs(process.argv.slice(2));
    const report = await runAcceptance(options);
    printReportSummary(report);
    process.exitCode = determineExitCode(report);
  } catch (error) {
    console.error(`FAIL Acceptance tool error - ${error instanceof Error ? error.message : "Unknown error."}`);
    process.exitCode = 3;
  }
}

function printReportSummary(report: AcceptanceReport) {
  console.log("ContentForge Acceptance");
  console.log(`Verdict: ${report.finalVerdict}`);
  console.log(`Mode: ${report.mode} / ${report.acceptanceMode}${report.production ? " / production" : ""}`);
  console.log(`Summary: ${JSON.stringify(report.summary)}`);
  console.log(`Reports: ${reportJsonPath}, ${reportMarkdownPath}`);
}

if (process.argv[1] && normalize(process.argv[1]).endsWith("tools/starter/acceptance.ts")) {
  main();
}
