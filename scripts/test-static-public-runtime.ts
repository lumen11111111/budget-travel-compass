import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { STATIC_PUBLIC_QUERIES, staticHtmlAssetPath } from "./static-public/snapshot";

const root = process.cwd();
const assets = path.join(root, ".open-next", "assets");
const work = path.join(root, ".tmp", "static-public");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(entryPath) : [entryPath];
  });
}

const wrangler = JSON.parse(read("wrangler.jsonc")) as {
  assets?: { html_handling?: string; not_found_handling?: string; run_worker_first?: unknown };
};
assert.equal(wrangler.assets?.html_handling, "drop-trailing-slash");
assert.equal(wrangler.assets?.not_found_handling, "404-page");
assert.deepEqual(wrangler.assets?.run_worker_first, ["/admin", "/admin/*", "/media/*"]);

assert.match(read("next.config.ts"), /unoptimized:\s*true/);
assert.doesNotMatch(read("src/components/public/pagination.tsx"), /\?page=/);
assert.match(read("src/lib/seo.ts"), /\/page\/\$\{page\}/);
assert.match(read("src/components/public/static-search-results.tsx"), /fetch\("\/search-index\.json"/);

const publicSources = [
  ...sourceFiles(path.join(root, "src", "components", "public")),
  ...sourceFiles(path.join(root, "src", "instance", "homepage")),
  path.join(root, "src", "app", "about", "page.tsx"),
  path.join(root, "src", "app", "not-found.tsx"),
];
for (const file of publicSources.filter((file) => /\.(ts|tsx)$/.test(file))) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /from ["']next\/link["']/, `${file} still imports next/link`);
}

for (const [label, query] of Object.entries(STATIC_PUBLIC_QUERIES)) {
  assert.match(query.trim(), /^select\b/i, `${label} is not a SELECT query`);
  assert.doesNotMatch(query, /\b(insert|update|delete|replace|alter|drop|create)\b/i, `${label} can mutate D1`);
}

const snapshotManifest = JSON.parse(readFileSync(path.join(work, "manifest.json"), "utf8")) as {
  contentDigest: string;
  publishedArticleCount: number;
};
const assetManifest = JSON.parse(readFileSync(path.join(work, "static-assets-manifest.json"), "utf8")) as {
  contentDigest: string;
  publishedArticleCount: number;
  htmlRoutes: string[];
  generatedAssets: string[];
};
assert.equal(assetManifest.contentDigest, snapshotManifest.contentDigest);
assert.equal(assetManifest.publishedArticleCount, snapshotManifest.publishedArticleCount);
assert.equal(assetManifest.generatedAssets.length, assetManifest.htmlRoutes.length);
for (const route of assetManifest.htmlRoutes) {
  const assetPath = path.join(assets, staticHtmlAssetPath(route));
  assert.ok(existsSync(assetPath), `Static HTML is missing for ${route}`);
  const html = readFileSync(assetPath, "utf8");
  assert.doesNotMatch(html, /127\.0\.0\.1:8799|template preview|lorem ipsum/i, `${route} contains build residue`);
}

for (const required of ["404.html", "ads.txt", "robots.txt", "search-index.json", "sitemap.xml", "_headers", "_redirects"]) {
  assert.ok(existsSync(path.join(assets, required)), `${required} is missing from Static Assets`);
}
assert.match(readFileSync(path.join(assets, "_headers"), "utf8"), new RegExp(snapshotManifest.contentDigest));
assert.match(readFileSync(path.join(assets, "_redirects"), "utf8"), /^\/news \/guides 308/m);

console.log(`Static public runtime tests passed: ${assetManifest.htmlRoutes.length} HTML routes, digest ${snapshotManifest.contentDigest}.`);
