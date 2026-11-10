import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { articleSourcesBySlug } from "../src/content/article-sources.generated";
import { buildAnalyticsPageLocation } from "../src/lib/analytics";

function source(path: string) {
  return readFileSync(path, "utf8");
}

function testSubscriptionAndContactRemoval() {
  const homepage = source("src/instance/homepage/budget-travel-homepage.tsx");
  const contact = source("src/app/contact/page.tsx");
  assert(!/newsletter|subscribe|Join the journey/i.test(homepage));
  assert(!/<form|disabled/i.test(contact));
  assert.match(contact, /mailto:/);
}

function testCanonicalGuideRoutes() {
  assert.match(source("src/app/news/page.tsx"), /permanentRedirect\(destination\)/);
  assert.match(source("src/app/news/[slug]/page.tsx"), /permanentRedirect\(`\/guides\//);
  assert.match(source("src/app/guides/[slug]/page.tsx"), /publicationAwareInternalLinks/);
  const seo = source("src/lib/seo.ts");
  assert.match(seo, /"@type": "Article"/);
  assert(!seo.includes('"@type": "NewsArticle"'));
  assert.match(seo, /article\.editorialUpdatedAt/);
}

function testEditorialDates() {
  assert.match(source("src/db/migrations/0002_article_editorial_updated_at.sql"), /ADD COLUMN editorial_updated_at TEXT/);
  assert.match(source("src/components/admin/article-form.tsx"), /name="editorialUpdatedAt"/);
  const sitemap = source("src/lib/sitemap-runtime.ts");
  assert.match(sitemap, /article\.editorialUpdatedAt/);
  assert(!/article\.updatedAt, article\.publishedAt/.test(sitemap));
}

function testSourceManifest() {
  const researchRoot = path.join(process.cwd(), "content-preparation", "research");
  const expectedSlugs = readdirSync(researchRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^BTC-\d+$/.test(entry.name))
    .map((entry) => {
      const draft = readFileSync(path.join(researchRoot, entry.name, "ARTICLE_DRAFT.md"), "utf8");
      const slug = draft.match(/^slug:\s*["']?([^"'\s]+)["']?\s*$/m)?.[1];
      assert(slug, `Missing slug for ${entry.name}`);
      return slug;
    })
    .toSorted();
  const generatedSlugs = Object.keys(articleSourcesBySlug).toSorted();
  assert.deepEqual(generatedSlugs, expectedSlugs);

  for (const sources of Object.values(articleSourcesBySlug)) {
    assert.equal(new Set(sources.map((item) => item.url)).size, sources.length);
    for (const item of sources) {
      assert(item.title.trim());
      assert.match(item.url, /^https?:\/\//);
    }
  }
}

function testAnalyticsSanitization() {
  assert.equal(
    buildAnalyticsPageLocation("https://budgettravelcompass.com", "/search?q=private+query#results"),
    "https://budgettravelcompass.com/search",
  );
  const analytics = source("src/components/public/google-analytics.tsx");
  assert.match(analytics, /send_page_view: false/);
  assert(!analytics.includes("window.location.search"));
  assert(!analytics.includes("window.location.href"));
}

function testPolicyDisclosures() {
  const legal = source("src/instance/legal.config.ts");
  assert.match(legal, /prior visits to this or other websites/i);
  assert.match(legal, /Google-certified consent management platform/i);
  assert.match(legal, /AI-assisted/i);
  assert.match(legal, /not treated as evidence/i);
}

testSubscriptionAndContactRemoval();
testCanonicalGuideRoutes();
testEditorialDates();
testSourceManifest();
testAnalyticsSanitization();
testPolicyDisclosures();
console.log("AdSense remediation tests: 0 fail, 0 error");
