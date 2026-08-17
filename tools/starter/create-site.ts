import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadThemeManifest } from "../../src/theme/manifest";
import type { ThemeDefinition } from "../../src/theme/types";
import { projectRoot, runCommand, truncate } from "./cli-utils";
import { discoverThemes } from "./theme-discovery";

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

type Options = {
  help: boolean;
  outputPath: string;
  yes: boolean;
  themeKey?: string;
  siteName?: string;
};

const placeholderUuid = "00000000-0000-0000-0000-000000000000";
const defaultOutputPath = "starter.site.json";
const examplePath = path.join(projectRoot, "starter.site.example.json");
const siteThemePath = path.join(projectRoot, "site.theme.json");
const activeThemeCssPath = path.join(projectRoot, "src", "theme", "active-theme.css");
const packageJsonPath = path.join(projectRoot, "package.json");
const instanceThemeDefinitionPath = path.join(projectRoot, "src", "instance", "theme.definition.ts");
const instanceThemeRuntimePath = path.join(projectRoot, "src", "instance", "theme-runtime.ts");
const instanceThemePreviewRuntimePath = path.join(projectRoot, "src", "instance", "theme-preview-runtime.ts");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const defaults = readExampleManifest();
  const outputPath = path.resolve(projectRoot, options.outputPath);

  if (existsSync(outputPath)) {
    if (options.yes) {
      fail("Output exists", `${path.relative(projectRoot, outputPath)} already exists. --yes will not overwrite files.`);
      process.exit(1);
    }

    const overwrite = await confirmOverwrite(outputPath);
    if (!overwrite) {
      fail("Create site cancelled", "Existing manifest was not overwritten.");
      process.exit(1);
    }
  }

  const manifest = options.yes
    ? buildDefaultManifest(defaults, resolveThemeOption(options.themeKey, defaults.themeName), options.siteName)
    : await runWizard(defaults, options.themeKey);
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  pass("Manifest written", path.relative(projectRoot, outputPath));

  const theme = resolveThemeOption(manifest.themeName);
  writeSiteThemeConfig(theme);
  writeInstanceThemeDefinition(theme);
  writeInstanceThemeRuntime(theme);
  writeActiveThemeCss(theme);
  updatePackageJson(manifest.packageName, theme);

  await validateManifest(outputPath);
  printNextSteps();
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    help: false,
    outputPath: defaultOutputPath,
    yes: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--yes") {
      options.yes = true;
    } else if (arg.startsWith("--output=")) {
      const value = arg.slice("--output=".length).trim();
      if (!value) {
        fail("Argument", "--output requires a file path.");
        process.exit(1);
      }
      options.outputPath = value;
    } else if (arg.startsWith("--theme=")) {
      const value = arg.slice("--theme=".length).trim();
      if (!value) {
        fail("Argument", "--theme requires a registered theme key.");
        process.exit(1);
      }
      options.themeKey = value;
    } else if (arg.startsWith("--site-name=")) {
      const value = arg.slice("--site-name=".length).trim();
      if (!value) {
        fail("Argument", "--site-name requires a value.");
        process.exit(1);
      }
      options.siteName = value;
    } else {
      fail("Argument", `Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  return options;
}

function readExampleManifest(): SiteManifest {
  if (!existsSync(examplePath)) {
    fail("Example manifest", "starter.site.example.json is missing.");
    process.exit(1);
  }

  return JSON.parse(readFileSync(examplePath, "utf8")) as SiteManifest;
}

async function confirmOverwrite(outputPath: string) {
  if (!process.stdin.isTTY) return false;
  const reader = createInterface({ input, output });
  const answer = await reader.question(`${path.relative(projectRoot, outputPath)} already exists. Type OVERWRITE to replace it: `);
  reader.close();
  return answer === "OVERWRITE";
}

async function runWizard(defaults: SiteManifest, requestedThemeKey?: string): Promise<SiteManifest> {
  const reader = createInterface({ input, output });
  try {
    console.log("Starter Create Site Wizard");
    console.log("");
    console.log("Press Enter to accept the default shown in brackets.");
    console.log("");

    const siteName = await ask(reader, "Site name", defaults.siteName);
    const selectedTheme = requestedThemeKey ? resolveThemeOption(requestedThemeKey) : await chooseTheme(reader, defaults.themeName);
    const domain = await ask(reader, "Domain", defaults.domain);
    const productionUrl = await ask(reader, "Production URL", normalizeProductionUrl(domain, defaults.productionUrl));
    const packageName = await ask(reader, "Package name", slugify(siteName));
    const workerName = await ask(reader, "Cloudflare Worker name", packageName);
    const d1DatabaseName = await ask(reader, "D1 database name", workerName);
    const r2BucketName = await ask(reader, "R2 bucket name", workerName);
    const adsEnabled = await askBoolean(reader, "Ads enabled", defaults.adsEnabled);

    return {
      siteName,
      domain,
      productionUrl,
      tagline: await ask(reader, "Tagline", defaults.tagline),
      description: await ask(reader, "Description", defaults.description),
      contactEmail: await ask(reader, "Contact email", defaults.contactEmail),
      supportEmail: await ask(reader, "Support email", defaults.supportEmail),
      legalEmail: await ask(reader, "Legal email", defaults.legalEmail),
      teamName: await ask(reader, "Team name", `${siteName} Team`),
      editorialTeamName: await ask(reader, "Editorial team name", `${siteName} Editorial Team`),
      operatorName: await ask(reader, "Operator name", `${siteName} Team`),
      operatorCountry: await ask(reader, "Operator country", defaults.operatorCountry),
      legalStatus: await ask(reader, "Legal status", defaults.legalStatus),
      defaultAuthor: await ask(reader, "Default author", `${siteName} desk`),
      packageName,
      githubRepo: await ask(reader, "GitHub repo", defaults.githubRepo),
      cloudflareWorkerName: workerName,
      d1DatabaseName,
      d1DatabaseId: await ask(reader, "D1 database id", placeholderUuid),
      r2BucketName,
      themeName: selectedTheme.key,
      brandColors: defaults.brandColors,
      navigation: defaults.navigation,
      categories: parseSlugItems(await ask(reader, "Categories (Name:slug, Name:slug)", formatSlugItems(defaults.categories))),
      tags: parseSlugItems(await ask(reader, "Tags (Name:slug, Name:slug)", formatSlugItems(defaults.tags))),
      homepageModules: parseHomepageModules(
        await ask(reader, "Homepage modules (key:label:enabled, key:label:false)", formatHomepageModules(defaults.homepageModules)),
      ),
      rssEnabled: await askBoolean(reader, "RSS enabled", defaults.rssEnabled),
      adsEnabled,
      adsensePublisherId: adsEnabled ? await ask(reader, "AdSense publisher ID", defaults.adsensePublisherId) : "",
    };
  } finally {
    reader.close();
  }
}

function buildDefaultManifest(defaults: SiteManifest, selectedTheme: ThemeOption, siteNameOverride?: string): SiteManifest {
  const siteName = siteNameOverride?.trim() || defaults.siteName;
  const packageName = siteNameOverride ? slugify(siteNameOverride) : defaults.packageName;

  return {
    ...defaults,
    siteName,
    packageName,
    themeName: selectedTheme.key,
    d1DatabaseId: defaults.d1DatabaseId || placeholderUuid,
    adsensePublisherId: defaults.adsEnabled ? defaults.adsensePublisherId : "",
  };
}

async function ask(reader: ReturnType<typeof createInterface>, label: string, defaultValue: string) {
  const answer = await reader.question(`${label} [${defaultValue}]: `);
  return answer.trim() || defaultValue;
}

async function askBoolean(reader: ReturnType<typeof createInterface>, label: string, defaultValue: boolean) {
  const defaultLabel = defaultValue ? "Y/n" : "y/N";
  const answer = (await reader.question(`${label} [${defaultLabel}]: `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return ["y", "yes", "true", "1"].includes(answer);
}

type ThemeOption = {
  key: string;
  definition: ThemeDefinition;
};

function availableThemes(): ThemeOption[] {
  return discoverThemes(projectRoot).map((theme) => ({ key: theme.key, definition: theme.definition }));
}

async function chooseTheme(reader: ReturnType<typeof createInterface>, defaultThemeKey: string): Promise<ThemeOption> {
  const themes = availableThemes();
  const defaultIndex = Math.max(
    themes.findIndex((theme) => theme.key === defaultThemeKey),
    0,
  );

  console.log("");
  console.log("Choose Theme:");
  themes.forEach((theme, index) => {
    console.log(`  ${index + 1}. ${theme.definition.displayName} - ${theme.definition.description}`);
  });
  console.log("");

  while (true) {
    const answer = (await reader.question(`Theme [${defaultIndex + 1}]: `)).trim();
    if (!answer) return themes[defaultIndex];

    const selectedNumber = Number(answer);
    if (Number.isInteger(selectedNumber) && selectedNumber >= 1 && selectedNumber <= themes.length) {
      return themes[selectedNumber - 1];
    }

    const selectedByKey = themes.find((theme) => theme.key === answer);
    if (selectedByKey) {
      return selectedByKey;
    }

    console.log(`Unknown theme selection: ${answer}`);
  }
}

function resolveThemeOption(themeKey?: string, fallbackThemeKey = "homerio"): ThemeOption {
  const themes = availableThemes();
  const requested = themeKey ? themes.find((theme) => theme.key === themeKey) : undefined;
  const fallback = themes.find((theme) => theme.key === fallbackThemeKey) ?? themes[0];
  const selected = requested ?? fallback;

  if (!selected) {
    fail("Theme discovery", "No themes were found in frontend-library/*/theme.json.");
    process.exit(1);
  }

  if (themeKey && !requested) {
    fail("Theme", `Unknown theme "${themeKey}". Available themes: ${themes.map((theme) => theme.key).join(", ")}.`);
    process.exit(1);
  }

  return selected;
}

function writeSiteThemeConfig(theme: ThemeOption) {
  const config = {
    theme: theme.key,
    version: theme.definition.version,
  };

  writeFileSync(siteThemePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  pass("Theme config written", path.relative(projectRoot, siteThemePath));
}

function writeInstanceThemeDefinition(theme: ThemeOption) {
  const content = `import type { ThemeDefinition } from "@/theme/types";

export const siteThemeDefinition: ThemeDefinition = ${JSON.stringify(theme.definition, null, 2)};
`;

  mkdirSync(path.dirname(instanceThemeDefinitionPath), { recursive: true });
  writeFileSync(instanceThemeDefinitionPath, content, "utf8");
  pass("Instance theme definition written", path.relative(projectRoot, instanceThemeDefinitionPath));
}

function writeInstanceThemeRuntime(theme: ThemeOption) {
  const manifest = loadThemeManifest(theme.definition);
  const runtimeFiles = collectThemeRuntimeFiles(manifest);
  const entries = runtimeFiles
    .map((file) => {
      const importPath = `../../${theme.definition.libraryPath}/${stripTsxExtension(file)}`;
      return `  ${JSON.stringify(file)}: () => import(${JSON.stringify(importPath)}),`;
    })
    .join("\n");
  const runtimeContent = `export type ThemeModuleLoader = () => Promise<Record<string, unknown>>;

export const siteThemeModuleLoaders: Record<string, ThemeModuleLoader> = {
${entries}
};
`;

  const previewEntry = manifest.preview?.page
    ? `  ${JSON.stringify(`${theme.key}:${manifest.preview.page}`)}: () => import(${JSON.stringify(`../../${theme.definition.libraryPath}/${stripTsxExtension(manifest.preview.page)}`)}),`
    : "";
  const previewContent = `export type ThemePreviewModuleLoader = () => Promise<Record<string, unknown>>;

export const siteThemePreviewModuleLoaders: Record<string, ThemePreviewModuleLoader> = {
${previewEntry}
};
`;

  mkdirSync(path.dirname(instanceThemeRuntimePath), { recursive: true });
  writeFileSync(instanceThemeRuntimePath, runtimeContent, "utf8");
  writeFileSync(instanceThemePreviewRuntimePath, previewContent, "utf8");
  pass("Instance theme runtime written", path.relative(projectRoot, instanceThemeRuntimePath));
}

function writeActiveThemeCss(theme: ThemeOption) {
  const manifest = loadThemeManifest(theme.definition);
  const styleEntry = manifest.styles.entry;

  if (!styleEntry) {
    fail("Theme styles", `${theme.key} does not define styles.entry in theme.json.`);
    process.exit(1);
  }

  mkdirSync(path.dirname(activeThemeCssPath), { recursive: true });
  writeFileSync(activeThemeCssPath, `@import "${theme.definition.package}/${styleEntry}";\n`, "utf8");
  pass("Active theme CSS written", path.relative(projectRoot, activeThemeCssPath));
}

type PackageJson = {
  name?: unknown;
  dependencies?: unknown;
  [key: string]: unknown;
};

function updatePackageJson(packageName: string, selectedTheme: ThemeOption) {
  if (!existsSync(packageJsonPath)) {
    fail("package.json", "package.json is missing.");
    process.exit(1);
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
  packageJson.name = packageName;

  const dependencies = isRecord(packageJson.dependencies) ? { ...packageJson.dependencies } : {};
  for (const theme of availableThemes()) {
    delete dependencies[theme.definition.package];
  }
  dependencies[selectedTheme.definition.package] = `file:./${selectedTheme.definition.libraryPath}`;
  packageJson.dependencies = dependencies;

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  pass("package.json updated", `${packageName} with ${selectedTheme.definition.package}`);
}

function collectThemeRuntimeFiles(manifest: ReturnType<typeof loadThemeManifest>) {
  return Array.from(
    new Set([
      ...Object.values(manifest.components).map((entry) => entry.file),
      ...Object.values(manifest.sections).map((entry) => entry.file),
      ...Object.values(manifest.layouts).map((entry) => entry.file),
      ...Object.values(manifest.shell).map((entry) => entry.file),
    ]),
  ).sort((a, b) => a.localeCompare(b));
}

function stripTsxExtension(filePath: string) {
  return filePath.replace(/\.[cm]?[tj]sx?$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeProductionUrl(domain: string, fallback: string) {
  if (!domain.trim()) return fallback;
  return `https://${domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "content-site"
  );
}

function parseSlugItems(value: string): SlugItem[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [nameRaw, slugRaw] = item.split(":").map((part) => part.trim());
      const name = nameRaw || "Untitled";
      return { name, slug: slugRaw || slugify(name) };
    });
}

function formatSlugItems(items: SlugItem[]) {
  return items.map((item) => `${item.name}:${item.slug}`).join(", ");
}

function parseHomepageModules(value: string): HomepageModule[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [keyRaw, labelRaw, enabledRaw] = item.split(":").map((part) => part.trim());
      return {
        key: keyRaw || slugify(labelRaw || "module"),
        label: labelRaw || keyRaw || "Module",
        enabled: enabledRaw ? ["true", "yes", "y", "1", "enabled"].includes(enabledRaw.toLowerCase()) : true,
      };
    });
}

function formatHomepageModules(items: HomepageModule[]) {
  return items.map((item) => `${item.key}:${item.label}:${String(item.enabled)}`).join(", ");
}

async function validateManifest(outputPath: string) {
  console.log("");
  console.log("Validating generated manifest...");
  const relativeOutputPath = path.relative(projectRoot, outputPath);
  const result = await runNpmScript("manifest:check", [`--file=${relativeOutputPath}`]);
  const combined = `${result.stdout}${result.stderr ? `\n${result.stderr}` : ""}`.trim();
  if (combined) console.log(combined);

  if (result.code !== 0) {
    fail("manifest:check", truncate(combined || "Validation failed."));
    process.exit(1);
  }
}

async function runNpmScript(script: string, args: string[] = []) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && existsSync(npmExecPath)) {
    return runCommand(process.execPath, [npmExecPath, "run", script, "--", ...args]);
  }
  return runCommand(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script, "--", ...args]);
}

function printNextSteps() {
  console.log("");
  console.log("Next steps:");
  console.log("  npm run manifest:apply");
  console.log("  npm run doctor");
  console.log("  npm run d1:init");
  console.log("  npm run preflight");
  console.log("  npm run publish");
}

function printHelp() {
  console.log("Usage:");
  console.log("  npm run create-site");
  console.log("  npm run create-site -- --output=starter.site.json");
  console.log("  npm run create-site -- --yes --theme=mocktailmuse --site-name=MocktailMuse Test --output=starter.site.generated.json");
  console.log("");
  console.log("Options:");
  console.log("  --help              Show this help.");
  console.log("  --yes               Use safe defaults non-interactively. Does not overwrite existing files.");
  console.log("  --output=<path>     Output manifest path. Default: starter.site.json.");
  console.log("  --theme=<key>       Use a registered theme key, such as homerio or mocktailmuse.");
  console.log("  --site-name=<name>  Override site name when using --yes.");
  console.log("");
  console.log("The wizard writes starter.site.json, site.theme.json, src/theme/active-theme.css, and package.json identity/theme dependency.");
}

function pass(label: string, detail: string) {
  console.log(`✓ PASS ${label} - ${detail}`);
}

function fail(label: string, detail: string) {
  console.log(`✗ FAIL ${label} - ${detail}`);
}

main().catch((error: unknown) => {
  fail("Create-site crashed", error instanceof Error ? error.message : "Unknown error.");
  process.exitCode = 1;
});
