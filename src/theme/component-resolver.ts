import type { ComponentType } from "react";

import { loadThemeManifest } from "./manifest";
import { resolveSiteTheme } from "./resolver";
import { loadThemeRuntimeModule } from "./runtime-module-resolver";

export type ResolvedThemeComponent = ComponentType<Record<string, unknown>>;

export async function resolveThemeComponent(componentKey: string): Promise<ResolvedThemeComponent> {
  const theme = resolveSiteTheme();
  const manifest = loadThemeManifest(theme);
  const metadata = manifest.components[componentKey];

  if (!metadata) {
    throw new Error(`Theme manifest for "${theme.name}" does not define component "${componentKey}".`);
  }

  assertThemePackage(theme.package, manifest.package);
  const module = await loadThemeRuntimeModule(theme, metadata);
  const component = module[metadata.export];

  if (typeof component !== "function") {
    throw new Error(`Theme component "${componentKey}" export "${metadata.export}" was not found or is not a React component.`);
  }

  return component as ResolvedThemeComponent;
}

function assertThemePackage(registryPackage: string, manifestPackage: string | undefined) {
  if (!manifestPackage) {
    return;
  }

  if (manifestPackage !== registryPackage) {
    throw new Error(`Theme package mismatch: registry uses "${registryPackage}", but manifest uses "${manifestPackage}".`);
  }
}
