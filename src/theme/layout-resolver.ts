import type { ComponentType } from "react";

import { loadThemeManifest } from "./manifest";
import { resolveSiteTheme } from "./resolver";
import { loadThemeRuntimeModule } from "./runtime-module-resolver";

export type ResolvedThemeLayout = ComponentType<Record<string, unknown>>;

export async function resolveThemeLayout(layoutKey: string): Promise<ResolvedThemeLayout> {
  const theme = resolveSiteTheme();
  const manifest = loadThemeManifest(theme);
  const metadata = manifest.layouts[layoutKey];

  if (!metadata) {
    throw new Error(`Theme manifest for "${theme.name}" does not define layout "${layoutKey}".`);
  }

  assertThemePackage(theme.package, manifest.package);
  const module = await loadThemeRuntimeModule(theme, metadata);
  const layout = module[metadata.export];

  if (typeof layout !== "function") {
    throw new Error(`Theme layout "${layoutKey}" export "${metadata.export}" was not found or is not a React component.`);
  }

  return layout as ResolvedThemeLayout;
}

function assertThemePackage(registryPackage: string, manifestPackage: string | undefined) {
  if (!manifestPackage) {
    return;
  }

  if (manifestPackage !== registryPackage) {
    throw new Error(`Theme package mismatch: registry uses "${registryPackage}", but manifest uses "${manifestPackage}".`);
  }
}
