import type { ComponentType } from "react";
import { existsSync } from "node:fs";
import path from "node:path";

import { loadThemeManifest } from "./manifest";
import { themeRegistry } from "./registry";
import { resolveSiteTheme } from "./resolver";
import type { ThemeDefinition } from "./types";
import { siteThemePreviewModuleLoaders } from "@/instance/theme-preview-runtime";

type ThemeModule = Record<string, unknown>;

export type ThemePreviewEntry = {
  themeKey: string;
  themeName: string;
  packageName: string;
  page: string;
  data?: string;
  importPath: string;
  dataImportPath?: string;
};

export type ResolvedThemePreview = ComponentType<Record<string, never>>;

export function resolveThemePreview(theme: ThemeDefinition = resolveSiteTheme()): ThemePreviewEntry {
  const themeKey = getThemeKey(theme);
  const manifest = loadThemeManifest(theme);
  const page = manifest.preview?.page ?? "preview/page.tsx";
  const data = manifest.preview?.data;
  const packageName = resolvePackageName(theme.package, manifest.package);

  assertPreviewSourceExists(theme, page, "page");
  if (data) {
    assertPreviewSourceExists(theme, data, "data");
  }

  return {
    themeKey,
    themeName: theme.name,
    packageName,
    page,
    data,
    importPath: `${packageName}/${page}`,
    dataImportPath: data ? `${packageName}/${data}` : undefined,
  };
}

export function resolveThemePreviewByKey(themeKey: string): ThemePreviewEntry {
  const theme = themeRegistry[themeKey];

  if (!theme) {
    throw new Error(`Unknown ContentForge theme "${themeKey}". Register it in src/theme/registry.ts before previewing it.`);
  }

  return resolveThemePreview(theme);
}

export async function loadThemePreviewComponent(entry: ThemePreviewEntry): Promise<ResolvedThemePreview> {
  const loaderKey = `${entry.themeKey}:${entry.page}`;
  const loader = siteThemePreviewModuleLoaders[loaderKey];

  if (!loader) {
    throw new Error(`Theme preview module "${loaderKey}" is not registered for this ContentForge instance.`);
  }

  const module = (await loader()) as ThemeModule;
  const component = module.default;

  if (typeof component !== "function") {
    throw new Error(`Theme preview "${entry.themeKey}" does not export a default React component.`);
  }

  return component as ResolvedThemePreview;
}

function getThemeKey(theme: ThemeDefinition): string {
  const entry = Object.entries(themeRegistry).find(([, definition]) => definition === theme || definition.package === theme.package);

  if (!entry) {
    throw new Error(`Theme "${theme.name}" is not registered.`);
  }

  return entry[0];
}

function assertPreviewSourceExists(theme: ThemeDefinition, filePath: string, label: "page" | "data") {
  const absolutePath = path.join(process.cwd(), theme.libraryPath, filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Theme preview ${label} for "${theme.name}" was not found at ${absolutePath}.`);
  }
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
