import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type {
  ThemeComponentManifestEntry,
  ThemeComponentType,
  ThemeDefinition,
  ThemeManifest,
  ThemeModuleManifestEntry,
  ThemePreviewManifest,
  ThemeStylesManifest,
} from "./types";

type RegistryBlock = {
  registry?: unknown;
};

export function loadThemeManifest(theme: ThemeDefinition): ThemeManifest {
  return loadThemeManifestFromPath(path.join(process.cwd(), theme.libraryPath, "theme.json"));
}

export function loadThemeManifestFromPath(themeJsonPath: string): ThemeManifest {
  if (!existsSync(themeJsonPath)) {
    throw new Error(`Theme manifest not found at ${themeJsonPath}.`);
  }

  const raw = JSON.parse(stripBom(readFileSync(themeJsonPath, "utf8"))) as unknown;
  return parseThemeManifest(raw);
}

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export function parseThemeManifest(value: unknown): ThemeManifest {
  if (!isRecord(value)) {
    throw new Error("theme.json must contain a JSON object.");
  }

  return {
    name: optionalString(value.name, "name"),
    package: optionalString(value.package, "package"),
    type: optionalString(value.type, "type"),
    version: optionalString(value.version, "version"),
    description: optionalString(value.description, "description"),
    capabilities: parseStringArray(value.capabilities, "capabilities"),
    components: parseComponentRegistry(value.components),
    sections: parseModuleRegistry(value.sections, "sections"),
    layouts: parseModuleRegistry(value.layouts, "layouts"),
    shell: parseModuleRegistry(value.shell, "shell"),
    styles: parseStyles(value.styles),
    preview: parsePreview(value.preview),
  };
}

function parseComponentRegistry(value: unknown): Record<string, ThemeComponentManifestEntry> {
  const registry = getRegistryRecord(value, "components");
  const entries: Record<string, ThemeComponentManifestEntry> = {};

  for (const [key, entry] of Object.entries(registry)) {
    if (!isRecord(entry)) {
      throw new Error(`theme.json components.registry.${key} must contain a JSON object.`);
    }

    const file = requiredString(entry.file, `components.registry.${key}.file`);
    const exportName = requiredString(entry.export, `components.registry.${key}.export`);
    const type = parseComponentType(entry.type, `components.registry.${key}.type`);

    entries[key] = {
      file,
      export: exportName,
      type,
    };
  }

  return entries;
}

function parseModuleRegistry(value: unknown, label: string): Record<string, ThemeModuleManifestEntry> {
  const registry = getRegistryRecord(value, label);
  const entries: Record<string, ThemeModuleManifestEntry> = {};

  for (const [key, entry] of Object.entries(registry)) {
    if (!isRecord(entry)) {
      throw new Error(`theme.json ${label}.registry.${key} must contain a JSON object.`);
    }

    entries[key] = {
      file: requiredString(entry.file, `${label}.registry.${key}.file`),
      export: requiredString(entry.export, `${label}.registry.${key}.export`),
    };
  }

  return entries;
}

function getRegistryRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    throw new Error(`theme.json ${label} must contain a JSON object.`);
  }

  const block = value as RegistryBlock;
  if (block.registry === undefined) {
    return {};
  }

  if (!isRecord(block.registry)) {
    throw new Error(`theme.json ${label}.registry must contain a JSON object.`);
  }

  return block.registry;
}

function parseStyles(value: unknown): ThemeStylesManifest {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    throw new Error("theme.json styles must contain a JSON object.");
  }

  return {
    entry: optionalString(value.entry, "styles.entry"),
    tokens: optionalBoolean(value.tokens, "styles.tokens"),
    components: optionalBoolean(value.components, "styles.components"),
  };
}

function parsePreview(value: unknown): ThemePreviewManifest | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error("theme.json preview must contain a JSON object.");
  }

  return {
    page: requiredString(value.page, "preview.page"),
    data: optionalString(value.data, "preview.data"),
  };
}

function parseStringArray(value: unknown, label: string): readonly string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`theme.json ${label} must contain an array.`);
  }

  return value.map((item, index) => requiredString(item, `${label}.${index}`));
}

function parseComponentType(value: unknown, label: string): ThemeComponentType {
  const type = requiredString(value, label);

  if (type !== "server-component" && type !== "client-component") {
    throw new Error(`theme.json ${label} must be "server-component" or "client-component".`);
  }

  return type;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`theme.json ${label} must be a non-empty string.`);
  }

  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requiredString(value, label);
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`theme.json ${label} must be a boolean.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
