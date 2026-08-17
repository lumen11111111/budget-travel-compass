import { existsSync } from "node:fs";
import path from "node:path";

import { resolveSiteTheme } from "./resolver";

export type ResolvedThemeSource = {
  themeName: string;
  version: string;
  libraryPath: string;
  absolutePath: string;
};

export function resolveThemeSource(): ResolvedThemeSource {
  const theme = resolveSiteTheme();
  const absolutePath = path.join(process.cwd(), theme.libraryPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Theme source for "${theme.name}" was not found at ${absolutePath}.`);
  }

  return {
    themeName: theme.name,
    version: theme.version,
    libraryPath: theme.libraryPath,
    absolutePath,
  };
}
