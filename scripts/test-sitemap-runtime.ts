import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CACHE_EXCLUDED_PATHS, isPublicEdgeCacheEligible } from "../src/lib/edge-cache-policy";
import { buildSitemapXml, categoryPathForSlug, createSitemapResponse, escapeXml, renderUrlEntry } from "../src/lib/sitemap-runtime";
import type { SitemapContent } from "../src/db/repositories/content";

async function main() {
  testXmlEscaping();
  testSitemapXml();
  await testGetAndHeadResponse();
  testCacheExclusion();
  testRepositoryQueryShape();
  console.log("Sitemap runtime tests: 0 fail, 0 error");
}

function sampleContent(): SitemapContent {
  return {
    runtime: "production",
    reason: "test",
    articles: [
      { slug: "published-one", publishedAt: "2026-08-01 10:00:00", updatedAt: "2026-08-02 11:00:00" },
      { slug: "published-two", publishedAt: "2026-08-01", updatedAt: null },
    ],
    categories: [
      { slug: "guides", updatedAt: "2026-08-01" },
      { slug: "resources", updatedAt: null },
    ],
    tags: [{ slug: "alpha", updatedAt: "2026-08-03T00:00:00.000Z" }],
  };
}

function testXmlEscaping() {
  assert.equal(escapeXml(`https://example.test/a?x=1&y=<tag>"'`), "https://example.test/a?x=1&amp;y=&lt;tag&gt;&quot;&apos;");
  assert.match(renderUrlEntry({ loc: "https://example.test/a&b", lastmod: "2026-08-01", changefreq: "daily", priority: 1 }), /&amp;/);
}

function testSitemapXml() {
  const xml = buildSitemapXml(sampleContent(), new URL("https://example.test"));
  const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => match[1]);
  assert(urls.includes("https://example.test/"));
  assert(urls.includes("https://example.test/news/published-one"));
  assert(urls.includes("https://example.test/category/guides"));
  assert(urls.includes("https://example.test/tag/alpha"));
  assert(urls.includes("https://example.test/disclaimer"));
  assert.equal(urls.length, new Set(urls).size);
  assert(!urls.some((url) => url.includes("/admin") || url.includes("/search")));
  assert(!xml.includes("Invalid Date"));
  assert.match(xml, /<lastmod>2026-08-02T11:00:00.000Z<\/lastmod>/);
  assert.equal(categoryPathForSlug("guides"), "/category/guides");
}

async function testGetAndHeadResponse() {
  const xml = buildSitemapXml(sampleContent(), new URL("https://example.test"));
  const get = createSitemapResponse(xml, true);
  const head = createSitemapResponse(xml, false);
  const body = new Uint8Array(await get.arrayBuffer());
  const headBody = new Uint8Array(await head.arrayBuffer());

  assert.equal(get.status, 200);
  assert.equal(head.status, 200);
  assert.equal(get.headers.get("content-type"), "application/xml; charset=utf-8");
  assert.equal(head.headers.get("content-type"), "application/xml; charset=utf-8");
  assert.equal(get.headers.get("content-length"), String(body.byteLength));
  assert.equal(head.headers.get("content-length"), get.headers.get("content-length"));
  assert.equal(get.headers.get("content-encoding"), "identity");
  assert.equal(get.headers.get("transfer-encoding"), null);
  assert.equal(headBody.byteLength, 0);
}

function testCacheExclusion() {
  assert(CACHE_EXCLUDED_PATHS.has("/sitemap.xml"));
  assert(CACHE_EXCLUDED_PATHS.has("/robots.txt"));
  assert.equal(isPublicEdgeCacheEligible("/sitemap.xml"), false);
  assert.equal(isPublicEdgeCacheEligible("/robots.txt"), false);
  assert.equal(isPublicEdgeCacheEligible("/news/example"), true);
}

function testRepositoryQueryShape() {
  const source = readFileSync("src/db/repositories/content.ts", "utf8");
  assert.match(source, /listSitemapContent/);
  assert.match(source, /SELECT slug, published_at, updated_at FROM articles WHERE lower\(status\) = 'published'/);
  const sitemapFunction = source.slice(source.indexOf("export async function listSitemapContent"), source.indexOf("export async function listAdminTags"));
  assert(!/body_html|summary|cover_url|seo_title|seo_description/i.test(sitemapFunction));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
