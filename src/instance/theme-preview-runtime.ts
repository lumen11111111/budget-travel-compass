export type ThemePreviewModuleLoader = () => Promise<Record<string, unknown>>;

export const siteThemePreviewModuleLoaders: Record<string, ThemePreviewModuleLoader> = {
  "botanical-editorial:preview/page.tsx": () => import("../../frontend-library/botanical-editorial/preview/page"),
};
