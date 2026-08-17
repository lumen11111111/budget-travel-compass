import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  extractInternalArticleSlugs,
  filterUnpublishedInternalArticleLinks,
  renderPublicationAwareArticleHtml,
} from "../src/lib/publication-aware-links";

async function main() {
  testPublishedTarget();
  testDraftTarget();
  testMissingTarget();
  testExternalAndSourceLinks();
  testMixedTargets();
  await testDuplicateTargetsUseOneBatchLookup();
  testNestedMarkup();
  await testQueryFailureFailsClosed();
  testApprovedGraphSimulations();
  testRuntimeIntegrationContract();
  console.log("Publication-aware internal-link tests: 0 fail, 0 error");
}

function testPublishedTarget() {
  const html = '<p>Read <a href="/news/published-guide">the guide</a>.</p>';
  assert.match(filterUnpublishedInternalArticleLinks(html, new Set(["published-guide"])), /href="\/news\/published-guide"/);
}

function testDraftTarget() {
  const output = filterUnpublishedInternalArticleLinks('<p>Read <a href="/news/draft-guide">the guide</a>.</p>', new Set());
  assert.equal(output, "<p>Read the guide.</p>");
}

function testMissingTarget() {
  const output = filterUnpublishedInternalArticleLinks('<a href="/news/missing-guide">Missing guide</a>', new Set(["another-guide"]));
  assert.equal(output, "Missing guide");
}

function testExternalAndSourceLinks() {
  const html = [
    '<p><a href="https://example.com/source">Source note</a></p>',
    '<p><a href="mailto:editor@example.com">Email</a></p>',
    '<p><a href="/category/trip-planning">Category</a></p>',
  ].join("");
  const output = filterUnpublishedInternalArticleLinks(html, new Set());
  assert.match(output, /href="https:\/\/example\.com\/source"/);
  assert.match(output, /href="mailto:editor@example\.com"/);
  assert.match(output, /href="\/category\/trip-planning"/);
}

function testMixedTargets() {
  const html = '<a href="/news/live-guide">Live</a> and <a href="/news/draft-guide">Draft</a>';
  const output = filterUnpublishedInternalArticleLinks(html, new Set(["live-guide"]));
  assert.match(output, /href="\/news\/live-guide"/);
  assert(!output.includes('href="/news/draft-guide"'));
  assert.match(output, /and Draft$/);
}

async function testDuplicateTargetsUseOneBatchLookup() {
  const html = '<a href="/news/repeated-guide">One</a><a href="/news/repeated-guide">Two</a>';
  let calls = 0;
  let received: readonly string[] = [];
  const output = await renderPublicationAwareArticleHtml(html, async (slugs) => {
    calls += 1;
    received = slugs;
    return new Set(["repeated-guide"]);
  });
  assert.equal(calls, 1);
  assert.deepEqual(received, ["repeated-guide"]);
  assert.equal((output.match(/href="\/news\/repeated-guide"/g) ?? []).length, 2);
}

function testNestedMarkup() {
  const html = '<p>Use <a href="/news/draft-guide"><strong>this <em>careful</em> guide</strong></a>, today.</p>';
  const output = filterUnpublishedInternalArticleLinks(html, new Set());
  assert.equal(output, "<p>Use <strong>this <em>careful</em> guide</strong>, today.</p>");
}

async function testQueryFailureFailsClosed() {
  const html = '<a href="/news/one">One</a> <a href="/news/two">Two</a>';
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const output = await renderPublicationAwareArticleHtml(html, async () => {
      throw new Error("simulated query failure");
    });
    assert(!output.includes("href="));
    assert.equal(output, "One Two");
  } finally {
    console.error = originalError;
  }
}

function testApprovedGraphSimulations() {
  const manifest = readFileSync("docs/release/BUDGET_TRAVEL_COMPASS_INTERNAL_LINK_RESOLUTION_MANIFEST.md", "utf8");
  const edges = [...manifest.matchAll(/^\| BTC-\d+ \| BTC-\d+ \| `([a-z0-9-]+)` \|.*\| RESOLVED \|$/gm)].map((match) => match[1]);
  assert.equal(edges.length, 129);

  const html = edges.map((slug, index) => `<a href="/news/${slug}">Link ${index + 1}</a>`).join("\n");
  const waveOne = new Set([
    "slow-travel-short-break",
    "plan-group-trip",
    "nearby-airport-total-cost-test",
    "pre-trip-spending-swap-list",
    "travel-daypack-setup",
    "solo-dining-while-traveling",
  ]);
  const provisional = filterUnpublishedInternalArticleLinks(html, waveOne);
  const provisionalHrefs = extractInternalArticleSlugs(provisional);
  assert(provisionalHrefs.every((slug) => waveOne.has(slug)));
  assert.equal((provisional.match(/href="\/news\//g) ?? []).length, edges.filter((slug) => waveOne.has(slug)).length);

  const allPublished = new Set(edges);
  const allPublishedOutput = filterUnpublishedInternalArticleLinks(html, allPublished);
  assert.equal((allPublishedOutput.match(/href="\/news\//g) ?? []).length, 129);
  assert.deepEqual([...allPublishedOutput.matchAll(/href="\/news\/([a-z0-9-]+)"/g)].map((match) => match[1]), edges);
}

function testRuntimeIntegrationContract() {
  const articleDetail = readFileSync("src/components/public/article-detail.tsx", "utf8");
  const publicPage = readFileSync("src/app/news/[slug]/page.tsx", "utf8");
  const previewPage = readFileSync("src/app/admin/articles/[id]/preview/page.tsx", "utf8");
  const repository = readFileSync("src/db/repositories/content.ts", "utf8");
  const actions = readFileSync("src/app/admin/articles/actions.ts", "utf8");

  assert.match(publicPage, /publicationAwareInternalLinks/);
  assert(!previewPage.includes("publicationAwareInternalLinks"));
  assert.match(articleDetail, /renderPublicationAwareArticleHtml/);
  assert.match(repository, /SELECT slug FROM articles WHERE slug IN \(\$\{placeholders\}\) AND lower\(status\) = 'published'/);
  assert.match(actions, /revalidatePath\("\/news\/\[slug\]", "page"\)/);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
