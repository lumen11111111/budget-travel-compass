import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { siteThemeConfig } from "@/instance/theme.config";
import { themeRegistry } from "./registry";
import type { RawThemeConfig, ThemeConfig, ThemeDefinition } from "./types";

const defaultThemeConfigPath = "site.theme.json";

export function loadThemeDefinition(config: ThemeConfig = siteThemeConfig): ThemeDefinition {
  const theme = themeRegistry[config.name];

  if (!theme) {
    throw new Error(`Unknown ContentForge theme "${config.name}". Register it in src/theme/registry.ts before using it.`);
  }

  if (theme.version !== config.version) {
    throw new Error(`Theme version mismatch for "${config.name}": site.theme.json uses ${config.version}, but registry has ${theme.version}.`);
  }

  return theme;
}

export function loadThemeConfig(configPath = path.join(process.cwd(), defaultThemeConfigPath)): ThemeConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Theme config not found at ${configPath}. Create site.theme.json for this Site Instance.`);
  }

  const raw = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
  return parseThemeConfig(raw);
}

function parseThemeConfig(value: unknown): ThemeConfig {
  if (!isRecord(value)) {
    throw new Error("site.theme.json must contain a JSON object.");
  }

  const rawConfig = value as RawThemeConfig;
  const themeName = rawConfig.name ?? rawConfig.theme;
  const { version } = rawConfig;

  if (typeof themeName !== "string" || themeName.trim() === "") {
    throw new Error("site.theme.json requires a non-empty string field: name or theme.");
  }

  if (typeof version !== "string" || version.trim() === "") {
    throw new Error("site.theme.json requires a non-empty string field: version.");
  }

  return {
    name: themeName,
    version,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
