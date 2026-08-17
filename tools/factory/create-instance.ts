import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeSlash, runCommand } from "../starter/cli-utils";
import { discoverThemes, requiredTheme, type DiscoveredTheme } from "../starter/theme-discovery";

type CreateInstanceArgs = {
  theme: string;
  siteName: string;
  output: string;
};

type JsonObject = Record<string, unknown>;

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
};

type FrameworkVersion = {
  version?: string;
};

const frameworkRoot = process.cwd();

const directoriesToCopy = ["src", "public", "data", "scripts", "tools"] as const;
const rootFilesToCopy = [
  ".gitignore",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.ts",
  "open-next.config.ts",
  "postcss.config.mjs",
  "tailwind.config.ts",
  "eslint.config.mjs",
  "wrangler.jsonc",
  "env.example",
  ".dev.vars.example",
  "next-env.d.ts",
  "starter.site.example.json",
] as const;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(frameworkRoot, args.output);

  await assertNodeRuntime();
  const theme = validateTheme(args.theme);
  await assertOutputDirectoryReady(outputPath);

  await mkdir(outputPath, { recursive: true });
  await copyInstanceSkeleton(outputPath, theme);
  await writeInstanceVersion(outputPath);
  await customizeGeneratedPackage(outputPath, args, theme);
  await bootstrapInstance(outputPath, args, theme);

  console.log("ContentForge Website Instance ready.");
  console.log(`Theme: ${args.theme}`);
  console.log(`Site name: ${args.siteName}`);
  console.log(`Output: ${normalizeSlash(outputPath)}`);
  console.log("");
  console.log("Next steps:");
  console.log(`1. cd ${quotePath(outputPath)}`);
  console.log("2. npm run typecheck");
  console.log("3. npm run build");
  console.log("4. Review local preview, branding, categories, and content.");
  console.log("5. npm run acceptance -- --quick");
  console.log("6. npm run production:setup -- --plan");
  console.log("7. npm run production:setup -- --remote-check");
  console.log("8. Set the temporary runtime admin password in the current PowerShell session:");
  console.log("   $env:CONTENTFORGE_ADMIN_PASSWORD = \"<ADMIN_PASSWORD>\"");
  console.log("9. Run production:setup -- --execute only with explicit --account-id and per-operation allow flags.");
  console.log("10. npm run production:doctor -- --remote");
  console.log("11. npm run acceptance -- --production --full");
  console.log("12. npm run acceptance -- --production --full --remote");
  console.log("13. npm run seo:sitemap-check -- --url=https://your-domain.com/sitemap.xml");
  console.log("14. Clear the temporary runtime admin password:");
  console.log("   Remove-Item Env:CONTENTFORGE_ADMIN_PASSWORD");
}

function parseArgs(rawArgs: string[]): CreateInstanceArgs {
  const values = new Map<string, string>();

  for (const arg of rawArgs) {
    if (!arg.startsWith("--")) continue;
    const separatorIndex = arg.indexOf("=");
    if (separatorIndex === -1) {
      fail(`Invalid argument "${arg}". Use --key=value format.`);
    }
    const key = arg.slice(2, separatorIndex);
    const value = arg.slice(separatorIndex + 1).trim();
    values.set(key, value);
  }

  const theme = values.get("theme")?.trim();
  const siteName = values.get("site-name")?.trim();
  const output = values.get("output")?.trim();

  if (!theme || !siteName || !output) {
    printHelp();
    fail("Missing required arguments: --theme, --site-name, and --output are required.");
  }

  return { theme, siteName, output };
}

async function assertNodeRuntime() {
  const result = await runCommand(process.execPath, ["--version"], { cwd: frameworkRoot });
  if (result.code !== 0) {
    fail(`Unable to verify Node runtime: ${result.stderr || result.stdout || "unknown error"}`);
  }
}

function validateTheme(theme: string) {
  try {
    return requiredTheme(theme, frameworkRoot);
  } catch (error) {
    const available = discoverThemes(frameworkRoot).map((item) => item.key).join(", ") || "none";
    fail(error instanceof Error ? error.message : `Unsupported theme "${theme}". Available themes: ${available}.`);
  }
}

async function assertOutputDirectoryReady(outputPath: string) {
  if (!existsSync(outputPath)) return;

  const outputStats = await stat(outputPath);
  if (!outputStats.isDirectory()) {
    fail(`Output path exists and is not a directory: ${normalizeSlash(outputPath)}`);
  }

  const entries = await readdir(outputPath);
  if (entries.length > 0) {
    fail(`Output directory must be empty: ${normalizeSlash(outputPath)}`);
  }
}

async function copyInstanceSkeleton(outputPath: string, theme: DiscoveredTheme) {
  for (const directory of directoriesToCopy) {
    await copyPath(path.join(frameworkRoot, directory), path.join(outputPath, directory));
  }

  await copyPath(theme.rootPath, path.join(outputPath, theme.definition.libraryPath));

  for (const file of rootFilesToCopy) {
    await copyPath(path.join(frameworkRoot, file), path.join(outputPath, file));
  }
}

async function copyPath(source: string, destination: string) {
  if (!existsSync(source)) {
    fail(`Required source missing: ${normalizeSlash(source)}`);
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, {
    recursive: true,
    force: false,
    errorOnExist: true,
    filter: (sourcePath) => !shouldExcludePath(sourcePath),
  });
}

async function writeInstanceVersion(outputPath: string) {
  const frameworkVersion = await readJson(path.join(frameworkRoot, "framework.version.json")) as FrameworkVersion;
  const version = frameworkVersion.version;

  if (typeof version !== "string" || !version.trim()) {
    fail("framework.version.json is missing a valid version.");
  }

  await writeFile(path.join(outputPath, ".contentforge-version"), `${version.trim()}\n`, "utf8");
}

function shouldExcludePath(sourcePath: string) {
  const normalized = normalizeSlash(path.relative(frameworkRoot, sourcePath));
  const segments = normalized.split("/");
  return segments.some((segment) =>
    [
      "node_modules",
      ".next",
      ".open-next",
      ".wrangler",
      ".git",
      "docs",
      ".agents",
      ".codex",
      ".cursor",
      ".superpowers",
      "outputs",
    ].includes(segment),
  );
}

async function customizeGeneratedPackage(outputPath: string, args: CreateInstanceArgs, theme: DiscoveredTheme) {
  const packagePath = path.join(outputPath, "package.json");
  const lockPath = path.join(outputPath, "package-lock.json");
  const selectedPackage = theme.definition.package;
  const selectedPackageVersion = `file:./${theme.definition.libraryPath}`;
  const packageJson = await readJson(packagePath);
  const packageLock = await readJson(lockPath);

  packageJson.name = slugifyPackageName(args.siteName);
  packageJson.dependencies = keepSelectedThemeDependency(packageJson.dependencies, selectedPackage, selectedPackageVersion);

  packageLock.name = packageJson.name;
  const rootPackage = isRecord(packageLock.packages) ? packageLock.packages[""] : undefined;
  if (isRecord(rootPackage)) {
    rootPackage.name = packageJson.name;
    rootPackage.dependencies = keepSelectedThemeDependency(rootPackage.dependencies, selectedPackage, selectedPackageVersion);
  }

  pruneThemeLockEntries(packageLock, selectedPackage);

  await writeJson(packagePath, packageJson);
  await writeJson(lockPath, packageLock);
}

async function bootstrapInstance(outputPath: string, args: CreateInstanceArgs, theme: DiscoveredTheme) {
  const command = npmCommand();

  if (process.env.CONTENTFORGE_FACTORY_SKIP_INSTALL === "1") {
    console.log("SKIP npm install - CONTENTFORGE_FACTORY_SKIP_INSTALL=1");
  } else {
    await runBootstrapStep("npm install", command, ["install"], outputPath);
  }
  await runBootstrapStep(
    "npm run create-site",
    command,
    ["run", "create-site", "--", "--yes", `--theme=${args.theme}`, `--site-name=${args.siteName}`],
    outputPath,
  );
  await writeInstanceThemeBinding(outputPath, theme);
  await hydrateInstanceConfig(outputPath);
  await runBootstrapStep("npm run doctor", command, ["run", "doctor"], outputPath);
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function runBootstrapStep(label: string, command: string, commandArgs: string[], cwd: string) {
  console.log(`Running ${label}...`);
  const result = await runCommand(command, commandArgs, { cwd, shell: true });

  if (result.code !== 0) {
    console.error(`FAIL ${label}`);
    if (result.stderr.trim()) {
      console.error(result.stderr.trim());
    } else if (result.stdout.trim()) {
      console.error(result.stdout.trim());
    } else {
      console.error(`Command exited with code ${result.code ?? "unknown"}.`);
    }
    process.exit(1);
  }

  console.log(`PASS ${label}`);
}

async function hydrateInstanceConfig(outputPath: string) {
  console.log("Running instance config hydration...");
  const manifest = await readSiteManifest(path.join(outputPath, "starter.site.json"));

  await hydrateSiteConfig(path.join(outputPath, "src", "instance", "site.config.ts"), manifest);
  await hydrateSeoConfig(path.join(outputPath, "src", "instance", "seo.config.ts"));

  console.log("PASS instance config hydration");
}

async function writeInstanceThemeBinding(outputPath: string, theme: DiscoveredTheme) {
  console.log("Running instance theme config binding...");
  const themeManifest = await readJson(path.join(outputPath, theme.definition.libraryPath, "theme.json"));
  const version = themeManifest.version;

  if (typeof version !== "string" || !version.trim()) {
    fail(`Theme manifest for "${theme}" is missing a version.`);
  }

  const configPath = path.join(outputPath, "src", "instance", "theme.config.ts");
  const content = `import type { ThemeConfig } from "@/theme/types";

export const siteThemeConfig: ThemeConfig = {
  name: ${JSON.stringify(theme.key)},
  version: ${JSON.stringify(version)},
};
`;

  await writeFile(configPath, content, "utf8");
  await writeInstanceThemeDefinition(outputPath, theme);
  await writeInstanceThemeRuntime(outputPath, theme.key, themeManifest);
  console.log("PASS instance theme config binding");
}

async function writeInstanceThemeDefinition(outputPath: string, theme: DiscoveredTheme) {
  const definitionPath = path.join(outputPath, "src", "instance", "theme.definition.ts");
  const content = `import type { ThemeDefinition } from "@/theme/types";

export const siteThemeDefinition: ThemeDefinition = ${JSON.stringify(theme.definition, null, 2)};
`;

  await writeFile(definitionPath, content, "utf8");
}

async function writeInstanceThemeRuntime(outputPath: string, theme: string, themeManifest: JsonObject) {
  const files = collectThemeRuntimeFiles(themeManifest);
  const runtimePath = path.join(outputPath, "src", "instance", "theme-runtime.ts");
  const entries = files
    .map((file) => {
      const importPath = `../../frontend-library/${theme}/${stripTsxExtension(file)}`;
      return `  ${JSON.stringify(file)}: () => import(${JSON.stringify(importPath)}),`;
    })
    .join("\n");
  const content = `export type ThemeModuleLoader = () => Promise<Record<string, unknown>>;

export const siteThemeModuleLoaders: Record<string, ThemeModuleLoader> = {
${entries}
};
`;

  await writeFile(runtimePath, content, "utf8");
  await writeInstanceThemePreviewRuntime(outputPath, theme, themeManifest);
}

async function writeInstanceThemePreviewRuntime(outputPath: string, theme: string, themeManifest: JsonObject) {
  const preview = themeManifest.preview;
  const previewPage = isRecord(preview) && typeof preview.page === "string" ? preview.page : undefined;
  const runtimePath = path.join(outputPath, "src", "instance", "theme-preview-runtime.ts");
  const entry = previewPage
    ? `  ${JSON.stringify(`${theme}:${previewPage}`)}: () => import(${JSON.stringify(`../../frontend-library/${theme}/${stripTsxExtension(previewPage)}`)}),`
    : "";
  const content = `export type ThemePreviewModuleLoader = () => Promise<Record<string, unknown>>;

export const siteThemePreviewModuleLoaders: Record<string, ThemePreviewModuleLoader> = {
${entry}
};
`;

  await writeFile(runtimePath, content, "utf8");
}

function collectThemeRuntimeFiles(themeManifest: JsonObject) {
  const files = new Set<string>();

  for (const blockName of ["layouts", "components", "sections", "shell"]) {
    const registry = getManifestRegistry(themeManifest[blockName], blockName);
    for (const [key, entry] of Object.entries(registry)) {
      if (!isRecord(entry) || typeof entry.file !== "string" || !entry.file.trim()) {
        fail(`Theme manifest ${blockName}.registry.${key}.file must be a non-empty string.`);
      }
      files.add(entry.file);
    }
  }

  return Array.from(files).sort((a, b) => a.localeCompare(b));
}

function getManifestRegistry(value: unknown, blockName: string): JsonObject {
  if (!isRecord(value)) {
    fail(`Theme manifest ${blockName} must contain a registry object.`);
  }

  if (!isRecord(value.registry)) {
    fail(`Theme manifest ${blockName}.registry must contain a registry object.`);
  }

  return value.registry;
}

function stripTsxExtension(filePath: string) {
  return filePath.replace(/\.[cm]?[tj]sx?$/, "");
}

async function readSiteManifest(manifestPath: string): Promise<SiteManifest> {
  const manifest = await readJson(manifestPath);
  const requiredFields = [
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
  ] as const;

  for (const field of requiredFields) {
    if (typeof manifest[field] !== "string" || !manifest[field].trim()) {
      fail(`starter.site.json is missing required string field: ${field}`);
    }
  }

  return manifest as SiteManifest;
}

async function hydrateSiteConfig(filePath: string, manifest: SiteManifest) {
  let content = await readFile(filePath, "utf8");

  content = replaceStringProperty(content, "name", manifest.siteName);
  content = replaceStringProperty(content, "domain", manifest.domain);
  content = replaceStringProperty(content, "url", manifest.productionUrl);
  content = replaceStringProperty(content, "tagline", manifest.tagline);
  content = replaceStringProperty(content, "description", manifest.description);
  content = replaceStringProperty(content, "defaultSeoTitle", `${manifest.siteName} - ${manifest.tagline}`);
  content = replaceStringProperty(content, "defaultSeoDescription", manifest.description);
  content = replaceStringProperty(content, "contactEmail", manifest.contactEmail);
  content = replaceStringProperty(content, "supportEmail", manifest.supportEmail);
  content = replaceStringProperty(content, "legalEmail", manifest.legalEmail);
  content = replaceStringProperty(content, "teamName", manifest.teamName);
  content = replaceStringProperty(content, "editorialTeamName", manifest.editorialTeamName);
  content = replaceOperatorStringProperty(content, "name", manifest.operatorName);
  content = replaceOperatorStringProperty(content, "country", manifest.operatorCountry);
  content = replaceOperatorStringProperty(content, "legalStatus", manifest.legalStatus);

  await writeFile(filePath, content, "utf8");
}

async function hydrateSeoConfig(filePath: string) {
  let content = await readFile(filePath, "utf8");

  content = content.replace(/title:\s*siteConfig\.defaultSeoTitle,/, "title: siteConfig.defaultSeoTitle,");
  content = content.replace(/description:\s*siteConfig\.defaultSeoDescription,/, "description: siteConfig.defaultSeoDescription,");

  await writeFile(filePath, content, "utf8");
}

function replaceStringProperty(content: string, property: string, value: string) {
  const pattern = new RegExp(`(\\b${escapeRegExp(property)}:\\s*)"(?:[^"\\\\]|\\\\.)*"`);
  if (!pattern.test(content)) {
    fail(`Unable to hydrate src/instance/site.config.ts field: ${property}`);
  }
  return content.replace(pattern, `$1${JSON.stringify(value)}`);
}

function replaceOperatorStringProperty(content: string, property: string, value: string) {
  const operatorPattern = /(operator:\s*\{)([\s\S]*?)(\n\s*\},)/;
  const match = content.match(operatorPattern);
  if (!match) {
    fail("Unable to hydrate src/instance/site.config.ts operator block.");
  }

  const hydratedOperatorBody = replaceStringProperty(match[2] ?? "", property, value);
  return content.replace(operatorPattern, `$1${hydratedOperatorBody}$3`);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keepSelectedThemeDependency(value: unknown, selectedPackage: string, selectedPackageVersion: string) {
  const source = isRecord(value) ? value : {};
  const next: JsonObject = {};

  for (const [key, dependencyValue] of Object.entries(source)) {
    if (key.startsWith("@contentforge/theme-") && key !== selectedPackage) continue;
    next[key] = dependencyValue;
  }
  next[selectedPackage] = selectedPackageVersion;

  return next;
}

function pruneThemeLockEntries(packageLock: JsonObject, selectedPackage: string) {
  if (!isRecord(packageLock.packages)) return;

  const selectedTheme = selectedPackage.replace("@contentforge/theme-", "");
  for (const key of Object.keys(packageLock.packages)) {
    const isThemePackage = key.startsWith("frontend-library/") || key.startsWith("node_modules/@contentforge/theme-");
    const isSelectedThemePackage =
      key === `frontend-library/${selectedTheme}` || key === `node_modules/${selectedPackage}`;

    if (isThemePackage && !isSelectedThemePackage) {
      delete packageLock.packages[key];
    }
  }
}

async function readJson(filePath: string) {
  return JSON.parse(stripBom(await readFile(filePath, "utf8"))) as JsonObject;
}

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

async function writeJson(filePath: string, value: JsonObject) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugifyPackageName(input: string) {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "contentforge-instance";
}

function quotePath(input: string) {
  return input.includes(" ") ? `"${input}"` : input;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function printHelp() {
  console.log("Usage:");
  console.log("  npm run create-instance -- --theme=<theme> --site-name=<name> --output=<path>");
  console.log("");
  console.log("Example:");
  console.log('  npm run create-instance -- --theme=mocktailmuse --site-name="MocktailMuse Production" --output="E:\\websites\\mocktailmuse-production"');
}

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : "Unknown create-instance error.");
});
