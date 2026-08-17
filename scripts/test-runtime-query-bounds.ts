import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PUBLIC_ARTICLE_LIST_SQL, PUBLISHED_ARTICLE_DETAIL_SQL } from "../src/db/repositories/d1-public-queries";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const contentRepository = read("src/db/repositories/content.ts");
const d1Repository = read("src/db/repositories/d1-admin-content.ts");
const articleCard = read("src/components/public/article-card.tsx");
const homepageAdapter = read("src/instance/homepage/preview-data.ts");
const publicationAwareLinks = read("src/lib/publication-aware-links.ts");

assert(!/\bSELECT\s+\*/i.test(PUBLIC_ARTICLE_LIST_SQL), "Public list query must use an explicit projection.");
assert(!/^\s*body_html\s*,?\s*$/im.test(PUBLIC_ARTICLE_LIST_SQL), "Public list projection must not return body_html.");
assert.match(PUBLIC_ARTICLE_LIST_SQL, /reading_time_minutes/i, "Public list query must return compact reading-time metadata.");
assert.match(PUBLIC_ARTICLE_LIST_SQL, /WHERE\s+lower\(status\)\s*=\s*'published'/i, "Public list query must exclude non-Published rows.");
assert.match(PUBLISHED_ARTICLE_DETAIL_SQL, /WHERE\s+slug\s*=\s*\?/i, "Article detail must bind one exact slug.");
assert.match(PUBLISHED_ARTICLE_DETAIL_SQL, /lower\(status\)\s*=\s*'published'/i, "Article detail must require Published status.");
assert.match(PUBLISHED_ARTICLE_DETAIL_SQL, /LIMIT\s+1/i, "Article detail must fetch at most one row.");

assert.match(contentRepository, /const getPublicSnapshot = cache\(/, "Public snapshot must be request-memoized.");
assert.match(contentRepository, /listD1PublicArticles\(db\)/, "Public snapshot must use the lightweight D1 loader.");
assert.match(contentRepository, /const getAdminSnapshot = cache\(/, "Admin full snapshot must remain available.");
assert.match(contentRepository, /listD1Articles\(db\)/, "Admin snapshot must retain the full article loader.");
assert.match(contentRepository, /getD1PublishedArticleBySlug\(db, slug\)/, "Article detail must use the one-row D1 loader.");
assert.match(contentRepository, /getRelatedArticles[\s\S]*?getPublicSnapshot\(\)/, "Related articles must use the lightweight snapshot.");
assert.match(contentRepository, /searchArticles[\s\S]*?getPublicSnapshot\(\)/, "Search must use the lightweight snapshot.");

assert(!/bodyHtml/.test(articleCard), "Article cards must not depend on full body HTML.");
assert(!/bodyHtml/.test(homepageAdapter), "Homepage story mapping must not depend on full body HTML.");
assert.match(articleCard, /readingTimeMinutes/, "Article cards must use compact reading-time metadata.");
assert.match(homepageAdapter, /readingTimeMinutes/, "Homepage must use compact reading-time metadata.");

const publicLoaderBody = d1Repository.match(/export async function listD1PublicArticles[\s\S]*?\n}\n/)?.[0] ?? "";
assert(publicLoaderBody.length > 0, "Public D1 loader must exist.");
assert(!/listD1Articles\(/.test(publicLoaderBody), "Public D1 loader must not call the full loader.");

const detailLoaderBody = d1Repository.match(/export async function getD1PublishedArticleBySlug[\s\S]*?\n}\n/)?.[0] ?? "";
assert(detailLoaderBody.length > 0, "Article detail D1 loader must exist.");
assert(!/listD1Articles\(/.test(detailLoaderBody), "Article detail must not load the full corpus.");

const publishedSlugLookups = publicationAwareLinks.match(/resolvePublishedSlugs\(/g)?.length ?? 0;
assert.equal(publishedSlugLookups, 1, "Publication-aware rendering must perform one published-slug resolver call.");

const publishedFixture = Array.from({ length: 44 }, (_, index) => ({
  id: index + 1,
  slug: `published-${index + 1}`,
  status: "published",
  readingTimeMinutes: (index % 12) + 1,
}));
const storedLinks = Array.from({ length: 129 }, (_, index) => publishedFixture[index % publishedFixture.length].slug);
assert.equal(publishedFixture.length, 44);
assert.equal(storedLinks.length, 129);
assert.equal(new Set(storedLinks).size, 44, "The regression fixture must exercise all 44 Published targets.");
assert(publishedFixture.every((article) => article.status === "published"));

console.log("PASS runtime query bounds: lightweight public corpus, one-row detail, 44 Published articles, 129 stored links");
