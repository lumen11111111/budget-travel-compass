import type { ComponentType } from "react";

import { loadThemeManifest } from "./manifest";
import { resolveSiteTheme } from "./resolver";
import { loadThemeRuntimeModule } from "./runtime-module-resolver";

export type ResolvedThemeShell = ComponentType<Record<string, unknown>>;

export async function resolveThemeShell(shellKey: string): Promise<ResolvedThemeShell> {
  const theme = resolveSiteTheme();
  const manifest = loadThemeManifest(theme);
  const metadata = manifest.shell[shellKey];

  if (!metadata) {
    throw new Error(`Theme manifest for "${theme.name}" does not define shell "${shellKey}".`);
  }

  assertThemePackage(theme.package, manifest.package);
  const module = await loadThemeRuntimeModule(theme, metadata);
  const shell = module[metadata.export];

  if (typeof shell !== "function") {
    throw new Error(`Theme shell "${shellKey}" export "${metadata.export}" was not found or is not a React component.`);
  }

  return shell as ResolvedThemeShell;
}

function assertThemePackage(registryPackage: string, manifestPackage: string | undefined) {
  if (!manifestPackage) {
    return;
  }

  if (manifestPackage !== registryPackage) {
    throw new Error(`Theme package mismatch: registry uses "${registryPackage}", but manifest uses "${manifestPackage}".`);
  }
}
