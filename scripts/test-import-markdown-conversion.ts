import assert from "node:assert/strict";

import {
  assertNoRawMarkdownResidue,
  createDeterministicImportRecord,
  inlineMarkdown,
  markdownToHtml,
  validateMarkdownHref,
} from "../tools/starter/import-articles";

function main() {
  assert.equal(
    inlineMarkdown("plain **strong** and *emphasis* text"),
    "plain <strong>strong</strong> and <em>emphasis</em> text",
  );
  assert.equal(inlineMarkdown("***both*** then normal"), "<strong><em>both</em></strong> then normal");
  assert.equal(
    inlineMarkdown("Read [**official guidance**](https://example.com/guide) *before booking*."),
    'Read <a href="https://example.com/guide"><strong>official guidance</strong></a> <em>before booking</em>.',
  );
  assert.equal(inlineMarkdown("Use [contact](mailto:editor@example.com)."), 'Use <a href="mailto:editor@example.com">contact</a>.');
  assert.equal(validateMarkdownHref("/news/example"), "/news/example");
  assert.equal(validateMarkdownHref("#source-notes"), "#source-notes");
  assert.throws(() => validateMarkdownHref("javascript:alert(1)"), /Unsafe/);
  assert.throws(() => validateMarkdownHref("data:text/html,bad"), /Unsafe/);
  assert.throws(() => validateMarkdownHref("//untrusted.example/path"), /Unsafe/);
  assert.throws(() => validateMarkdownHref("https://"), /malformed/);
  assert.throws(() => inlineMarkdown("[broken](https://"), /Malformed/);

  const markdown = [
    "## Decision",
    "",
    "A <tag> & value with **strong** and *emphasis*.",
    "",
    "### Checklist",
    "",
    "- First **item**",
    "- Second item",
    "",
    "1. One",
    "2. Two",
    "",
    "| Choice | Treatment |",
    "|---|---|",
    "| A | **Keep** |",
    "| B | *Review* |",
    "",
    "## Source notes",
    "",
    "Approved source context remains unchanged.",
  ].join("\n");
  const html = markdownToHtml(markdown, "regression-article");
  assert.match(html, /<h2>Decision<\/h2>/);
  assert.match(html, /<h3>Checklist<\/h3>/);
  assert.match(html, /<ul><li>First <strong>item<\/strong><\/li><li>Second item<\/li><\/ul>/);
  assert.match(html, /<ol><li>One<\/li><li>Two<\/li><\/ol>/);
  assert.match(html, /<thead><tr><th>Choice<\/th><th>Treatment<\/th><\/tr><\/thead>/);
  assert.match(html, /<td><strong>Keep<\/strong><\/td>/);
  assert.match(html, /<td><em>Review<\/em><\/td>/);
  assert.match(html, /<h2>Source notes<\/h2>/);
  assert.match(html, /A &lt;tag&gt; &amp; value/);
  assert.doesNotMatch(html, /\*\*|\|---\|/);
  assert.match(
    markdownToHtml("## Source notes\nChecked against primary sources.", "heading-with-body"),
    /<h2>Source notes<\/h2>\s*<p>Checked against primary sources\.<\/p>/,
  );
  assert.throws(
    () => markdownToHtml("| A | B |\n|---|---|\n| only one |", "bad-table"),
    /column mismatch/,
  );
  assert.throws(() => assertNoRawMarkdownResidue("<p>**raw**</p>"), /strong residue/);

  const input = {
    title: "Regression Article",
    slug: "regression-article",
    summary: "Stable summary.",
    categorySlug: "trip-planning",
    status: "draft" as const,
    seoTitle: "Regression Article SEO",
    seoDescription: "Stable description.",
    tagSlugs: [],
    coverObjectKey: null,
    bodyMarkdown: markdown,
  };
  const first = createDeterministicImportRecord(input);
  const second = createDeterministicImportRecord({ ...input });
  assert.deepEqual(first, second);
  assert.equal(first.status, "draft");
  assert.deepEqual(first.tagSlugs, []);
  assert.equal(first.coverObjectKey, null);

  console.log("PASS importer Markdown conversion regression validation");
}

main();
