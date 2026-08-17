import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseThemeManifest } from "../../src/theme/manifest";
import type { ThemeDefinition, ThemeManifest } from "../../src/theme/types";

export type DiscoveredTheme = {
  key: string;
  rootPath: string;
  manifestPath: string;
  manifest: ThemeManifest;
  definition: ThemeDefinition;
};

export function discoverThemes(root = process.cwd()): DiscoveredTheme[] {
  const libraryRoot = path.join(root, "frontend-library");
  if (!existsSync(libraryRoot)) return [];

  return readdirSync(libraryRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readThemeIfPresent(root, entry.name))
    .filter((theme): theme is DiscoveredTheme => Boolean(theme))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function discoverTheme(themeKey: string, root = process.cwd()): DiscoveredTheme | undefined {
  return discoverThemes(root).find((theme) => theme.key === themeKey);
}

export function requiredTheme(themeKey: string, root = process.cwd()): DiscoveredTheme {
  const theme = discoverTheme(themeKey, root);
  if (!theme) {
    const available = discoverThemes(root).map((item) => item.key).join(", ") || "none";
    throw new Error(`Unsupported theme "${themeKey}". Available themes: ${available}.`);
  }
  return theme;
}

function readThemeIfPresent(root: string, folderName: string): DiscoveredTheme | null {
  const rootPath = path.join(root, "frontend-library", folderName);
  const manifestPath = path.join(rootPath, "theme.json");
  if (!existsSync(manifestPath)) return null;

  const manifest = parseThemeManifest(JSON.parse(stripBom(readFileSync(manifestPath, "utf8"))));
  const key = manifest.name || folderName;
  const normalizedKey = String(key).trim();
  if (!normalizedKey) throw new Error(`Theme manifest at ${manifestPath} is missing name.`);

  const packageName = manifest.package || `@contentforge/theme-${normalizedKey}`;
  const version = manifest.version || "0.0.0";
  const description = manifest.description || `${normalizedKey} ContentForge theme.`;

  return {
    key: normalizedKey,
    rootPath,
    manifestPath,
    manifest,
    definition: {
      name: toDisplayName(normalizedKey),
      displayName: toDisplayName(normalizedKey),
      description,
      version,
      package: packageName,
      type: "frontend-theme",
      libraryPath: `frontend-library/${folderName}`,
      capabilities: manifest.capabilities,
    },
  };
}

function toDisplayName(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
