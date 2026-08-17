import { loadThemeDefinition } from "./loader";
import type { ThemeDefinition } from "./types";

export function resolveSiteTheme(): ThemeDefinition {
  return loadThemeDefinition();
}
