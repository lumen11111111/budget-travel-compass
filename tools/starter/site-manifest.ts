import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { runCommand, truncate } from "./cli-utils";

type Status = "PASS" | "WARN" | "FAIL";

type Check = {
  status: Status;
  label: string;
  detail: string;
};

type LinkItem = {
  label: string;
  href: string;
};

type SlugItem = {
  name: string;
  slug: string;
};

type HomepageModule = {
  key: string;
  label: string;
  enabled: boolean;
};

type SiteManifest = {
  siteName: string;
  domain: string;
  productionUrl: string;
  tagline: string;
  description: string;
  contactEmail: string;
  supportEmail: string;
  legalEmail: string;
  teamName: string;
  editorialTeamName: string;
  operatorName: string;
  operatorCountry: string;
  legalStatus: string;
  packageName: string;
  githubRepo: string;
  cloudflareWorkerName: string;
  d1DatabaseName: string;
  d1DatabaseId: string;
  r2BucketName: string;
  themeName: string;
  brandColors: Record<string, string>;
  navigation: LinkItem[];
  categories: SlugItem[];
  tags: SlugItem[];
  homepageModules: HomepageModule[];
  defaultAuthor: string;
  rssEnabled: boolean;
  adsEnabled: boolean;
  adsensePublisherId: string;
};

type PlannedFile = {
  file: string;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  content: string;
};

type ApplyReport = {
  timestamp: string;
  oldValues: Record<string, Record<string, unknown>>;
  newValues: Record<string, Record<string, unknown>>;
  filesChanged: string[];
};

const root = process.cwd();
const defaultManifestPath = path.join(root, "starter.site.json");
const reportPath = path.join(root, "manifest-apply-report.json");
const placeholderUuid = "00000000-0000-0000-0000-000000000000";
const requiredStringFields = [
  "siteName",
  "domain",
  "productionUrl",
  "tagline",
  "description",
  "contactEmail",
  "supportEmail",
  "legalEmail",
  "teamName",
  "editorialTeamName",
  "operatorName",
  "operatorCountry",
  "legalStatus",
  "packageName",
  "githubRepo",
  "cloudflareWorkerName",
  "d1DatabaseName",
  "d1DatabaseId",
  "r2BucketName",
  "themeName",
  "defaultAuthor",
  "adsensePublisherId",
] as const;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    printHelp();
    return;
  }

  if (args.includes("--report")) {
    printReport();
    return;
  }

  const checkMode = args.includes("--check");
  const dryRunMode = args.includes("--dry-run-generate");
  const applyMode = args.includes("--apply");
  const applyDryRunMode = applyMode && args.includes("--dry-run");
  const yes = args.includes("--yes");
  const manifestPath = resolveManifestPath(args);

  if (!checkMode && !dryRunMode && !applyMode) {
    fail("Mode", "Run with --check, --dry-run-generate, --apply, or --report.");
    process.exit(1);
  }

  const { manifest, checks } = loadValidatedManifest(manifestPath);
  if (checkMode) {
    printChecks(checks);
    printSummary(checks);
  }

  if (checks.some((check) => check.status === "FAIL") || !manifest) {
    process.exitCode = 1;
    if (dryRunMode || applyMode) {
      printChecks(checks);
      printSummary(checks);
    }
    return;
  }

  if (dryRunMode) {
    printDryRunPreview(manifest);
  }

  if (applyMode) {
    await applyManifest(manifest, { dryRun: applyDryRunMode, yes });
  }
}

function resolveManifestPath(args: string[]) {
  const fileArg = args.find((arg) => arg.startsWith("--file="));
  if (!fileArg) return defaultManifestPath;
  const value = fileArg.slice("--file=".length).trim();
  if (!value) {
    fail("Manifest file", "--file requires a path.");
    process.exit(1);
  }
  return path.resolve(root, value);
}

function loadValidatedManifest(manifestPath: string) {
  const checks: Check[] = [];
  const manifest = readManifest(checks, manifestPath);

  if (!manifest) return { manifest: null, checks };

  checks.push(...validateShape(manifest));
  if (isSiteManifest(manifest)) checks.push(...validateValues(manifest));

  return {
    manifest: isSiteManifest(manifest) ? manifest : null,
    checks,
  };
}

function readManifest(checks: Check[], manifestPath: string) {
  if (!existsSync(manifestPath)) {
    checks.push({ status: "FAIL", label: "Manifest file", detail: `${path.relative(root, manifestPath)} is missing.` });
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
    checks.push({ status: "PASS", label: "Manifest file", detail: `${path.relative(root, manifestPath)} loaded.` });
    return parsed;
  } catch (error) {
    checks.push({ status: "FAIL", label: "Manifest JSON", detail: error instanceof Error ? error.message : "Invalid JSON." });
    return null;
  }
}

function validateShape(value: unknown): Check[] {
  const checks: Check[] = [];
  if (!isRecord(value)) {
    checks.push({ status: "FAIL", label: "Manifest shape", detail: "Root value must be an object." });
    return checks;
  }

  for (const field of requiredStringFields) {
    checks.push(typeCheck(field, typeof value[field] === "string", "string"));
  }

  checks.push(typeCheck("brandColors", isStringRecord(value.brandColors), "object of string colors"));
  checks.push(typeCheck("navigation", isLinkArray(value.navigation), "array of { label, href }"));
  checks.push(typeCheck("categories", isSlugArray(value.categories), "array of { name, slug }"));
  checks.push(typeCheck("tags", isSlugArray(value.tags), "array of { name, slug }"));
  checks.push(typeCheck("homepageModules", isHomepageModuleArray(value.homepageModules), "array of { key, label, enabled }"));
  checks.push(typeCheck("rssEnabled", typeof value.rssEnabled === "boolean", "boolean"));
  checks.push(typeCheck("adsEnabled", typeof value.adsEnabled === "boolean", "boolean"));

  return checks;
}

function validateValues(manifest: SiteManifest): Check[] {
  const checks: Check[] = [];
  for (const field of requiredStringFields) {
    if (field === "adsensePublisherId") continue;
    const value = manifest[field].trim();
    checks.push({ status: value ? "PASS" : "WARN", label: `${field} value`, detail: value ? "Set." : "Empty required value." });
  }

  checks.push({ status: manifest.domain === "example.com" ? "WARN" : "PASS", label: "domain is not example.com", detail: manifest.domain });
  checks.push({
    status: manifest.d1DatabaseId === placeholderUuid ? "WARN" : "PASS",
    label: "d1DatabaseId placeholder",
    detail: manifest.d1DatabaseId === placeholderUuid ? "Replace before real site setup." : "Real-looking ID set.",
  });
  checks.push({
    status: manifest.adsEnabled && !manifest.adsensePublisherId.trim() ? "WARN" : "PASS",
    label: "adsensePublisherId required when ads enabled",
    detail: manifest.adsEnabled && !manifest.adsensePublisherId.trim() ? "adsEnabled is true but adsensePublisherId is empty." : "Consistent.",
  });
  checks.push({
    status: !manifest.adsEnabled && manifest.adsensePublisherId.trim() ? "WARN" : "PASS",
    label: "adsensePublisherId unused when ads disabled",
    detail: !manifest.adsEnabled && manifest.adsensePublisherId.trim() ? "adsEnabled is false but adsensePublisherId is set." : "Consistent.",
  });
  checks.push(...validateIdentityValues(manifest));

  return checks;
}

function validateIdentityValues(manifest: SiteManifest): Check[] {
  const checks: Check[] = [];
  const emailFields = [
    ["contactEmail", manifest.contactEmail],
    ["supportEmail", manifest.supportEmail],
    ["legalEmail", manifest.legalEmail],
  ] as const;
  const identityFields = [
    ["teamName", manifest.teamName],
    ["editorialTeamName", manifest.editorialTeamName],
    ["operatorName", manifest.operatorName],
  ] as const;

  for (const [field, value] of emailFields) {
    checks.push({
      status: value.trim() ? "PASS" : "WARN",
      label: `${field} not empty`,
      detail: value.trim() ? "Set." : "Email field is empty.",
    });
    checks.push({
      status: value.toLowerCase().includes("example.com") ? "WARN" : "PASS",
      label: `${field} not example.com`,
      detail: value || "(empty)",
    });
  }

  for (const [field, value] of identityFields) {
    const lower = value.toLowerCase();
    const oldDefault = lower.includes("contentforge demo") || lower.includes("starter");
    checks.push({
      status: oldDefault ? "WARN" : "PASS",
      label: `${field} replaced`,
      detail: oldDefault ? `${value} still looks like an inherited starter value.` : value,
    });
  }

  return checks;
}

async function applyManifest(manifest: SiteManifest, options: { dryRun: boolean; yes: boolean }) {
  const plannedFiles = buildPlannedFiles(manifest);
  const changedFiles = plannedFiles.filter((file) => currentFileContent(file.file) !== file.content);

  printApplyPreview(changedFiles);

  if (options.dryRun) {
    console.log("Dry run only. No files were written.");
    return;
  }

  if (changedFiles.length === 0) {
    console.log("No file changes needed.");
    writeReport(plannedFiles, []);
    return;
  }

  await confirmApply(options.yes);

  for (const file of changedFiles) {
    writeFileSync(path.join(root, file.file), file.content, "utf8");
  }

  writeReport(plannedFiles, changedFiles.map((file) => file.file));
  pass("Manifest apply", "Files written and manifest-apply-report.json generated.");

  await runValidationAfterApply();
}

function buildPlannedFiles(manifest: SiteManifest): PlannedFile[] {
  const packageJson = readJsonFile<Record<string, unknown>>("package.json");
  const wrangler = readJsonFile<Record<string, unknown>>("wrangler.jsonc");
  const r2PublicBaseUrl = `${manifest.productionUrl.replace(/\/$/, "")}/media`;

  return [
    {
      file: "package.json",
      oldValues: { name: packageJson.name },
      newValues: { name: manifest.packageName },
      content: `${JSON.stringify({ ...packageJson, name: manifest.packageName }, null, 2)}\n`,
    },
    {
      file: "wrangler.jsonc",
      oldValues: extractWranglerValues(wrangler),
      newValues: {
        name: manifest.cloudflareWorkerName,
        d1DatabaseName: manifest.d1DatabaseName,
        d1DatabaseId: manifest.d1DatabaseId,
        r2BucketName: manifest.r2BucketName,
        NEXT_PUBLIC_SITE_URL: manifest.productionUrl,
        R2_PUBLIC_BASE_URL: r2PublicBaseUrl,
      },
      content: `${JSON.stringify(buildWranglerConfig(wrangler, manifest), null, "\t")}\n`,
    },
    {
      file: "src/config/site.config.ts",
      oldValues: extractSelectedStrings("src/config/site.config.ts", ["name", "domain", "url", "contactEmail", "supportEmail", "legalEmail", "teamName", "editorialTeamName"]),
      newValues: {
        name: manifest.siteName,
        domain: manifest.domain,
        url: manifest.productionUrl,
        tagline: manifest.tagline,
        description: manifest.description,
        contactEmail: manifest.contactEmail,
        supportEmail: manifest.supportEmail,
        legalEmail: manifest.legalEmail,
        teamName: manifest.teamName,
        editorialTeamName: manifest.editorialTeamName,
        operatorName: manifest.operatorName,
        operatorCountry: manifest.operatorCountry,
        legalStatus: manifest.legalStatus,
        defaultAuthor: manifest.defaultAuthor,
      },
      content: generateSiteConfig(manifest),
    },
    {
      file: "src/config/theme.config.ts",
      oldValues: {},
      newValues: { themeName: manifest.themeName, brandColors: manifest.brandColors },
      content: generateThemeConfig(manifest),
    },
    {
      file: "src/config/homepage.config.ts",
      oldValues: {},
      newValues: { categories: manifest.categories, homepageModules: manifest.homepageModules },
      content: generateHomepageConfig(manifest),
    },
    {
      file: "src/config/legal.config.ts",
      oldValues: extractSelectedStrings("src/config/legal.config.ts", ["siteName", "operatorName", "operatorCountry", "contactEmail", "supportEmail", "legalEmail", "teamName", "editorialTeamName"]),
      newValues: {
        siteName: manifest.siteName,
        contactEmail: manifest.contactEmail,
        supportEmail: manifest.supportEmail,
        legalEmail: manifest.legalEmail,
        teamName: manifest.teamName,
        editorialTeamName: manifest.editorialTeamName,
        operatorName: manifest.operatorName,
        operatorCountry: manifest.operatorCountry,
        legalStatus: manifest.legalStatus,
      },
      content: generateLegalConfig(manifest),
    },
  ];
}

function buildWranglerConfig(current: Record<string, unknown>, manifest: SiteManifest) {
  const next = structuredClone(current) as Record<string, unknown>;
  next.name = manifest.cloudflareWorkerName;

  const d1Databases = Array.isArray(next.d1_databases) ? (next.d1_databases as Array<Record<string, unknown>>) : [];
  const d1 = d1Databases.find((database) => database.binding === "DB") ?? d1Databases[0] ?? {};
  d1.binding = "DB";
  d1.database_name = manifest.d1DatabaseName;
  d1.database_id = manifest.d1DatabaseId;
  next.d1_databases = [d1];

  const r2Buckets = Array.isArray(next.r2_buckets) ? (next.r2_buckets as Array<Record<string, unknown>>) : [];
  const r2 = r2Buckets.find((bucket) => bucket.binding === "MEDIA_BUCKET") ?? r2Buckets[0] ?? {};
  r2.binding = "MEDIA_BUCKET";
  r2.bucket_name = manifest.r2BucketName;
  next.r2_buckets = [r2];

  next.vars = {
    ...(isRecord(next.vars) ? next.vars : {}),
    NEXT_PUBLIC_SITE_URL: manifest.productionUrl,
    R2_PUBLIC_BASE_URL: `${manifest.productionUrl.replace(/\/$/, "")}/media`,
  };

  return next;
}

function generateSiteConfig(manifest: SiteManifest) {
  const logo = splitLogo(manifest.siteName);
  const navigation = manifest.navigation.map((link) => `      { href: ${q(link.href)}, label: ${q(link.label)} }`).join(",\n");

  return `export const siteConfig = {
  name: ${q(manifest.siteName)},
  domain: ${q(manifest.domain)},
  url: ${q(manifest.productionUrl)},
  tagline: ${q(manifest.tagline)},
  description: ${q(manifest.description)},
  defaultSeoTitle: ${q(`${manifest.siteName} - ${manifest.tagline}`)},
  defaultSeoDescription: ${q(manifest.description)},
  contactEmail: ${q(manifest.contactEmail)},
  supportEmail: ${q(manifest.supportEmail)},
  legalEmail: ${q(manifest.legalEmail)},
  teamName: ${q(manifest.teamName)},
  editorialTeamName: ${q(manifest.editorialTeamName)},
  operator: {
    name: ${q(manifest.operatorName)},
    country: ${q(manifest.operatorCountry)},
    legalStatus: ${q(manifest.legalStatus)},
  },
  brand: {
    logoPrefix: ${q(logo.prefix)},
    logoSuffix: ${q(logo.suffix)},
    byline: ${q(manifest.defaultAuthor)},
    copyrightYear: ${new Date().getFullYear()},
  },
  content: {
    articleTypeLabel: "content article",
    searchPlaceholder: "Search articles, categories, or tags",
    searchEmptyText: "No matching articles found. Try another search.",
  },
  social: {
    defaultShareTitle: ${q(`${manifest.siteName} - ${manifest.tagline}`)},
    defaultShareDescription: ${q(manifest.description)},
    twitterCard: "summary",
  },
  navigation: {
    primary: [
${navigation}
    ],
    footerSite: [
      { href: "/", label: "Home" },
      { href: "/about", label: "About Us" },
      { href: "/contact", label: "Contact Us" },
      { href: "/search", label: "Search" },
    ],
    legal: [
      { href: "/privacy-policy", label: "Privacy Policy" },
      { href: "/terms-of-service", label: "Terms of Service" },
      { href: "/cookie-policy", label: "Cookie Policy" },
      { href: "/editorial-policy", label: "Editorial Policy" },
      { href: "/affiliate-disclosure", label: "Affiliate Disclosure" },
      { href: "/dmca-copyright", label: "DMCA / Copyright" },
    ],
  },
} as const;

export type SiteConfig = typeof siteConfig;
`;
}

function generateThemeConfig(manifest: SiteManifest) {
  const current = readJsonLikeThemeFallback();
  const colors = { ...current, ...manifest.brandColors };
  const colorLines = Object.entries(colors).map(([key, value]) => `    ${key}: ${q(value)},`).join("\n");

  return `import type { CSSProperties } from "react";

export const themeConfig = {
  colors: {
${colorLines}
  },
  gradients: {
    glow: ${q(`linear-gradient(135deg, ${colors.accent} 0%, ${colors.cyan ?? colors.accent} 48%, ${colors.violet ?? colors.accent} 100%)`)},
    soft: "linear-gradient(135deg, rgba(20, 118, 255, 0.16), rgba(20, 215, 229, 0.12), rgba(114, 87, 255, 0.12))",
    card: "linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(246, 250, 255, 0.9))",
  },
  shadows: {
    card: "0 18px 42px rgba(12, 35, 82, 0.09)",
    cardHover: "0 24px 58px rgba(20, 118, 255, 0.18)",
  },
  radius: "16px",
} as const;

type ThemeStyle = CSSProperties & Record<\`--\${string}\`, string>;

export function themeCssVariables(): ThemeStyle {
  return {
    "--ink": themeConfig.colors.ink,
    "--ink-soft": themeConfig.colors.inkSoft,
    "--paper": themeConfig.colors.paper,
    "--surface": themeConfig.colors.surface,
    "--line": themeConfig.colors.line,
    "--line-dark": themeConfig.colors.lineDark,
    "--accent": themeConfig.colors.accent,
    "--accent-dark": themeConfig.colors.accentDark,
    "--cyan": themeConfig.colors.cyan,
    "--violet": themeConfig.colors.violet,
    "--green": themeConfig.colors.green,
    "--purple": themeConfig.colors.purple,
    "--orange": themeConfig.colors.orange,
    "--blue": themeConfig.colors.blue,
    "--muted": themeConfig.colors.muted,
    "--glow-gradient": themeConfig.gradients.glow,
    "--soft-gradient": themeConfig.gradients.soft,
    "--card-gradient": themeConfig.gradients.card,
    "--card-shadow": themeConfig.shadows.card,
    "--card-shadow-hover": themeConfig.shadows.cardHover,
    "--radius": themeConfig.radius,
  };
}
`;
}

function generateLegalConfig(_manifest: SiteManifest) {
  let content = currentFileContent("src/config/legal.config.ts");
  const constBlock = `const siteName = siteConfig.name;
const operatorName = siteConfig.operator.name;
const operatorCountry = siteConfig.operator.country;
const contactEmail = siteConfig.contactEmail;
const supportEmail = siteConfig.supportEmail;
const legalEmail = siteConfig.legalEmail;
const teamName = siteConfig.teamName;
const editorialTeamName = siteConfig.editorialTeamName;`;
  const identityBlock = `identity: {
    siteName,
    contactEmail,
    supportEmail,
    legalEmail,
    teamName,
    editorialTeamName,
    operatorName,
    operatorCountry,
    legalStatus: siteConfig.operator.legalStatus,
  },`;

  content = content.replace(/const siteName = siteConfig\.name;\r?\nconst operatorName = siteConfig\.operator\.name;\r?\nconst operatorCountry = siteConfig\.operator\.country;\r?\nconst contactEmail = siteConfig\.contactEmail;/, constBlock);
  content = content.replace(/identity: \{[\s\S]*?legalStatus: siteConfig\.operator\.legalStatus,\r?\n {2}\},/, identityBlock);

  return content;
}

function generateHomepageConfig(manifest: SiteManifest) {
  const labelFor = (key: string, fallback: string) => manifest.homepageModules.find((module) => module.key === key)?.label ?? fallback;
  const slugFor = (keyword: string, fallback: string) => manifest.categories.find((category) => category.slug.includes(keyword))?.slug ?? fallback;

  return `import { siteConfig } from "@/config/site.config";

export const homepageConfig = {
  seoTitle: siteConfig.defaultSeoTitle,
  seoDescription: siteConfig.defaultSeoDescription,
  hiddenTitle: siteConfig.defaultSeoTitle,
  labels: {
    leadStory: ${q(labelFor("lead", "Lead Story"))},
    genreGuides: ${q(labelFor("genreGuides", "Guides"))},
    featuredLists: ${q(labelFor("featuredLists", "Resource Library"))},
    categoryIndex: "Category Index",
    latestNews: ${q(labelFor("latest", "Latest Articles"))},
    popularRecommendations: ${q(labelFor("popularRecommendations", "Featured Picks"))},
    viewAll: "View All",
    leadStoryEmpty: "No lead story yet.",
    noGenreGuides: "No guide articles yet.",
    noFeaturedLists: "No resource articles yet.",
    noPublishedArticles: "No published articles yet.",
    noPopularRecommendations: "No featured picks are available yet.",
    popularRecommendationsDeck: "Curated picks and editorial recommendations",
  },
  categorySlugs: {
    genreGuides: ${q(slugFor("genre", "genre-guides"))},
    featuredLists: ${q(slugFor("featured", "featured-lists"))},
    popularRecommendations: ${q(slugFor("popular", "popular-recommendations"))},
  },
  limits: {
    featuredLists: 4,
    genreGuides: 3,
    latestNews: 5,
    popularRecommendations: 4,
  },
} as const;
`;
}

function printDryRunPreview(manifest: SiteManifest) {
  const plannedFiles = buildPlannedFiles(manifest);
  console.log("Starter Site Manifest Dry Run");
  console.log("");
  console.log("No files were written. This is a preview only.");
  console.log("");
  printApplyPreview(plannedFiles);
  printSeedPreview(manifest);
  printIdentityUsagePreview(manifest);
}

function printApplyPreview(files: PlannedFile[]) {
  console.log("Files that would change:");
  if (files.length === 0) {
    console.log("- none");
    console.log("");
    return;
  }

  for (const file of files) {
    const changed = currentFileContent(file.file) !== file.content;
    console.log(`- ${file.file}${changed ? "" : " (no content change)"}`);
    console.log(`  old: ${JSON.stringify(file.oldValues)}`);
    console.log(`  new: ${JSON.stringify(file.newValues)}`);
  }
  console.log("");
}

function printSeedPreview(manifest: SiteManifest) {
  printSection("src/db/seed-data.ts preview only", [
    ["categories", manifest.categories.map((category) => `${category.name} (${category.slug})`).join(", ")],
    ["tags", manifest.tags.map((tag) => `${tag.name} (${tag.slug})`).join(", ")],
  ]);
}

function printIdentityUsagePreview(manifest: SiteManifest) {
  printSection("contact/team identity preview", [
    ["src/config/site.config.ts", `contactEmail=${manifest.contactEmail}, supportEmail=${manifest.supportEmail}, legalEmail=${manifest.legalEmail}, teamName=${manifest.teamName}, editorialTeamName=${manifest.editorialTeamName}`],
    ["src/config/legal.config.ts", `operatorName=${manifest.operatorName}, operatorCountry=${manifest.operatorCountry}, legalStatus=${manifest.legalStatus}`],
    ["SEO organization email", manifest.contactEmail],
    ["Contact page defaults", `contact=${manifest.contactEmail}, support=${manifest.supportEmail}`],
    ["About page defaults", `team=${manifest.teamName}, operator=${manifest.operatorName}`],
    ["Privacy / Terms / Cookie / Editorial / Affiliate / DMCA defaults", `legal=${manifest.legalEmail}, operator=${manifest.operatorName}, country=${manifest.operatorCountry}`],
  ]);
}

async function confirmApply(yes: boolean) {
  if (yes) {
    pass("Confirmation", "--yes provided.");
    return;
  }

  if (!process.stdin.isTTY) {
    fail("Confirmation", "Non-interactive terminal. Re-run with --yes if this apply is intentional.");
    process.exit(1);
  }

  const reader = createInterface({ input, output });
  const answer = await reader.question("Type APPLY to write manifest changes: ");
  reader.close();

  if (answer !== "APPLY") {
    fail("Confirmation", "Manifest apply cancelled.");
    process.exit(1);
  }

  pass("Confirmation", "APPLY accepted.");
}

async function runValidationAfterApply() {
  for (const script of ["doctor", "typecheck", "lint", "build"]) {
    console.log("");
    console.log(`Running npm run ${script}...`);
    const result = await runNpmScript(script);
    if (result.code !== 0) {
      fail(`npm run ${script}`, truncate(result.stderr || result.stdout || "Command failed."));
      process.exit(1);
    }
    pass(`npm run ${script}`, "completed.");
  }
}

function writeReport(plannedFiles: PlannedFile[], filesChanged: string[]) {
  const report: ApplyReport = {
    timestamp: new Date().toISOString(),
    oldValues: Object.fromEntries(plannedFiles.map((file) => [file.file, file.oldValues])),
    newValues: Object.fromEntries(plannedFiles.map((file) => [file.file, file.newValues])),
    filesChanged,
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function printReport() {
  if (!existsSync(reportPath)) {
    fail("Manifest report", "manifest-apply-report.json does not exist yet.");
    process.exit(1);
  }
  console.log(readFileSync(reportPath, "utf8"));
}

function readJsonFile<T extends Record<string, unknown>>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

function currentFileContent(relativePath: string) {
  const filePath = path.join(root, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function extractWranglerValues(wrangler: Record<string, unknown>) {
  const d1 = Array.isArray(wrangler.d1_databases) ? (wrangler.d1_databases[0] as Record<string, unknown> | undefined) : undefined;
  const r2 = Array.isArray(wrangler.r2_buckets) ? (wrangler.r2_buckets[0] as Record<string, unknown> | undefined) : undefined;
  const vars = isRecord(wrangler.vars) ? wrangler.vars : {};
  return {
    name: wrangler.name,
    d1DatabaseName: d1?.database_name,
    d1DatabaseId: d1?.database_id,
    r2BucketName: r2?.bucket_name,
    NEXT_PUBLIC_SITE_URL: vars.NEXT_PUBLIC_SITE_URL,
    R2_PUBLIC_BASE_URL: vars.R2_PUBLIC_BASE_URL,
  };
}

function extractSelectedStrings(relativePath: string, keys: string[]) {
  const content = currentFileContent(relativePath);
  const values: Record<string, string> = {};
  for (const key of keys) {
    const match = content.match(new RegExp(`${key}:\\s+"([^"]*)"`));
    if (match?.[1]) values[key] = match[1];
  }
  return values;
}

function readJsonLikeThemeFallback() {
  return {
    ink: "#0b0b0d",
    inkSoft: "#4b4d55",
    paper: "#eef3fb",
    surface: "#ffffff",
    line: "#d7e0ee",
    lineDark: "#232323",
    accent: "#1476ff",
    accentDark: "#0d4ed8",
    cyan: "#14d7e5",
    violet: "#7257ff",
    green: "#00a8a8",
    purple: "#6252d9",
    orange: "#1aa7ff",
    blue: "#1476ff",
    muted: "#6b6e76",
  };
}

async function runNpmScript(script: string) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && existsSync(npmExecPath)) {
    return runCommand(process.execPath, [npmExecPath, "run", script]);
  }
  return runCommand(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script]);
}

function splitLogo(siteName: string) {
  const parts = siteName.trim().split(/\s+/);
  if (parts.length > 1) return { prefix: parts[0] ?? siteName, suffix: parts.slice(1).join(" ") };
  const midpoint = Math.ceil(siteName.length / 2);
  return { prefix: siteName.slice(0, midpoint), suffix: siteName.slice(midpoint) };
}

function q(value: string) {
  return JSON.stringify(value);
}

function typeCheck(label: string, ok: boolean, expected: string): Check {
  return { status: ok ? "PASS" : "FAIL", label: `${label} type`, detail: ok ? expected : `Expected ${expected}.` };
}

function isSiteManifest(value: unknown): value is SiteManifest {
  return isRecord(value) && validateShape(value).every((check) => check.status !== "FAIL");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isLinkArray(value: unknown): value is LinkItem[] {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.label === "string" && typeof item.href === "string");
}

function isSlugArray(value: unknown): value is SlugItem[] {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.name === "string" && typeof item.slug === "string");
}

function isHomepageModuleArray(value: unknown): value is HomepageModule[] {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.key === "string" && typeof item.label === "string" && typeof item.enabled === "boolean");
}

function printChecks(checks: Check[]) {
  console.log("Starter Site Manifest Check");
  console.log("");
  for (const check of checks) print(check.status, check.label, check.detail);
}

function printSummary(checks: Check[]) {
  const passCount = checks.filter((check) => check.status === "PASS").length;
  const warnCount = checks.filter((check) => check.status === "WARN").length;
  const failCount = checks.filter((check) => check.status === "FAIL").length;
  console.log("");
  console.log(`Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail`);
}

function printHelp() {
  console.log("Usage:");
  console.log("  npm run manifest:check");
  console.log("  npm run manifest:dry-run");
  console.log("  npm run manifest:apply -- --dry-run");
  console.log("  npm run manifest:apply");
  console.log("  npm run manifest:apply -- --yes");
  console.log("  npm run manifest:report");
  console.log("  npm run manifest:check -- --file=starter.site.generated.json");
}

function printSection(title: string, rows: Array<[string, string]>) {
  console.log(title);
  console.log("-".repeat(title.length));
  for (const [label, value] of rows) console.log(`${label}: ${value}`);
  console.log("");
}

function pass(label: string, detail: string) {
  print("PASS", label, detail);
}

function fail(label: string, detail: string) {
  print("FAIL", label, detail);
}

function print(status: Status, label: string, detail: string) {
  const prefix = status === "PASS" ? "✓ PASS" : status === "WARN" ? "⚠ WARN" : "✗ FAIL";
  console.log(`${prefix} ${label} - ${detail}`);
}

main().catch((error: unknown) => {
  fail("Manifest command crashed", error instanceof Error ? error.message : "Unknown error.");
  process.exitCode = 1;
});
