import { readFile } from "node:fs/promises";
import path from "node:path";
import { themeRegistry } from "@/theme/registry";

type RouteContext = {
  params: Promise<{
    theme: string;
    assetPath: string[];
  }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  const { theme: themeKey, assetPath } = await context.params;
  const theme = themeRegistry[themeKey];

  if (!theme || !isSafeAssetPath(assetPath)) {
    return new Response("Not found", { status: 404 });
  }

  const assetsRoot = path.resolve(process.cwd(), theme.libraryPath, "assets");
  const assetFilePath = path.resolve(assetsRoot, ...assetPath);

  if (!isInsideDirectory(assetFilePath, assetsRoot)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const file = await readFile(assetFilePath);

    return new Response(file, {
      headers: {
        "content-type": contentTypeForPath(assetFilePath),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

function isSafeAssetPath(assetPath: readonly string[]) {
  return assetPath.length > 0 && assetPath.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isInsideDirectory(filePath: string, directoryPath: string) {
  const relativePath = path.relative(directoryPath, filePath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function contentTypeForPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    case ".otf":
      return "font/otf";
    case ".css":
      return "text/css; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
