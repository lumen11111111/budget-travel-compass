import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { resolveSiteTheme } from "./resolver";
import type { ThemeComponentRegistry, ThemeDefinition } from "./types";

type ThemeJson = {
  components?: unknown;
};

type ThemeComponentsBlock = {
  registry?: unknown;
};

export function resolveThemeComponents(theme: ThemeDefinition = resolveSiteTheme()): ThemeComponentRegistry {
  const themeJsonPath = path.join(process.cwd(), theme.libraryPath, "theme.json");

  if (!existsSync(themeJsonPath)) {
    throw new Error(`Theme manifest not found at ${themeJsonPath}.`);
  }

  const themeJson = JSON.parse(readFileSync(themeJsonPath, "utf8")) as ThemeJson;
  return parseThemeComponentRegistry(themeJson.components);
}

function parseThemeComponentRegistry(value: unknown): ThemeComponentRegistry {
  if (!isRecord(value)) {
    return {};
  }

  const registryValue = value.registry;
  const registry: Record<string, unknown> = isRecord(registryValue) ? registryValue : value;
  const components: ThemeComponentRegistry = {};

  for (const [key, enabled] of Object.entries(registry)) {
    if (typeof enabled === "boolean") {
      components[key] = enabled;
    }
  }

  return components;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
