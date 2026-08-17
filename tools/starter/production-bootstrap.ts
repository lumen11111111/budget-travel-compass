import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { projectRoot, readJsoncFile, runCommand, stripJsonComments } from "./cli-utils";
import { createControlledAdapter } from "./cloudflare-adapter";
import { parseRemoteExecutionArgs, type CloudflareAdapterMode } from "./cloudflare-execution";
import { renderControlledWorkflowReport, runControlledCloudflareWorkflow } from "./cloudflare-workflows";
import { recoverProductionPatch, rollbackProductionConfig } from "./production-config-patch";

export type ProductionBootstrapStepId =
  | "instance-validation"
  | "git-validation"
  | "cloudflare-cli"
  | "cloudflare-auth"
  | "resource-plan"
  | "worker"
  | "d1"
  | "r2"
  | "bindings"
  | "local-config"
  | "environment"
  | "secrets"
  | "first-deploy"
  | "database-init"
  | "domain"
  | "seo-validation"
  | "final-validation";

export type ProductionBootstrapStatus =
  | "pending"
  | "ready"
  | "running"
  | "passed"
  | "warning"
  | "blocked"
  | "failed"
  | "skipped"
  | "manual-action-required";

export type ProductionDoctorStatus = "PASS" | "ACTION REQUIRED" | "MANUAL ACTION" | "WARN" | "FAIL" | "SKIP";

export type ResourceCreationMode = CloudflareAdapterMode | "dry-run";

export type BootstrapStepState = {
  id: ProductionBootstrapStepId;
  label: string;
  status: ProductionBootstrapStatus;
  required: boolean;
  dependencies: ProductionBootstrapStepId[];
  startedAt?: string;
  completedAt?: string;
  result?: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  suggestedNextAction?: string;
};

export type ProductionBootstrapManifest = {
  schemaVersion: 1;
  frameworkVersion: string;
  instanceName: string;
  instancePath: string;
  generatedAt: string;
  updatedAt: string;
  environment: "production";
  siteUrl: string;
  canonicalHost: string;
  workerName: string;
  d1DatabaseName: string;
  d1DatabaseId: string;
  r2BucketName: string;
  r2PublicBaseUrl: string;
  customDomain: string;
  wwwDomain: string;
  resourceCreationMode: ResourceCreationMode;
  steps: BootstrapStepState[];
  lastSuccessfulStep: ProductionBootstrapStepId | null;
  warnings: string[];
  manualActions: string[];
  completed: boolean;
};

export type BootstrapOptions = {
  dryRun: boolean;
  plan: boolean;
  resume: boolean;
  status: boolean;
  doctor: boolean;
  nonInteractive: boolean;
  yes: boolean;
  allowCreate: boolean;
  allowDeploy: boolean;
  allowDomainChange: boolean;
  allowLocalWrite: boolean;
  writeManifest: boolean;
  adapterMode: ResourceCreationMode;
  remote: boolean;
  remotePlan: boolean;
  remoteCheck: boolean;
  execute: boolean;
  recoverConfigPatch: boolean;
  rollbackConfigPatch: boolean;
  operationId?: string;
  accountId: string;
  approvedPlanHash?: string;
  allowCreateWorker: boolean;
  allowCreateD1: boolean;
  allowCreateR2: boolean;
  allowSetSecrets: boolean;
  allowD1Write: boolean;
  allowR2Probe: boolean;
  allowConfigPatch: boolean;
  allowBootstrapSeed: boolean;
  allowCleanup: boolean;
  allowProductionResources: boolean;
  allowDnsChange: boolean;
  reuseWorker?: string;
  reuseD1?: string;
  reuseR2?: string;
  step?: ProductionBootstrapStepId;
  fromStep?: ProductionBootstrapStepId;
  overrides: Partial<BootstrapConfigInput>;
};

export type BootstrapConfigInput = {
  siteName: string;
  siteSlug: string;
  siteUrl: string;
  canonicalHost: string;
  workerName: string;
  d1DatabaseName: string;
  d1DatabaseId: string;
  r2BucketName: string;
  r2PublicBaseUrl: string;
  customDomain: string;
  wwwRedirect: boolean;
  cloudflareAccountId: string;
  productionFallback: boolean;
  deploymentEnvironment: "production";
};

export type ResourcePlan = {
  worker: ResourcePlanEntry;
  d1: ResourcePlanEntry & { databaseId?: string };
  r2: ResourcePlanEntry;
  domain: {
    apex: string;
    www: string;
    canonical: string;
    currentDnsState: "unknown" | "not-checked";
    desiredRedirect: string;
    action: "manual-action-required" | "skip";
  };
  secrets: Array<{ name: string; purpose: string; status: "configured" | "missing" | "unknown"; command: string }>;
};

export type ResourcePlanEntry = {
  proposedName: string;
  state: "existing" | "new" | "unknown" | "ambiguous";
  action: "create" | "reuse" | "manual-action-required" | "skip";
  reason: string;
};

export interface CloudflareAdapter {
  mode: ResourceCreationMode;
  getAuthStatus(): Promise<{ authenticated: boolean; accountId?: string; status: "authenticated" | "missing" | "unknown"; detail: string }>;
  listWorkers(): Promise<Array<{ name: string }>>;
  listD1Databases(): Promise<Array<{ name: string; id: string }>>;
  listR2Buckets(): Promise<Array<{ name: string }>>;
  getSecretsStatus(names: string[]): Promise<Array<{ name: string; status: "configured" | "missing" | "unknown" }>>;
}

export const manifestRelativePath = path.join(".contentforge", "production-bootstrap.json");
export const reportRelativePath = path.join(".contentforge", "production-bootstrap-report.md");
const requiredSecrets = [
  { name: "ADMIN_PASSWORD", purpose: "Admin CMS login password. Must not use a default value." },
  { name: "SESSION_SECRET", purpose: "Signed admin session secret. Use a long random value." },
];
const placeholderUuid = "00000000-0000-0000-0000-000000000000";

const stepDefinitions: Array<Omit<BootstrapStepState, "status" | "warnings" | "errors">> = [
  { id: "instance-validation", label: "Validate instance configuration", required: true, dependencies: [] },
  { id: "git-validation", label: "Validate git state", required: true, dependencies: ["instance-validation"] },
  { id: "cloudflare-cli", label: "Check Wrangler CLI", required: true, dependencies: ["git-validation"] },
  { id: "cloudflare-auth", label: "Check Cloudflare authentication", required: true, dependencies: ["cloudflare-cli"] },
  { id: "resource-plan", label: "Build production resource plan", required: true, dependencies: ["cloudflare-auth"] },
  { id: "worker", label: "Plan Worker creation or reuse", required: true, dependencies: ["resource-plan"] },
  { id: "d1", label: "Plan D1 creation or reuse", required: true, dependencies: ["resource-plan"] },
  { id: "r2", label: "Plan R2 creation or reuse", required: true, dependencies: ["resource-plan"] },
  { id: "bindings", label: "Validate Wrangler bindings", required: true, dependencies: ["worker", "d1", "r2"] },
  { id: "local-config", label: "Prepare local configuration updates", required: true, dependencies: ["bindings"] },
  { id: "environment", label: "Generate environment templates", required: true, dependencies: ["local-config"] },
  { id: "secrets", label: "Check required secrets", required: true, dependencies: ["environment"] },
  { id: "first-deploy", label: "Plan first Worker deploy", required: true, dependencies: ["secrets"] },
  { id: "database-init", label: "Plan D1 schema initialization", required: true, dependencies: ["d1"] },
  { id: "domain", label: "Check custom domain and www redirect", required: true, dependencies: ["first-deploy"] },
  { id: "seo-validation", label: "Validate robots, sitemap, and canonical", required: true, dependencies: ["domain"] },
  { id: "final-validation", label: "Write production readiness report", required: true, dependencies: ["seo-validation"] },
];

export async function runProductionBootstrapCli(rawArgs: string[]) {
  const options = parseBootstrapArgs(rawArgs);
  const adapter = createAdapter(options.adapterMode);

  if (options.recoverConfigPatch || options.rollbackConfigPatch) {
    if (!options.operationId) throw new Error("Config patch recovery/rollback requires --operation-id=<id>.");
    const result = options.recoverConfigPatch
      ? recoverProductionPatch({ operationId: options.operationId })
      : rollbackProductionConfig({ operationId: options.operationId });
    console.log(JSON.stringify({ ok: result.ok, operationId: result.operationId, errorCode: result.errorCode, message: result.message, journalDir: result.journalDir }, null, 2));
    if (!result.ok) process.exitCode = 2;
    return;
  }

  if (options.status) {
    printStatus();
    return;
  }

  if (options.doctor) {
    if (options.remote) {
      const { config } = resolveBootstrapConfig(options.overrides);
      const remoteOptions = parseRemoteExecutionArgs(rawArgs);
      remoteOptions.remote = true;
      remoteOptions.accountId = remoteOptions.accountId || options.accountId || config.cloudflareAccountId;
      const controlledAdapter = createControlledAdapter(remoteOptions.adapterMode);
      const report = await runControlledCloudflareWorkflow({ config, options: remoteOptions, adapter: controlledAdapter });
      console.log("Production Doctor Remote");
      console.log(renderControlledWorkflowReport(report));
      if (report.summary === "blocked" || report.summary === "failed") process.exitCode = 1;
      return;
    }
    await printProductionDoctor(options, adapter);
    return;
  }

  const { config, warnings } = resolveBootstrapConfig(options.overrides);

  if (options.remote || options.remotePlan || options.remoteCheck || options.execute) {
    const remoteOptions = parseRemoteExecutionArgs(rawArgs);
    remoteOptions.accountId = remoteOptions.accountId || options.accountId || config.cloudflareAccountId;
    const controlledAdapter = createControlledAdapter(remoteOptions.adapterMode);
    const report = await runControlledCloudflareWorkflow({ config, options: remoteOptions, adapter: controlledAdapter });
    console.log(renderControlledWorkflowReport(report));
    if (report.summary === "blocked" || report.summary === "failed") {
      process.exitCode = 2;
    }
    return;
  }

  const resourcePlan = await buildResourcePlan(config, adapter);
  const manifest = buildManifest(config, resourcePlan, options, warnings);

  if (options.plan || options.dryRun || !options.allowLocalWrite) {
    printPlan(manifest, resourcePlan, options);
  }

  if (options.dryRun || options.plan) return;

  if (options.nonInteractive && !options.yes) {
    throw new Error("Non-interactive production setup requires --yes plus explicit allow flags.");
  }

  if (options.adapterMode === "wrangler" && (!options.allowCreate || !options.allowDeploy)) {
    throw new Error("Wrangler Cloudflare execution requires explicit allow flags.");
  }

  if (options.allowLocalWrite) {
    writeManifestAndReport(manifest, resourcePlan);
    writeEnvironmentExamples(config);
    console.log(`PASS Production bootstrap manifest written to ${manifestRelativePath}`);
    return;
  }

  console.log("No local files were written. Re-run with --allow-local-write --yes to write the safe manifest and templates.");
}

export function parseBootstrapArgs(args: string[]): BootstrapOptions {
  const options: BootstrapOptions = {
    dryRun: false,
    plan: false,
    resume: false,
    status: false,
    doctor: false,
    nonInteractive: false,
    yes: false,
    allowCreate: false,
    allowDeploy: false,
    allowDomainChange: false,
    allowLocalWrite: false,
    writeManifest: false,
    adapterMode: "offline",
    remote: false,
    remotePlan: false,
    remoteCheck: false,
    execute: false,
    recoverConfigPatch: false,
    rollbackConfigPatch: false,
    accountId: "",
    allowCreateWorker: false,
    allowCreateD1: false,
    allowCreateR2: false,
    allowSetSecrets: false,
    allowD1Write: false,
    allowR2Probe: false,
    allowConfigPatch: false,
    allowBootstrapSeed: false,
    allowCleanup: false,
    allowProductionResources: false,
    allowDnsChange: false,
    overrides: {},
  };

  for (const arg of args) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--plan") options.plan = true;
    else if (arg === "--resume") options.resume = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--doctor") options.doctor = true;
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--remote-plan") options.remotePlan = true;
    else if (arg === "--remote-check") options.remoteCheck = true;
    else if (arg === "--execute") options.execute = true;
    else if (arg === "--recover-config-patch") options.recoverConfigPatch = true;
    else if (arg === "--rollback-config-patch") options.rollbackConfigPatch = true;
    else if (arg === "--non-interactive") options.nonInteractive = true;
    else if (arg === "--yes") options.yes = true;
    else if (arg === "--allow-create") options.allowCreate = true;
    else if (arg === "--allow-deploy") options.allowDeploy = true;
    else if (arg === "--allow-domain-change") options.allowDomainChange = true;
    else if (arg === "--allow-local-write") options.allowLocalWrite = true;
    else if (arg === "--allow-create-worker" || arg === "--allow-worker-create") options.allowCreateWorker = true;
    else if (arg === "--allow-create-d1" || arg === "--allow-d1-create") options.allowCreateD1 = true;
    else if (arg === "--allow-create-r2" || arg === "--allow-r2-create") options.allowCreateR2 = true;
    else if (arg === "--allow-set-secrets" || arg === "--allow-secret-write") options.allowSetSecrets = true;
    else if (arg === "--allow-d1-write" || arg === "--allow-d1-execute") options.allowD1Write = true;
    else if (arg === "--allow-r2-probe") options.allowR2Probe = true;
    else if (arg === "--allow-config-patch") options.allowConfigPatch = true;
    else if (arg === "--allow-bootstrap-seed") options.allowBootstrapSeed = true;
    else if (arg === "--allow-cleanup") options.allowCleanup = true;
    else if (arg === "--allow-production-resources") options.allowProductionResources = true;
    else if (arg === "--allow-dns-change") options.allowDnsChange = true;
    else if (arg === "--write-manifest") options.writeManifest = true;
    else if (arg.startsWith("--adapter=")) options.adapterMode = parseAdapterMode(arg.slice("--adapter=".length));
    else if (arg.startsWith("--mode=")) options.adapterMode = parseAdapterMode(arg.slice("--mode=".length));
    else if (arg.startsWith("--account-id=")) {
      const value = arg.slice("--account-id=".length).trim();
      options.accountId = value;
      options.overrides.cloudflareAccountId = value;
    }
    else if (arg.startsWith("--approved-plan-hash=")) options.approvedPlanHash = arg.slice("--approved-plan-hash=".length).trim();
    else if (arg.startsWith("--operation-id=")) options.operationId = arg.slice("--operation-id=".length).trim();
    else if (arg.startsWith("--reuse-worker=")) options.reuseWorker = arg.slice("--reuse-worker=".length).trim();
    else if (arg.startsWith("--reuse-d1=")) options.reuseD1 = arg.slice("--reuse-d1=".length).trim();
    else if (arg.startsWith("--reuse-r2=")) options.reuseR2 = arg.slice("--reuse-r2=".length).trim();
    else if (arg.startsWith("--step=")) options.step = parseStepId(arg.slice("--step=".length));
    else if (arg.startsWith("--from-step=")) options.fromStep = parseStepId(arg.slice("--from-step=".length));
    else if (arg.startsWith("--")) applyOverride(options, arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.plan && !options.dryRun && !options.status && !options.doctor && !options.allowLocalWrite && !options.remote && !options.remotePlan && !options.remoteCheck && !options.execute && !options.recoverConfigPatch && !options.rollbackConfigPatch) {
    options.plan = true;
  }

  return options;
}

export function resolveBootstrapConfig(overrides: Partial<BootstrapConfigInput>) {
  const siteConfig = readSiteConfigValues();
  const wrangler = readWrangler();
  const starter = readJsonSafe<Record<string, unknown>>("starter.site.json") ?? {};
  const siteName = firstString(overrides.siteName, process.env.CONTENTFORGE_SITE_NAME, siteConfig.name, starter.siteName, "ContentForge Site");
  const siteUrl = firstString(overrides.siteUrl, process.env.NEXT_PUBLIC_SITE_URL, wrangler.vars?.NEXT_PUBLIC_SITE_URL, siteConfig.url, starter.productionUrl, "");
  const canonicalHost = firstString(overrides.canonicalHost, hostFromUrl(siteUrl), siteConfig.domain, starter.domain, "");
  const siteSlug = firstString(overrides.siteSlug, process.env.CONTENTFORGE_SITE_SLUG, slugify(siteName), "");
  const workerName = firstString(overrides.workerName, process.env.CONTENTFORGE_WORKER_NAME, wrangler.name, starter.cloudflareWorkerName, siteSlug);
  const d1DatabaseName = firstString(overrides.d1DatabaseName, process.env.CONTENTFORGE_D1_DATABASE_NAME, wrangler.d1?.database_name, starter.d1DatabaseName, siteSlug);
  const d1DatabaseId = firstString(overrides.d1DatabaseId, process.env.CONTENTFORGE_D1_DATABASE_ID, wrangler.d1?.database_id, starter.d1DatabaseId, placeholderUuid);
  const r2BucketName = firstString(overrides.r2BucketName, process.env.CONTENTFORGE_R2_BUCKET_NAME, wrangler.r2?.bucket_name, starter.r2BucketName, `${siteSlug}-media`);
  const r2PublicBaseUrl = firstString(overrides.r2PublicBaseUrl, process.env.R2_PUBLIC_BASE_URL, wrangler.vars?.R2_PUBLIC_BASE_URL, `${siteUrl.replace(/\/$/, "")}/media`);
  const customDomain = firstString(overrides.customDomain, process.env.CONTENTFORGE_CUSTOM_DOMAIN, canonicalHost);
  const cloudflareAccountId = firstString(overrides.cloudflareAccountId, process.env.CLOUDFLARE_ACCOUNT_ID, "");
  const productionFallback = parseBoolean(firstString(String(overrides.productionFallback ?? ""), process.env.CONTENTFORGE_ALLOW_PRODUCTION_FALLBACK, "false"));

  const config: BootstrapConfigInput = {
    siteName,
    siteSlug,
    siteUrl,
    canonicalHost,
    workerName,
    d1DatabaseName,
    d1DatabaseId,
    r2BucketName,
    r2PublicBaseUrl,
    customDomain,
    wwwRedirect: overrides.wwwRedirect ?? true,
    cloudflareAccountId,
    productionFallback,
    deploymentEnvironment: "production",
  };

  const warnings = validateResolvedConfig(config);
  return { config, warnings };
}

export async function buildResourcePlan(config: BootstrapConfigInput, adapter: CloudflareAdapter): Promise<ResourcePlan> {
  const [workers, d1Databases, r2Buckets, secrets] = await Promise.all([
    adapter.listWorkers(),
    adapter.listD1Databases(),
    adapter.listR2Buckets(),
    adapter.getSecretsStatus(requiredSecrets.map((secret) => secret.name)),
  ]);

  const workerMatches = workers.filter((worker) => worker.name === config.workerName);
  const d1Matches = d1Databases.filter((db) => db.name === config.d1DatabaseName || (config.d1DatabaseId !== placeholderUuid && db.id === config.d1DatabaseId));
  const r2Matches = r2Buckets.filter((bucket) => bucket.name === config.r2BucketName);

  return {
    worker: planEntry(config.workerName, workerMatches.length),
    d1: { ...planEntry(config.d1DatabaseName, d1Matches.length), databaseId: d1Matches[0]?.id },
    r2: planEntry(config.r2BucketName, r2Matches.length),
    domain: {
      apex: config.customDomain,
      www: config.wwwRedirect ? `www.${config.customDomain.replace(/^www\./, "")}` : "",
      canonical: config.canonicalHost,
      currentDnsState: "not-checked",
      desiredRedirect: config.wwwRedirect ? "www -> apex permanent redirect" : "none",
      action: config.customDomain ? "manual-action-required" : "skip",
    },
    secrets: requiredSecrets.map((secret) => {
      const found = secrets.find((item) => item.name === secret.name);
      return {
        name: secret.name,
        purpose: secret.purpose,
        status: found?.status ?? "unknown",
        command: `npx wrangler secret put ${secret.name}`,
      };
    }),
  };
}

export function buildManifest(
  config: BootstrapConfigInput,
  resourcePlan: ResourcePlan,
  options: BootstrapOptions,
  configWarnings: string[],
): ProductionBootstrapManifest {
  const now = new Date().toISOString();
  const steps = stepDefinitions.map<BootstrapStepState>((step) => {
    const warnings: string[] = [];
    const errors: string[] = [];
    let status: ProductionBootstrapStatus = "ready";
    let suggestedNextAction = "Review the generated plan.";

    if (step.id === "cloudflare-auth" && options.adapterMode !== "wrangler") {
      status = "manual-action-required";
      suggestedNextAction = "Run `wrangler login` before real resource creation.";
    }
    if (step.id === "worker" && resourcePlan.worker.action !== "skip") status = "manual-action-required";
    if (step.id === "d1" && resourcePlan.d1.action !== "skip") status = "manual-action-required";
    if (step.id === "r2" && resourcePlan.r2.action !== "skip") status = "manual-action-required";
    if (step.id === "domain" && resourcePlan.domain.action === "manual-action-required") status = "manual-action-required";
    if (step.id === "secrets" && resourcePlan.secrets.some((secret) => secret.status !== "configured")) status = "manual-action-required";
    if (step.id === "seo-validation" && configWarnings.length > 0) {
      status = "blocked";
      errors.push(...configWarnings);
      suggestedNextAction = "Replace placeholder URLs and invalid production config before deploy.";
    }

    return {
      ...step,
      status,
      warnings,
      errors,
      suggestedNextAction,
    };
  });

  return {
    schemaVersion: 1,
    frameworkVersion: readFrameworkVersion(),
    instanceName: config.siteName,
    instancePath: projectRoot,
    generatedAt: now,
    updatedAt: now,
    environment: "production",
    siteUrl: config.siteUrl,
    canonicalHost: config.canonicalHost,
    workerName: config.workerName,
    d1DatabaseName: config.d1DatabaseName,
    d1DatabaseId: config.d1DatabaseId,
    r2BucketName: config.r2BucketName,
    r2PublicBaseUrl: config.r2PublicBaseUrl,
    customDomain: config.customDomain,
    wwwDomain: config.wwwRedirect ? `www.${config.customDomain.replace(/^www\./, "")}` : "",
    resourceCreationMode: options.dryRun ? "dry-run" : options.adapterMode,
    steps,
    lastSuccessfulStep: null,
    warnings: configWarnings,
    manualActions: collectManualActions(resourcePlan),
    completed: false,
  };
}

export async function printProductionDoctor(options: BootstrapOptions, adapter: CloudflareAdapter) {
  const { config, warnings } = resolveBootstrapConfig(options.overrides);
  const auth = await adapter.getAuthStatus();
  const plan = await buildResourcePlan(config, adapter);
  const workingTreeStatus = await gitStatus();
  const checks = [
    doctorCheck("Local", "Node version", Number(process.versions.node.split(".")[0]) >= 20, process.versions.node, "Install Node 20+."),
    doctorCheck("Local", "Git working tree", workingTreeStatus === "", workingTreeStatus === "" ? "Clean." : workingTreeStatus, "Commit or stash local changes."),
    doctorCheck("Local", "Site URL is production-safe", warnings.length === 0, warnings.length ? warnings.join("; ") : config.siteUrl, "Replace example.com/localhost and disable fallback."),
    doctorCheck("Local", "Production fallback disabled", !config.productionFallback, String(config.productionFallback), "Set allowProductionFallback=false."),
    {
      section: "Cloudflare",
      status: auth.authenticated ? "PASS" : adapter.mode === "wrangler" ? "MANUAL ACTION" : "SKIP",
      label: "Authentication",
      detail: auth.detail,
      nextAction: auth.authenticated ? "" : "Run `wrangler login` before real setup.",
    },
    {
      section: "Cloudflare",
      status: plan.worker.state === "ambiguous" ? "FAIL" : "ACTION REQUIRED",
      label: "Worker plan",
      detail: `${plan.worker.proposedName}: ${plan.worker.state}`,
      nextAction: plan.worker.reason,
    },
    {
      section: "Cloudflare",
      status: plan.d1.state === "ambiguous" ? "FAIL" : "ACTION REQUIRED",
      label: "D1 plan",
      detail: `${plan.d1.proposedName}: ${plan.d1.state}`,
      nextAction: plan.d1.reason,
    },
    {
      section: "Cloudflare",
      status: plan.r2.state === "ambiguous" ? "FAIL" : "ACTION REQUIRED",
      label: "R2 plan",
      detail: `${plan.r2.proposedName}: ${plan.r2.state}`,
      nextAction: plan.r2.reason,
    },
    {
      section: "Cloudflare",
      status: plan.secrets.every((secret) => secret.status === "configured") ? "PASS" : "MANUAL ACTION",
      label: "Secrets",
      detail: plan.secrets.map((secret) => `${secret.name}=${secret.status}`).join(", "),
      nextAction: "Set missing secrets with Wrangler; values are never printed.",
    },
    {
      section: "SEO",
      status: warnings.length === 0 ? "PASS" : "ACTION REQUIRED",
      label: "Canonical/robots/sitemap readiness",
      detail: warnings.length ? warnings.join("; ") : config.canonicalHost,
      nextAction: warnings.length ? "Fix URL config before production deploy." : "",
    },
    {
      section: "SEO",
      status: plan.domain.action === "manual-action-required" ? "MANUAL ACTION" : "PASS",
      label: "Custom domain and www redirect",
      detail: plan.domain.action === "manual-action-required"
        ? `custom domain ${plan.domain.apex}; www redirect ${plan.domain.desiredRedirect}; DNS not checked in ${adapter.mode} mode.`
        : "No custom domain action required.",
      nextAction: plan.domain.action === "manual-action-required" ? "Verify DNS, custom domain binding, and redirect after real setup." : "",
    },
    {
      section: "Content",
      status: "PASS",
      label: "Published content contract",
      detail: "P0 published-only contract remains active; articles=0 is accepted for bootstrap.",
      nextAction: "",
    },
  ] satisfies ProductionDoctorCheck[];

  printDoctorChecks(checks);
}

type ProductionDoctorCheck = {
  section: string;
  status: ProductionDoctorStatus;
  label: string;
  detail: string;
  nextAction: string;
};

function createAdapter(mode: ResourceCreationMode): CloudflareAdapter {
  if (mode === "mock") {
    return new StaticAdapter("mock", {
      workers: [{ name: "existing-worker" }],
      d1: [{ name: "existing-db", id: "11111111-1111-1111-1111-111111111111" }],
      r2: [{ name: "existing-media" }],
      secrets: [],
      auth: { authenticated: true, accountId: "mock-account", status: "authenticated", detail: "Mock Cloudflare account." },
    });
  }
  return new StaticAdapter(mode, {
    workers: [],
    d1: [],
    r2: [],
    secrets: [],
    auth: { authenticated: false, status: "unknown", detail: `${mode} adapter does not contact Cloudflare.` },
  });
}

class StaticAdapter implements CloudflareAdapter {
  constructor(
    public mode: ResourceCreationMode,
    private fixtures: {
      auth: Awaited<ReturnType<CloudflareAdapter["getAuthStatus"]>>;
      workers: Array<{ name: string }>;
      d1: Array<{ name: string; id: string }>;
      r2: Array<{ name: string }>;
      secrets: Array<{ name: string; status: "configured" | "missing" | "unknown" }>;
    },
  ) {}

  async getAuthStatus() {
    return this.fixtures.auth;
  }

  async listWorkers() {
    return this.fixtures.workers;
  }

  async listD1Databases() {
    return this.fixtures.d1;
  }

  async listR2Buckets() {
    return this.fixtures.r2;
  }

  async getSecretsStatus(names: string[]) {
    return names.map((name) => this.fixtures.secrets.find((secret) => secret.name === name) ?? { name, status: "unknown" as const });
  }
}

function printStatus() {
  const manifest = readManifest();
  if (!manifest) {
    console.log("Production bootstrap status: not initialized");
    console.log(`Manifest path: ${manifestRelativePath}`);
    return;
  }

  console.log("Production bootstrap status");
  console.log(`Instance: ${manifest.instanceName}`);
  console.log(`Completed: ${manifest.completed}`);
  console.log(`Last successful step: ${manifest.lastSuccessfulStep ?? "none"}`);
  console.log(`Updated: ${manifest.updatedAt}`);
  for (const step of manifest.steps) {
    console.log(`- ${step.id}: ${step.status}`);
  }
}

function printPlan(manifest: ProductionBootstrapManifest, resourcePlan: ResourcePlan, options: BootstrapOptions) {
  console.log(options.dryRun ? "Production Bootstrap Dry Run" : "Production Bootstrap Plan");
  console.log(`Mode: ${manifest.resourceCreationMode}`);
  console.log(`Instance: ${manifest.instanceName}`);
  console.log(`Site URL: ${manifest.siteUrl}`);
  console.log(`Worker: ${resourcePlan.worker.proposedName} (${resourcePlan.worker.state}, ${resourcePlan.worker.action})`);
  console.log(`D1: ${resourcePlan.d1.proposedName} (${resourcePlan.d1.state}, ${resourcePlan.d1.action})`);
  console.log(`R2: ${resourcePlan.r2.proposedName} (${resourcePlan.r2.state}, ${resourcePlan.r2.action})`);
  console.log(`Domain: ${resourcePlan.domain.apex || "not configured"} (${resourcePlan.domain.action})`);
  console.log("Secrets:");
  for (const secret of resourcePlan.secrets) console.log(`- ${secret.name}: ${secret.status}; ${secret.command}`);
  console.log("Steps:");
  for (const step of manifest.steps) console.log(`- ${step.id}: ${step.status} -> ${step.suggestedNextAction ?? ""}`);
  if (manifest.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of manifest.warnings) console.log(`- ${warning}`);
  }
  console.log("Dry-run safety: no Worker, D1, R2, secrets, DNS, deploy, or local files are changed.");
}

function writeManifestAndReport(manifest: ProductionBootstrapManifest, resourcePlan: ResourcePlan) {
  const manifestPath = path.join(projectRoot, manifestRelativePath);
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const reportPath = path.join(projectRoot, reportRelativePath);
  writeFileSync(reportPath, renderReport(manifest, resourcePlan), "utf8");
}

function writeEnvironmentExamples(config: BootstrapConfigInput) {
  const envExample = [
    "ADMIN_PASSWORD=",
    "SESSION_SECRET=",
    `NEXT_PUBLIC_SITE_URL=${config.siteUrl}`,
    `R2_PUBLIC_BASE_URL=${config.r2PublicBaseUrl}`,
    "",
  ].join("\n");
  const devVarsExample = [
    "# Safe template only. Do not commit real secret values.",
    "ADMIN_PASSWORD=",
    "SESSION_SECRET=",
    `NEXT_PUBLIC_SITE_URL=${config.siteUrl}`,
    `R2_PUBLIC_BASE_URL=${config.r2PublicBaseUrl}`,
    "",
  ].join("\n");
  writeFileSync(path.join(projectRoot, "env.example"), envExample, "utf8");
  writeFileSync(path.join(projectRoot, ".dev.vars.example"), devVarsExample, "utf8");
}

function renderReport(manifest: ProductionBootstrapManifest, plan: ResourcePlan) {
  return `# Production Bootstrap Report

Generated: ${manifest.updatedAt}
Instance: ${manifest.instanceName}
Mode: ${manifest.resourceCreationMode}

## Resources

- Worker: ${plan.worker.proposedName} (${plan.worker.state})
- D1: ${plan.d1.proposedName} (${plan.d1.state})
- R2: ${plan.r2.proposedName} (${plan.r2.state})
- Domain: ${plan.domain.apex || "not configured"}

## Manual Actions

${manifest.manualActions.map((action) => `- ${action}`).join("\n") || "- None"}

## Secret Safety

Secret values are never stored in this manifest or report.
`;
}

function readManifest(): ProductionBootstrapManifest | null {
  const filePath = path.join(projectRoot, manifestRelativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as ProductionBootstrapManifest;
}

function planEntry(name: string, matchCount: number): ResourcePlanEntry {
  if (matchCount === 0) return { proposedName: name, state: "new", action: "create", reason: "No matching resource was found." };
  if (matchCount === 1) return { proposedName: name, state: "existing", action: "reuse", reason: "Matching resource exists; confirm reuse before taking ownership." };
  return { proposedName: name, state: "ambiguous", action: "manual-action-required", reason: "Multiple matching resources found; choose a specific resource or rename." };
}

function collectManualActions(plan: ResourcePlan) {
  return [
    `Confirm Worker action for ${plan.worker.proposedName}.`,
    `Confirm D1 action for ${plan.d1.proposedName}.`,
    `Confirm R2 action for ${plan.r2.proposedName}.`,
    ...plan.secrets.filter((secret) => secret.status !== "configured").map((secret) => `Set secret ${secret.name} with ${secret.command}.`),
    plan.domain.action === "manual-action-required" ? `Verify custom domain ${plan.domain.apex} and ${plan.domain.desiredRedirect}.` : "",
  ].filter(Boolean);
}

function validateResolvedConfig(config: BootstrapConfigInput) {
  const warnings: string[] = [];
  if (!isValidResourceName(config.workerName)) warnings.push(`Invalid Worker name: ${config.workerName}`);
  if (!isValidResourceName(config.d1DatabaseName)) warnings.push(`Invalid D1 database name: ${config.d1DatabaseName}`);
  if (!isValidResourceName(config.r2BucketName)) warnings.push(`Invalid R2 bucket name: ${config.r2BucketName}`);
  if (config.siteUrl.includes("example.com")) warnings.push("Production site URL still uses example.com.");
  if (/localhost|127\.0\.0\.1/.test(config.siteUrl)) warnings.push("Production site URL uses localhost.");
  if (!config.siteUrl.startsWith("https://")) warnings.push("Production site URL must use HTTPS.");
  if (config.d1DatabaseId === placeholderUuid) warnings.push("D1 database ID is still the placeholder UUID.");
  if (config.d1DatabaseId && config.d1DatabaseId !== placeholderUuid && !/^[0-9a-f-]{36}$/i.test(config.d1DatabaseId)) warnings.push("D1 database ID is not a UUID.");
  if (config.productionFallback) warnings.push("Production fallback must be disabled.");
  return warnings;
}

function isValidResourceName(value: string) {
  return /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(value);
}

function readWrangler() {
  try {
    const config = readJsoncFile<{
      name?: string;
      d1_databases?: Array<{ binding?: string; database_name?: string; database_id?: string }>;
      r2_buckets?: Array<{ binding?: string; bucket_name?: string }>;
      vars?: Record<string, string>;
    }>(path.join(projectRoot, "wrangler.jsonc"));
    return {
      name: config.name,
      d1: config.d1_databases?.find((item) => item.binding === "DB") ?? config.d1_databases?.[0],
      r2: config.r2_buckets?.find((item) => item.binding === "MEDIA_BUCKET") ?? config.r2_buckets?.[0],
      vars: config.vars ?? {},
    };
  } catch {
    return { name: "", d1: undefined, r2: undefined, vars: {} };
  }
}

function readSiteConfigValues() {
  const text = readFileSafe("src/instance/site.config.ts") || readFileSafe("src/config/site.config.ts") || "";
  return {
    name: matchStringProperty(text, "name"),
    domain: matchStringProperty(text, "domain"),
    url: matchStringProperty(text, "url"),
  };
}

function readFrameworkVersion() {
  return String(readJsonSafe<Record<string, unknown>>("framework.version.json")?.version ?? readFileSafe(".contentforge-version")?.trim() ?? "unknown");
}

function readJsonSafe<T>(relativePath: string): T | null {
  const text = readFileSafe(relativePath);
  if (!text) return null;
  return JSON.parse(relativePath.endsWith(".jsonc") ? stripJsonComments(text) : text) as T;
}

function readFileSafe(relativePath: string) {
  const filePath = path.join(projectRoot, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function matchStringProperty(text: string, key: string) {
  return text.match(new RegExp(`\\b${key}:\\s*["']([^"']*)["']`))?.[1] ?? "";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function hostFromUrl(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 58) || "contentforge-site";
}

function parseBoolean(value: string) {
  return ["1", "true", "yes"].includes(value.toLowerCase());
}

function parseAdapterMode(value: string): ResourceCreationMode {
  if (value === "real") return "wrangler";
  if (["offline", "mock", "dry-run", "wrangler"].includes(value)) return value as ResourceCreationMode;
  throw new Error(`Invalid adapter mode: ${value}`);
}

function parseStepId(value: string): ProductionBootstrapStepId {
  if (stepDefinitions.some((step) => step.id === value)) return value as ProductionBootstrapStepId;
  throw new Error(`Invalid bootstrap step: ${value}`);
}

function applyOverride(options: BootstrapOptions, arg: string) {
  const [rawKey, ...rest] = arg.slice(2).split("=");
  const value = rest.join("=");
  const map: Record<string, keyof BootstrapConfigInput> = {
    "site-name": "siteName",
    "site-slug": "siteSlug",
    "site-url": "siteUrl",
    "canonical-host": "canonicalHost",
    "worker-name": "workerName",
    "d1-database-name": "d1DatabaseName",
    "d1-database-id": "d1DatabaseId",
    "r2-bucket-name": "r2BucketName",
    "r2-public-base-url": "r2PublicBaseUrl",
    "custom-domain": "customDomain",
    "cloudflare-account-id": "cloudflareAccountId",
  };
  const key = map[rawKey];
  if (!key || !value) throw new Error(`Unknown or empty argument: ${arg}`);
  (options.overrides as Record<string, string>)[key] = value;
}

async function gitStatus() {
  const result = await runCommand(process.platform === "win32" ? "git.exe" : "git", ["status", "--porcelain"]);
  return result.code === 0 ? result.stdout.trim() : "Git repository not initialized or git status unavailable.";
}

function doctorCheck(section: string, label: string, passed: boolean, detail: string, nextAction: string): ProductionDoctorCheck {
  return { section, label, status: passed ? "PASS" : "ACTION REQUIRED", detail, nextAction: passed ? "" : nextAction };
}

function printDoctorChecks(checks: ProductionDoctorCheck[]) {
  console.log("Production Doctor");
  for (const check of checks) {
    console.log(`[${check.section}] ${check.status} ${check.label} - ${check.detail}`);
    if (check.nextAction) console.log(`  Next: ${check.nextAction}`);
  }
  const fail = checks.filter((check) => check.status === "FAIL").length;
  const action = checks.filter((check) => check.status === "ACTION REQUIRED" || check.status === "MANUAL ACTION").length;
  console.log(`Summary: ${fail} fail, ${action} action required`);
  if (fail > 0) process.exitCode = 1;
}

export async function runProductionCommand(command: "setup" | "doctor" | "status", args: string[]) {
  if (command === "doctor") return runProductionBootstrapCli(["--doctor", ...args]);
  if (command === "status") return runProductionBootstrapCli(["--status", ...args]);
  return runProductionBootstrapCli(args);
}
