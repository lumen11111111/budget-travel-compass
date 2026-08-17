import type { ComponentType } from "react";

import { loadThemeManifest } from "./manifest";
import { resolveSiteTheme } from "./resolver";
import { loadThemeRuntimeModule } from "./runtime-module-resolver";

export type ResolvedThemeSection = ComponentType<Record<string, unknown>>;

export async function resolveThemeSection(sectionKey: string): Promise<ResolvedThemeSection> {
  const theme = resolveSiteTheme();
  const manifest = loadThemeManifest(theme);
  const metadata = manifest.sections[sectionKey];

  if (!metadata) {
    throw new Error(`Theme manifest for "${theme.name}" does not define section "${sectionKey}".`);
  }

  assertThemePackage(theme.package, manifest.package);
  const module = await loadThemeRuntimeModule(theme, metadata);
  const section = module[metadata.export];

  if (typeof section !== "function") {
    throw new Error(`Theme section "${sectionKey}" export "${metadata.export}" was not found or is not a React component.`);
  }

  return section as ResolvedThemeSection;
}

function assertThemePackage(registryPackage: string, manifestPackage: string | undefined) {
  if (!manifestPackage) {
    return;
  }

  if (manifestPackage !== registryPackage) {
    throw new Error(`Theme package mismatch: registry uses "${registryPackage}", but manifest uses "${manifestPackage}".`);
  }
}
