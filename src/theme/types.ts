export type ThemeConfig = {
  name: string;
  version: string;
};

export type RawThemeConfig = {
  name?: unknown;
  theme?: unknown;
  version?: unknown;
};

export type ThemeDefinition = {
  name: string;
  displayName: string;
  description: string;
  version: string;
  package: string;
  type: "frontend-theme";
  libraryPath: string;
  capabilities: readonly string[];
};

export type ThemeComponentRegistry = Record<string, boolean>;

export type ThemeRegistry = Record<string, ThemeDefinition>;

export type ThemeComponentType = "server-component" | "client-component";

export type ThemeComponentManifestEntry = {
  file: string;
  export: string;
  type: ThemeComponentType;
};

export type ThemeModuleManifestEntry = {
  file: string;
  export: string;
};

export type ThemeStylesManifest = {
  entry?: string;
  tokens?: boolean;
  components?: boolean;
};

export type ThemePreviewManifest = {
  page: string;
  data?: string;
};

export type ThemeStyleEntry = {
  themeName: string;
  packageName: string;
  entry: string;
  importPath: string;
};

export type ThemeManifest = {
  name?: string;
  package?: string;
  type?: string;
  version?: string;
  description?: string;
  capabilities: readonly string[];
  components: Record<string, ThemeComponentManifestEntry>;
  sections: Record<string, ThemeModuleManifestEntry>;
  layouts: Record<string, ThemeModuleManifestEntry>;
  shell: Record<string, ThemeModuleManifestEntry>;
  styles: ThemeStylesManifest;
  preview?: ThemePreviewManifest;
};
