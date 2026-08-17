import { loadThemeManifest } from "./manifest";
import { resolveSiteTheme } from "./resolver";
import type { ThemeDefinition, ThemeStyleEntry } from "./types";

export function resolveThemeStyleEntry(theme: ThemeDefinition = resolveSiteTheme()): ThemeStyleEntry {
  const manifest = loadThemeManifest(theme);
  const entry = manifest.styles.entry;

  if (!entry) {
    throw new Error(`Theme manifest for "${theme.name}" does not define styles.entry.`);
  }

  const packageName = resolvePackageName(theme.package, manifest.package);

  return {
    themeName: theme.name,
    packageName,
    entry,
    importPath: `${packageName}/${entry}`,
  };
}

function resolvePackageName(registryPackage: string, manifestPackage: string | undefined): string {
  if (!manifestPackage) {
    return registryPackage;
  }

  if (manifestPackage !== registryPackage) {
    throw new Error(`Theme package mismatch: registry uses "${registryPackage}", but manifest uses "${manifestPackage}".`);
  }

  return manifestPackage;
}
