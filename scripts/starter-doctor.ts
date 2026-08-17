import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { siteConfig } from "../src/config/site.config";
import { resolveCanonicalSiteUrl } from "../src/lib/site-url";
import { checkSitemapUrl } from "../tools/seo/check-sitemap";

type Status = "PASS" | "WARN" | "FAIL";

type Check = {
  status: Status;
  label: string;
  detail: string;
  action?: string;
};

type CommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

type PackageJson = {
  name?: string;
};

type FrameworkVersion = {
  name?: string;
  version?: string;
};

type FrameworkManifest = {
  name?: string;
  type?: string;
  capabilities?: unknown;
};

type SiteThemeConfig = {
  theme?: string;
  name?: string;
  version?: string;
};

type ThemeManifest = {
  version?: string;
};

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

type WranglerConfig = {
  name?: string;
  assets?: {
    binding?: string;
    run_worker_first?: boolean;
  };
  d1_databases?: Array<{
    binding?: string;
    database_name?: string;
    database_id?: string;
  }>;
  r2_buckets?: Array<{
    binding?: string;
    bucket_name?: string;
  }>;
  vars?: Record<string, string>;
};

type DoctorOptions = {
  productionUrl?: string;
};

const root = process.cwd();
const placeholderUuid = "00000000-0000-0000-0000-000000000000";
const oldRemoteMarkers = ["content-site-starter", "contentforge-starter", "starter"];
const defaultIdentityValues = new Set(["contentforge-starter", "starter-default", "legacy-default", "https://example.com"]);
const secretMarkers = ["ADMIN_PASSWORD", "SESSION_SECRET"];
const requiredIgnorePatterns = ["articles/", "content-import/", "content/import/", ".tmp-import-verify-*", "NUL"];
const forbiddenTrackedPrefixes = ["articles/", "content-import/", "content/import/", ".tmp-import-verify-"];
const forbiddenTrackedFiles = new Set(["NUL"]);
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const checks: Check[] = [];
  const packageJson = readJson<PackageJson>("package.json");
  const frameworkVersion = readJson<FrameworkVersion>("framework.version.json");
  const frameworkManifest = readJson<FrameworkManifest>("framework.manifest.json");
  const isFrameworkMode = frameworkManifest?.type === "framework";
  const siteInstanceVersion = readText(".contentforge-version")?.trim();
  const starterManifest = readJson<Record<string, unknown>>("starter.site.json");
  const siteThemeConfig = readJson<SiteThemeConfig>("site.theme.json");
  const wranglerConfig = readJsonc<WranglerConfig>("wrangler.jsonc");
  const gitRemote = await getGitRemote();
  const trackedFiles = await getTrackedFiles();
  const gitignoreLines = readLines(".gitignore");

  checks.push(...checkGitSafety(gitRemote));
  if (isFrameworkMode) {
    checks.push(...checkFrameworkVersion(frameworkVersion));
    checks.push(...checkFrameworkManifest(frameworkManifest));
    checks.push(...checkFrameworkMode());
    checks.push(...checkUrlConsistency(wranglerConfig, false));
  } else {
    checks.push(...checkSiteInstanceMode(siteInstanceVersion, starterManifest, siteThemeConfig, packageJson));
    checks.push(...checkProjectIdentity(packageJson, wranglerConfig));
    checks.push(...checkCloudflareConfig(wranglerConfig, { deploymentStrict: false }));
    checks.push(...checkUrlConsistency(wranglerConfig, true));
  }
  checks.push(...checkIgnoredFiles(gitignoreLines));
  checks.push(...checkEnvironmentSafety(trackedFiles));
  checks.push(...checkSitemapRuntimeStatic());
  if (options.productionUrl) {
    checks.push(await checkProductionSitemap(options.productionUrl));
  }

  console.log("Starter Doctor");
  console.log(`Mode: ${isFrameworkMode ? "Framework Mode" : "Site Instance Mode"}`);
  console.log("");
  for (const check of checks) printCheck(check);
  printSummary(checks);

  if (checks.some((check) => check.status === "FAIL")) {
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): DoctorOptions {
  const productionUrl = args.find((arg) => arg.startsWith("--production-url="))?.slice("--production-url=".length).trim();
  return { productionUrl };
}

function checkFrameworkManifest(frameworkManifest: FrameworkManifest | null): Check[] {
  if (!frameworkManifest) {
    return [
      {
        status: "FAIL",
        label: "Framework manifest file",
        detail: "framework.manifest.json was not found or could not be read.",
        action: "Restore framework.manifest.json before using this starter as a Framework template.",
      },
    ];
  }

  const checks: Check[] = [
    {
      status: frameworkManifest.name ? "PASS" : "FAIL",
      label: "Framework manifest name",
      detail: frameworkManifest.name || "Missing name.",
      action: frameworkManifest.name ? undefined : "Add name to framework.manifest.json.",
    },
    {
      status: frameworkManifest.type === "framework" ? "PASS" : "FAIL",
      label: "Framework manifest type",
      detail: frameworkManifest.type || "Missing type.",
      action: frameworkManifest.type === "framework" ? undefined : "Set framework.manifest.json type to framework.",
    },
    {
      status: Array.isArray(frameworkManifest.capabilities) ? "PASS" : "FAIL",
      label: "Framework manifest capabilities",
      detail: Array.isArray(frameworkManifest.capabilities) ? `${frameworkManifest.capabilities.length} capabilities found.` : "Missing capabilities array.",
      action: Array.isArray(frameworkManifest.capabilities) ? undefined : "Set framework.manifest.json capabilities to an array.",
    },
  ];

  return checks;
}

function checkFrameworkMode(): Check[] {
  return [
    {
      status: existsSync(path.join(root, "src/instance"))
        ? "PASS"
        : "FAIL",
      label: "Instance config layer",
      detail: existsSync(path.join(root, "src/instance"))
        ? "src/instance detected."
        : "src/instance missing.",
      action: existsSync(path.join(root, "src/instance"))
        ? undefined
        : "Create src/instance for framework site configuration injection.",
    },
    {
      status: existsSync(path.join(root, "frontend-library"))
        ? "PASS"
        : "WARN",
      label: "Frontend library",
      detail: "frontend-library detected.",
    },
  ];
}

function checkSiteInstanceMode(
  siteInstanceVersion: string | null | undefined,
  starterManifest: Record<string, unknown> | null,
  siteThemeConfig: SiteThemeConfig | null,
  packageJson: PackageJson | null,
): Check[] {
  const checks: Check[] = [];
  const validSiteVersion = Boolean(siteInstanceVersion && versionPattern.test(siteInstanceVersion));
  const themeName = siteThemeConfig?.theme ?? siteThemeConfig?.name;
  const themeManifest = themeName ? readJson<ThemeManifest>(path.join("frontend-library", themeName, "theme.json")) : null;
  const buildTimeThemeConfig = readBuildTimeThemeConfig();

  checks.push({
    status: siteInstanceVersion ? (validSiteVersion ? "PASS" : "WARN") : "WARN",
    label: "Site instance version file",
    detail: siteInstanceVersion || ".contentforge-version was not found or is empty.",
    action: siteInstanceVersion
      ? validSiteVersion
        ? undefined
        : "Set .contentforge-version to a semver value such as 3.0.0-alpha.3."
      : "Add .contentforge-version when this site is created or upgraded from ContentForge.",
  });

  checks.push({
    status: starterManifest ? "PASS" : "FAIL",
    label: "Starter site manifest",
    detail: starterManifest ? "starter.site.json loaded." : "starter.site.json was not found or could not be read.",
    action: starterManifest ? undefined : "Restore starter.site.json or run the instance creation workflow again.",
  });

  checks.push({
    status: siteThemeConfig ? "PASS" : "FAIL",
    label: "Site theme config",
    detail: siteThemeConfig ? "site.theme.json loaded." : "site.theme.json was not found or could not be read.",
    action: siteThemeConfig ? undefined : "Create site.theme.json by running npm run create-site or create-instance.",
  });

  checks.push({
    status: themeName ? "PASS" : "FAIL",
    label: "Site theme name",
    detail: themeName || "Missing theme/name field in site.theme.json.",
    action: themeName ? undefined : "Set site.theme.json theme or name to a registered theme key.",
  });

  checks.push(...checkSiteThemeVersion(siteThemeConfig, buildTimeThemeConfig, themeManifest, themeName));

  checks.push({
    status: packageJson ? "PASS" : "FAIL",
    label: "package.json file",
    detail: packageJson ? "package.json loaded." : "package.json was not found or could not be read.",
    action: packageJson ? undefined : "Restore package.json before running project checks.",
  });

  return checks;
}

function checkSiteThemeVersion(
  siteThemeConfig: SiteThemeConfig | null,
  buildTimeThemeConfig: SiteThemeConfig | null,
  themeManifest: ThemeManifest | null,
  themeName: string | undefined,
): Check[] {
  const checks: Check[] = [];
  const siteVersion = siteThemeConfig?.version;
  const buildTimeVersion = buildTimeThemeConfig?.version;
  const manifestVersion = themeManifest?.version;

  checks.push({
    status: themeManifest ? "PASS" : themeName ? "FAIL" : "WARN",
    label: "Theme manifest file",
    detail: themeManifest ? `frontend-library/${themeName}/theme.json loaded.` : "Theme manifest was not found or could not be read.",
    action: themeManifest ? undefined : "Confirm the selected theme package was copied into frontend-library.",
  });

  checks.push({
    status: buildTimeThemeConfig ? "PASS" : "WARN",
    label: "Build-time theme config",
    detail: buildTimeThemeConfig
      ? `src/instance/theme.config.ts uses ${buildTimeThemeConfig.name ?? "unknown"} ${buildTimeVersion ?? "without version"}.`
      : "src/instance/theme.config.ts was not found or could not be parsed.",
    action: buildTimeThemeConfig ? undefined : "Regenerate the site with create-instance so build-time theme config is created.",
  });

  if (!siteVersion) {
    checks.push({
      status: "WARN",
      label: "Site theme version",
      detail: "Missing version field in site.theme.json.",
      action: "Set site.theme.json version to the selected theme version.",
    });
    return checks;
  }

  const mismatches: string[] = [];
  if (manifestVersion && siteVersion !== manifestVersion) {
    mismatches.push(`theme.json=${manifestVersion}`);
  }
  if (buildTimeVersion && siteVersion !== buildTimeVersion) {
    mismatches.push(`theme.config.ts=${buildTimeVersion}`);
  }

  checks.push({
    status: mismatches.length === 0 ? "PASS" : "WARN",
    label: "Site theme version",
    detail:
      mismatches.length === 0
        ? `${siteVersion} matches site.theme.json, theme.config.ts, and theme.json.`
        : `site.theme.json=${siteVersion}; mismatch with ${mismatches.join(", ")}.`,
    action: mismatches.length === 0 ? undefined : "Regenerate theme config or align site.theme.json with the selected theme manifest.",
  });

  return checks;
}

function checkFrameworkVersion(frameworkVersion: FrameworkVersion | null): Check[] {
  if (!frameworkVersion) {
    return [
      {
        status: "FAIL",
        label: "Framework version file",
        detail: "framework.version.json was not found or could not be read.",
        action: "Restore framework.version.json before using this starter as a Framework template.",
      },
    ];
  }

  const checks: Check[] = [
    {
      status: frameworkVersion.name === "ContentForge" ? "PASS" : "FAIL",
      label: "Framework version name",
      detail: frameworkVersion.name || "Missing name.",
      action: frameworkVersion.name === "ContentForge" ? undefined : "Set framework.version.json name to ContentForge.",
    },
    {
      status: frameworkVersion.version && versionPattern.test(frameworkVersion.version) ? "PASS" : "FAIL",
      label: "Framework version value",
      detail: frameworkVersion.version || "Missing version.",
      action: frameworkVersion.version && versionPattern.test(frameworkVersion.version) ? undefined : "Set framework.version.json version to a semver value such as 3.0.0-alpha.3.",
    },
  ];

  return checks;
}

function compareVersions(left: string, right: string) {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  if (!leftVersion || !rightVersion) return 0;

  for (const part of ["major", "minor", "patch"] as const) {
    if (leftVersion[part] !== rightVersion[part]) {
      return leftVersion[part] < rightVersion[part] ? -1 : 1;
    }
  }

  const leftPrerelease = leftVersion.prerelease;
  const rightPrerelease = rightVersion.prerelease;
  if (leftPrerelease.length === 0 && rightPrerelease.length === 0) return 0;
  if (leftPrerelease.length === 0) return 1;
  if (rightPrerelease.length === 0) return -1;

  const length = Math.max(leftPrerelease.length, rightPrerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftPrerelease[index];
    const rightPart = rightPrerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    const leftNumber = Number(leftPart);
    const rightNumber = Number(rightPart);
    const leftIsNumber = Number.isInteger(leftNumber) && String(leftNumber) === leftPart;
    const rightIsNumber = Number.isInteger(rightNumber) && String(rightNumber) === rightPart;

    if (leftIsNumber && rightIsNumber) return leftNumber < rightNumber ? -1 : 1;
    if (leftIsNumber) return -1;
    if (rightIsNumber) return 1;
    return leftPart < rightPart ? -1 : 1;
  }

  return 0;
}

function parseVersion(version: string): ParsedVersion | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

function checkGitSafety(remoteUrl: string | null): Check[] {
  const checks: Check[] = [
    {
      status: "PASS",
      label: "Current folder path",
      detail: root,
    },
  ];

  if (!remoteUrl) {
    checks.push({
      status: "WARN",
      label: "Git remote URL",
      detail: "No origin remote found.",
      action: "Add the new site's GitHub origin before pushing.",
    });
    return checks;
  }

  const lowerRemote = remoteUrl.toLowerCase();
  const oldMarker = oldRemoteMarkers.find((marker) => lowerRemote.includes(marker));

  checks.push({
    status: oldMarker ? "WARN" : "PASS",
    label: "Git remote URL",
    detail: remoteUrl,
    action: oldMarker ? "Remove the old origin and add the new site's GitHub repo before pushing." : undefined,
  });

  return checks;
}

function checkProjectIdentity(packageJson: PackageJson | null, wranglerConfig: WranglerConfig | null): Check[] {
  const packageName = packageJson?.name;
  const wranglerName = wranglerConfig?.name;

  return [
    checkRequiredValue("package.json name", packageName, "Set a unique package name for the copied site."),
    checkRequiredValue("wrangler.jsonc name", wranglerName, "Set the Cloudflare Worker name for the copied site."),
    checkDefaultValue("package.json name default", packageName, "Change package.json name from the starter default."),
    checkDefaultValue("wrangler.jsonc name default", wranglerName, "Change wrangler.jsonc name from the starter default."),
    checkDefaultValue("site config name", siteConfig.name, "Change src/config/site.config.ts name for the copied site."),
    checkDefaultValue("site config domain", siteConfig.domain, "Change src/config/site.config.ts domain for the copied site."),
    checkDefaultValue("site config url", siteConfig.url, "Change src/config/site.config.ts url for the copied site."),
  ];
}

function checkCloudflareConfig(wranglerConfig: WranglerConfig | null, options: { deploymentStrict: boolean }): Check[] {
  if (!wranglerConfig) {
    return [
      {
        status: "FAIL",
        label: "Cloudflare config",
        detail: "wrangler.jsonc was not found or could not be read.",
        action: "Restore wrangler.jsonc before deploying.",
      },
    ];
  }

  const d1 = wranglerConfig.d1_databases?.[0];
  const r2 = wranglerConfig.r2_buckets?.[0];
  const nextPublicSiteUrl = wranglerConfig.vars?.NEXT_PUBLIC_SITE_URL;

  return [
    {
      status: d1?.binding === "DB" ? "PASS" : "FAIL",
      label: "D1 binding",
      detail: d1?.binding ? `Found ${d1.binding}` : "Missing D1 binding.",
      action: d1?.binding === "DB" ? undefined : "Keep the D1 binding named DB unless runtime code is changed too.",
    },
    {
      status: r2?.binding === "MEDIA_BUCKET" ? "PASS" : "FAIL",
      label: "R2 binding",
      detail: r2?.binding ? `Found ${r2.binding}` : "Missing R2 binding.",
      action: r2?.binding === "MEDIA_BUCKET" ? undefined : "Keep the R2 binding named MEDIA_BUCKET unless runtime code is changed too.",
    },
    {
      status: wranglerConfig.assets?.run_worker_first === true ? "PASS" : "FAIL",
      label: "assets.run_worker_first",
      detail: wranglerConfig.assets?.run_worker_first === true ? "true" : "Not true.",
      action: wranglerConfig.assets?.run_worker_first === true ? undefined : "Set assets.run_worker_first to true so OpenNext routes handle / and /sitemap.xml.",
    },
    {
      status: d1?.database_id && d1.database_id !== placeholderUuid ? "PASS" : options.deploymentStrict ? "FAIL" : "WARN",
      label: "D1 database_id",
      detail: d1?.database_id || "Missing database_id.",
      action: d1?.database_id && d1.database_id !== placeholderUuid ? undefined : "Use the real D1 database_id for the copied site.",
    },
    {
      status: nextPublicSiteUrl && nextPublicSiteUrl !== "https://example.com" ? "PASS" : options.deploymentStrict ? "FAIL" : "WARN",
      label: "NEXT_PUBLIC_SITE_URL",
      detail: nextPublicSiteUrl || "Missing NEXT_PUBLIC_SITE_URL in wrangler.jsonc vars.",
      action: nextPublicSiteUrl && nextPublicSiteUrl !== "https://example.com" ? undefined : "Set NEXT_PUBLIC_SITE_URL to the production canonical URL before deployment.",
    },
  ];
}

function checkUrlConsistency(wranglerConfig: WranglerConfig | null, deploymentRelevant: boolean): Check[] {
  const checks: Check[] = [];
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || wranglerConfig?.vars?.NEXT_PUBLIC_SITE_URL;
  const configUrl = siteConfig.url;
  const resolved = resolveCanonicalSiteUrl();
  const configuredRuntime = (siteConfig as unknown as { runtime?: { allowProductionFallback?: boolean } }).runtime;
  const allowProductionFallback = process.env.CONTENTFORGE_ALLOW_PRODUCTION_FALLBACK ?? String(configuredRuntime?.allowProductionFallback ?? process.env.NODE_ENV !== "production");
  const mismatch = Boolean(envUrl && configUrl && normalizeComparableUrl(envUrl) !== normalizeComparableUrl(configUrl));

  checks.push({
    status: resolved.warnings.length === 0 ? "PASS" : deploymentRelevant ? "WARN" : "WARN",
    label: "Canonical URL source",
    detail: `${resolved.source}: ${resolved.url.toString()}${resolved.warnings.length ? ` (${resolved.warnings.join(" ")})` : ""}`,
    action: resolved.warnings.length ? "Set NEXT_PUBLIC_SITE_URL and siteConfig.url to the intended HTTPS canonical domain before production." : undefined,
  });

  checks.push({
    status: mismatch ? "WARN" : "PASS",
    label: "URL consistency",
    detail: `src/config/site.config.ts=${configUrl}; wrangler/env NEXT_PUBLIC_SITE_URL=${envUrl || "not set"}`,
    action: mismatch ? "Align src/config/site.config.ts url and NEXT_PUBLIC_SITE_URL, or document the environment override." : undefined,
  });

  checks.push({
    status: allowProductionFallback === "false" || allowProductionFallback === "0" ? "PASS" : deploymentRelevant ? "WARN" : "PASS",
    label: "Production fallback",
    detail: `allowProductionFallback=${allowProductionFallback}`,
    action:
      allowProductionFallback === "false" || allowProductionFallback === "0"
        ? undefined
        : "Disable production fallback before deployment so preview/seed data cannot masquerade as production content.",
  });

  return checks;
}

function checkSitemapRuntimeStatic(): Check[] {
  const metadataSitemapExists = existsSync(path.join(root, "src", "app", "sitemap.ts"));
  const runtimeRoute = readText(path.join("src", "app", "sitemap.xml", "route.ts"));
  const contentRepository = readText(path.join("src", "db", "repositories", "content.ts")) ?? "";
  const cachePolicy = readText(path.join("src", "lib", "edge-cache-policy.ts")) ?? "";
  const sitemapFunction = contentRepository.includes("export async function listSitemapContent")
    ? contentRepository.slice(contentRepository.indexOf("export async function listSitemapContent"), contentRepository.indexOf("export async function listAdminTags"))
    : "";
  const bodyFields = ["body_html", "summary", "cover_url", "seo_title", "seo_description"].filter((field) => new RegExp(field, "i").test(sitemapFunction));

  return [
    {
      status: !metadataSitemapExists ? "PASS" : "FAIL",
      label: "Runtime sitemap route default",
      detail: metadataSitemapExists ? "src/app/sitemap.ts exists." : "Build-time metadata sitemap is not present.",
      action: metadataSitemapExists ? "Use src/app/sitemap.xml/route.ts as the default Cloudflare + D1 sitemap implementation." : undefined,
    },
    {
      status: runtimeRoute && runtimeRoute.includes('dynamic = "force-dynamic"') && runtimeRoute.includes("HEAD") ? "PASS" : "FAIL",
      label: "Runtime sitemap route",
      detail: runtimeRoute ? "src/app/sitemap.xml/route.ts exists." : "Missing src/app/sitemap.xml/route.ts.",
      action: runtimeRoute ? undefined : "Add a runtime sitemap route with explicit GET and HEAD handlers.",
    },
    {
      status: contentRepository.includes("listSitemapContent") && bodyFields.length === 0 ? "PASS" : "FAIL",
      label: "Sitemap lightweight repository",
      detail: bodyFields.length ? `Sitemap query references heavy field(s): ${bodyFields.join(", ")}` : "listSitemapContent avoids article body and rich content fields.",
      action: bodyFields.length ? "Restrict sitemap queries to slug and date fields." : undefined,
    },
    {
      status: cachePolicy.includes('"/sitemap.xml"') && cachePolicy.includes('"/robots.txt"') ? "PASS" : "FAIL",
      label: "Sitemap edge cache exclusion",
      detail: cachePolicy ? "Cache exclusion policy includes sitemap.xml and robots.txt." : "Missing edge cache exclusion policy.",
      action: cachePolicy ? undefined : "Add /sitemap.xml and /robots.txt to public edge cache exclusions.",
    },
  ];
}

async function checkProductionSitemap(productionUrl: string): Promise<Check> {
  const sitemapUrl = new URL("/sitemap.xml", productionUrl).toString();
  try {
    const result = await checkSitemapUrl(sitemapUrl);
    return {
      status: result.ok ? "PASS" : "FAIL",
      label: "Production sitemap runtime",
      detail: result.ok ? "GET, HEAD, Googlebot, Content-Length, and XML checks passed." : result.issues.join("; "),
      action: result.ok ? undefined : "Fix production sitemap runtime response before submitting to Search Console.",
    };
  } catch (error) {
    return {
      status: "FAIL",
      label: "Production sitemap runtime",
      detail: error instanceof Error ? error.message : "Production sitemap check failed.",
      action: "Verify the production URL and sitemap runtime response.",
    };
  }
}

function normalizeComparableUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function readBuildTimeThemeConfig(): SiteThemeConfig | null {
  const text = readText(path.join("src", "instance", "theme.config.ts"));
  if (!text) return null;

  const name = text.match(/\bname:\s*["']([^"']+)["']/)?.[1];
  const version = text.match(/\bversion:\s*["']([^"']+)["']/)?.[1];
  if (!name && !version) return null;

  return { name, version };
}

function checkIgnoredFiles(gitignoreLines: string[]): Check[] {
  return requiredIgnorePatterns.map((pattern) => {
    const ignored = gitignoreLines.some((line) => line === pattern || line === `/${pattern}`);
    return {
      status: ignored ? "PASS" : "WARN",
      label: `.gitignore contains ${pattern}`,
      detail: ignored ? "Ignored." : "Pattern not found.",
      action: ignored ? undefined : `Add ${pattern} to .gitignore if this copied site uses local import folders or Windows scratch files.`,
    };
  });
}

function checkEnvironmentSafety(trackedFiles: string[]): Check[] {
  const checks: Check[] = [];
  const trackedEnvFiles = trackedFiles.filter((file) => path.basename(file) === ".env" || path.basename(file).startsWith(".env."));
  const trackedImportFiles = trackedFiles.filter((file) => isForbiddenTrackedImportFile(file));

  checks.push({
    status: trackedEnvFiles.length === 0 ? "PASS" : "WARN",
    label: "Tracked env files",
    detail: trackedEnvFiles.length === 0 ? ".env* files are not tracked." : trackedEnvFiles.join(", "),
    action: trackedEnvFiles.length === 0 ? undefined : "Remove env files from git history/staging and rotate exposed secrets.",
  });

  checks.push({
    status: trackedImportFiles.length === 0 ? "PASS" : "WARN",
    label: "Tracked import/temp files",
    detail: trackedImportFiles.length === 0 ? "articles/, content-import/, content/import/, .tmp-import-verify-*, and NUL are not tracked." : trackedImportFiles.slice(0, 8).join(", "),
    action: trackedImportFiles.length === 0 ? undefined : "Remove local article import folders, temporary verification files, and NUL from git before pushing.",
  });

  const secretHits = findSecretMarkers(trackedFiles);
  checks.push({
    status: secretHits.length === 0 ? "PASS" : "WARN",
    label: "Secret marker scan",
    detail: secretHits.length === 0 ? "ADMIN_PASSWORD and SESSION_SECRET were not found in tracked files." : secretHits.slice(0, 8).join(", "),
    action: secretHits.length === 0 ? undefined : "Move secrets to .env.local or Cloudflare secrets; rotate any real exposed values.",
  });

  return checks;
}

function isForbiddenTrackedImportFile(file: string) {
  const normalized = file.replace(/\\/g, "/");
  return forbiddenTrackedPrefixes.some((prefix) => normalized.startsWith(prefix)) || forbiddenTrackedFiles.has(path.basename(normalized));
}

function checkRequiredValue(label: string, value: string | undefined, action: string): Check {
  return {
    status: value ? "PASS" : "FAIL",
    label,
    detail: value || "Missing.",
    action: value ? undefined : action,
  };
}

function checkDefaultValue(label: string, value: string | undefined, action: string): Check {
  if (!value) {
    return {
      status: "FAIL",
      label,
      detail: "Missing.",
      action,
    };
  }

  const isDefault = defaultIdentityValues.has(value.toLowerCase());
  return {
    status: isDefault ? "WARN" : "PASS",
    label,
    detail: value,
    action: isDefault ? action : undefined,
  };
}

function printCheck(check: Check) {
  const prefix = check.status === "PASS" ? "✓ PASS" : check.status === "WARN" ? "⚠ WARN" : "✗ FAIL";
  console.log(`${prefix} ${check.label} - ${check.detail}`);
}

function printSummary(checks: Check[]) {
  const pass = checks.filter((check) => check.status === "PASS").length;
  const warn = checks.filter((check) => check.status === "WARN").length;
  const fail = checks.filter((check) => check.status === "FAIL").length;
  const actions = checks.filter((check) => check.action).map((check) => check.action as string);

  console.log("");
  console.log(`Summary: ${pass} pass, ${warn} warn, ${fail} fail`);
  console.log("");
  console.log("Recommended next actions:");

  if (actions.length === 0) {
    console.log("- No required action found.");
    return;
  }

  for (const action of [...new Set(actions)]) {
    console.log(`- ${action}`);
  }
}

async function getGitRemote() {
  const result = await runCommand("git", ["remote", "get-url", "origin"]);
  if (result.code !== 0) return null;
  return result.stdout.trim() || null;
}

async function getTrackedFiles() {
  const result = await runCommand("git", ["ls-files", "-z"]);
  if (result.code !== 0) return [];
  return result.stdout.split("\0").filter(Boolean);
}

function findSecretMarkers(trackedFiles: string[]) {
  const hits: string[] = [];

  for (const file of trackedFiles) {
    const absolutePath = path.join(root, file);
    if (!existsSync(absolutePath)) continue;

    const buffer = readFileSync(absolutePath);
    if (buffer.includes(0) || buffer.length > 2_000_000) continue;

    const text = buffer.toString("utf8");
    for (const marker of secretMarkers) {
      if (text.includes(marker)) hits.push(`${file}:${marker}`);
    }
  }

  return hits;
}

function readJson<T>(relativePath: string): T | null {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) return null;

  return JSON.parse(stripBom(readFileSync(absolutePath, "utf8"))) as T;
}

function readJsonc<T>(relativePath: string): T | null {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) return null;

  return JSON.parse(stripJsonComments(stripBom(readFileSync(absolutePath, "utf8")))) as T;
}

function readText(relativePath: string) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) return null;

  return stripBom(readFileSync(absolutePath, "utf8"));
}

function readLines(relativePath: string) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) return [];

  return stripBom(readFileSync(absolutePath, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function stripJsonComments(input: string) {
  let output = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (!inString && char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (!inString && char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += char;

    if (char === "\\" && inString) {
      escaped = !escaped;
      continue;
    }

    if (char === "\"" && !escaped) {
      inString = !inString;
    }

    if (char !== "\\") {
      escaped = false;
    }
  }

  return output;
}

function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: stderr || error.message });
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown doctor error.";
  console.log(`✗ FAIL Doctor crashed - ${message}`);
  process.exitCode = 1;
});
