import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ARTICLE_PAGE_SIZE } from "../src/lib/pagination";
import type { StaticSearchArticle } from "../src/lib/static-search";
import { staticHtmlAssetPath, type StaticPublicSnapshotManifest } from "./static-public/snapshot";

const SITE_ORIGIN = "https://budgettravelcompass.com";
const PREVIEW_ORIGIN = "http://127.0.0.1:8799";
const ROOT = process.cwd();
const WORK_DIR = path.join(ROOT, ".tmp", "static-public");
const ASSET_DIR = path.join(ROOT, ".open-next", "assets");
const SNAPSHOT_SQL = path.join(WORK_DIR, "snapshot.sql");
const SNAPSHOT_MANIFEST = path.join(WORK_DIR, "manifest.json");
const PREVIEW_CONFIG = path.join(WORK_DIR, "wrangler.preview.jsonc");
const PREVIEW_STATE = path.join(WORK_DIR, `preview-state-${Date.now()}`);
const WRANGLER_BIN = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const PREVIEW_HEADERS = {
  "x-static-public-capture": "1",
};

function runWrangler(args: string[]) {
  const result = spawnSync(process.execPath, [WRANGLER_BIN, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`Wrangler failed: ${args.join(" ")}\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function requireBuildInputs() {
  for (const file of [path.join(ROOT, ".open-next", "worker.js"), SNAPSHOT_SQL, SNAPSHOT_MANIFEST, WRANGLER_BIN]) {
    if (!existsSync(file)) throw new Error(`Required static-public build input is missing: ${file}`);
  }
}

function createPreviewConfig() {
  const config = JSON.parse(readFileSync(path.join(ROOT, "wrangler.jsonc"), "utf8")) as Record<string, unknown> & {
    assets?: Record<string, unknown>;
    d1_databases?: Array<Record<string, unknown>>;
  };
  config.name = "budget-travel-compass-static-preview";
  config.main = path.join(ROOT, ".open-next", "worker.js");
  config.assets = {
    ...(config.assets ?? {}),
    directory: ASSET_DIR,
    binding: "ASSETS",
    run_worker_first: true,
    not_found_handling: "none",
  };
  config.d1_databases = (config.d1_databases ?? []).map((database) => ({ ...database, remote: false }));
  writeFileSync(PREVIEW_CONFIG, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function seedPreviewDatabase() {
  mkdirSync(PREVIEW_STATE, { recursive: true });
  runWrangler([
    "d1", "execute", "budget-travel-compass", "--local", "--config", PREVIEW_CONFIG,
    "--persist-to", PREVIEW_STATE, "--file", SNAPSHOT_SQL,
  ]);
}

function startPreview() {
  const child = spawn(
    process.execPath,
    [WRANGLER_BIN, "dev", "--config", PREVIEW_CONFIG, "--persist-to", PREVIEW_STATE, "--ip", "127.0.0.1", "--port", "8799"],
    { cwd: ROOT, env: { ...process.env, NO_COLOR: "1" }, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForPreview(child: ChildProcess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Static preview exited before becoming ready (${child.exitCode}).`);
    try {
      const response = await fetch(`${PREVIEW_ORIGIN}/sitemap.xml`, { headers: PREVIEW_HEADERS });
      if (response.ok) return;
    } catch {
      // Preview startup is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Static preview did not become ready within 30 seconds.");
}

function relativePath(url: string) {
  const parsed = new URL(url);
  if (parsed.origin !== SITE_ORIGIN) throw new Error(`Sitemap contains an unexpected origin: ${url}`);
  return parsed.pathname;
}

function paginationRoutes(searchIndex: StaticSearchArticle[]) {
  const routes = new Set<string>();
  const addPages = (basePath: string, count: number) => {
    const totalPages = Math.ceil(count / ARTICLE_PAGE_SIZE);
    for (let page = 2; page <= totalPages; page += 1) routes.add(`${basePath}/page/${page}`);
  };
  addPages("/guides", searchIndex.length);

  const categories = new Map<string, number>();
  const tags = new Map<string, number>();
  for (const article of searchIndex) {
    categories.set(article.category.slug, (categories.get(article.category.slug) ?? 0) + 1);
    for (const tag of article.tags) tags.set(tag.slug, (tags.get(tag.slug) ?? 0) + 1);
  }
  for (const [slug, count] of categories) addPages(`/category/${slug}`, count);
  for (const [slug, count] of tags) addPages(`/tag/${slug}`, count);
  return routes;
}

function expectedCanonical(pathname: string) {
  return `${SITE_ORIGIN}${pathname === "/" ? "" : pathname}`;
}

function validateHtml(pathname: string, html: string) {
  const lower = html.toLowerCase();
  for (const residue of ["template preview", "provided by the instance", "supplied by the instance", "reusable layouts", "lorem ipsum", "coming soon"]) {
    if (lower.includes(residue)) throw new Error(`Generated route ${pathname} contains forbidden residue: ${residue}.`);
  }
  if (html.includes(PREVIEW_ORIGIN) || html.includes("127.0.0.1:8799")) {
    throw new Error(`Generated route ${pathname} leaks the preview origin.`);
  }
  if (pathname !== "/search") {
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]
      ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1];
    if (canonical !== expectedCanonical(pathname)) {
      throw new Error(`Generated route ${pathname} has canonical ${String(canonical)}.`);
    }
  }
}

async function fetchText(pathname: string, expectedStatus = 200) {
  const response = await fetch(`${PREVIEW_ORIGIN}${pathname}`, { headers: PREVIEW_HEADERS, redirect: "manual" });
  const body = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(`Preview route ${pathname} returned ${response.status}; expected ${expectedStatus}.`);
  }
  return { body, contentType: response.headers.get("content-type") ?? "" };
}

async function capturePublicAssets(manifest: StaticPublicSnapshotManifest) {
  const sitemapResponse = await fetchText("/sitemap.xml");
  const sitemapRoutes = [...sitemapResponse.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => relativePath(match[1]));
  if (sitemapRoutes.length === 0) throw new Error("Generated sitemap contains no URLs.");

  const searchIndexResponse = await fetchText("/search-index.json");
  const searchIndex = JSON.parse(searchIndexResponse.body) as StaticSearchArticle[];
  if (searchIndex.length !== manifest.publishedArticleCount) {
    throw new Error(`Search index count ${searchIndex.length} does not match snapshot count ${manifest.publishedArticleCount}.`);
  }

  const htmlRoutes = new Set([...sitemapRoutes, "/search", ...paginationRoutes(searchIndex)]);
  const generatedAssets: string[] = [];
  for (const pathname of [...htmlRoutes].sort()) {
    const response = await fetchText(pathname);
    if (!response.contentType.includes("text/html")) throw new Error(`Generated route ${pathname} is not HTML.`);
    validateHtml(pathname, response.body);
    const assetPath = staticHtmlAssetPath(pathname);
    const destination = path.join(ASSET_DIR, assetPath);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, response.body, "utf8");
    generatedAssets.push(assetPath);
  }

  writeFileSync(path.join(ASSET_DIR, "search-index.json"), `${JSON.stringify(searchIndex)}\n`, "utf8");
  writeFileSync(path.join(ASSET_DIR, "sitemap.xml"), sitemapResponse.body, "utf8");
  writeFileSync(path.join(ASSET_DIR, "robots.txt"), (await fetchText("/robots.txt")).body, "utf8");
  writeFileSync(path.join(ASSET_DIR, "icon.png"), readFileSync(path.join(ROOT, "src", "app", "icon.png")));
  writeFileSync(path.join(ASSET_DIR, "apple-icon.png"), readFileSync(path.join(ROOT, "src", "app", "apple-icon.png")));

  const notFound = await fetchText("/__static-public-missing__", 404);
  if (!notFound.contentType.includes("text/html")) throw new Error("Generated 404 response is not HTML.");
  writeFileSync(path.join(ASSET_DIR, "404.html"), notFound.body, "utf8");

  const adsPath = path.join(ASSET_DIR, "ads.txt");
  if (!existsSync(adsPath) || !readFileSync(adsPath, "utf8").trim()) throw new Error("ads.txt is missing from Static Assets.");

  writeFileSync(path.join(ASSET_DIR, "_redirects"), "/news /guides 308\n/news/* /guides/:splat 308\n", "utf8");
  writeFileSync(
    path.join(ASSET_DIR, "_headers"),
    `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Budget-Travel-Static: ${manifest.contentDigest}\n`,
    "utf8",
  );

  const staticManifest = {
    generatedAt: new Date().toISOString(),
    contentDigest: manifest.contentDigest,
    publishedArticleCount: manifest.publishedArticleCount,
    sitemapRouteCount: sitemapRoutes.length,
    htmlRouteCount: htmlRoutes.size,
    generatedAssetCount: generatedAssets.length + 8,
    htmlRoutes: [...htmlRoutes].sort(),
    generatedAssets: generatedAssets.sort(),
  };
  writeFileSync(path.join(WORK_DIR, "static-assets-manifest.json"), `${JSON.stringify(staticManifest, null, 2)}\n`, "utf8");
  return staticManifest;
}

async function main() {
  requireBuildInputs();
  mkdirSync(WORK_DIR, { recursive: true });
  mkdirSync(ASSET_DIR, { recursive: true });
  createPreviewConfig();
  seedPreviewDatabase();

  const snapshotManifest = JSON.parse(readFileSync(SNAPSHOT_MANIFEST, "utf8")) as StaticPublicSnapshotManifest;
  const preview = startPreview();
  try {
    await waitForPreview(preview);
    const result = await capturePublicAssets(snapshotManifest);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    preview.kill();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
