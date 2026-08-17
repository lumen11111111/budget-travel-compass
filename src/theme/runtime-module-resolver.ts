import { siteThemeConfig } from "@/instance/theme.config";
import { siteThemeModuleLoaders } from "@/instance/theme-runtime";
import type { ThemeDefinition, ThemeModuleManifestEntry } from "./types";

export type ThemeRuntimeModule = Record<string, unknown>;

export async function loadThemeRuntimeModule(
  theme: ThemeDefinition,
  metadata: ThemeModuleManifestEntry,
): Promise<ThemeRuntimeModule> {
  const loader = siteThemeModuleLoaders[metadata.file];

  if (!loader) {
    throw new Error(
      `Theme runtime module "${metadata.file}" is not registered for active site theme "${siteThemeConfig.name}" (${theme.name}).`,
    );
  }

  return loader();
}
