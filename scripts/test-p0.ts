import assert from "node:assert/strict";

import { preserveImportedArticleHtml, sanitizeArticleHtml } from "../src/lib/article-html";
import { normalizeContentDate, toSitemapDate } from "../src/lib/content-dates";
import { decideContentRuntime } from "../src/lib/content-runtime";
import { isPublishedStatus } from "../src/lib/published";
import { executeImportPlan, type ImportExecutors, type ImportPlanV2 } from "../tools/starter/importer-execution";
import { resolveCanonicalSiteUrl } from "../src/lib/site-url";

async function main() {
  await testImporterRollback();
  testHtmlPreservation();
  testDates();
  testUrlGuard();
  testPublishedPredicate();
  testRuntimeIsolation();
  console.log("P0 tests: 0 fail, 0 error");
}

async function testImporterRollback() {
  const events: string[] = [];
  const plan: ImportPlanV2 = {
    jobId: "test-job",
    generatedAt: "2026-07-30T00:00:00.000Z",
    dryRun: false,
    executionMode: "remote",
    sourceDir: "content/import/articles",
    databaseName: "mock-db",
    bucketName: "mock-bucket",
    r2PublicBaseUrl: "https://cdn.example.test",
    articles: [
      {
        slug: "first",
        r2ObjectKeys: ["articles/first/cover/a.jpg"],
        mediaInsertSql: [],
        articleInsertSql: "insert article",
        tagInsertSql: ["insert tag"],
        rollbackSql: ["delete tag", "delete article"],
      },
    ],
  };
  const executors: ImportExecutors = {
    putObject: async (key) => {
      events.push(`put:${key}`);
    },
    deleteObject: async (key) => {
      events.push(`delete:${key}`);
    },
    executeSql: async (sql) => {
      events.push(`sql:${sql}`);
      if (sql === "insert tag") throw new Error("tag failure");
      return {};
    },
  };
  const result = await executeImportPlan(plan, new Map([["articles/first/cover/a.jpg", "a.jpg"]]), executors);
  assert.equal(result.status, "rolled-back");
  assert.equal(result.rollbackStatus, "success");
  assert.deepEqual(events, ["put:articles/first/cover/a.jpg", "sql:insert article", "sql:insert tag", "sql:delete article", "sql:delete tag", "delete:articles/first/cover/a.jpg"]);
}

function testHtmlPreservation() {
  const original = '<p>Intro</p><figure><img src="/a.jpg" alt="A"><figcaption>Cap</figcaption></figure><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table><script>alert(1)</script>';
  const saved = preserveImportedArticleHtml("<p>Edited</p>", original);
  assert.match(saved, /<figure>/);
  assert.match(saved, /<figcaption>/);
  assert.match(saved, /<table>/);
  assert.doesNotMatch(saved, /script|iframe|onclick/i);
  assert.equal(sanitizeArticleHtml('<p onclick="x">Ok</p><iframe src="/x"></iframe>'), "<p>Ok</p>");
}

function testDates() {
  assert.equal(normalizeContentDate("2026-07-30")?.toISOString(), "2026-07-30T00:00:00.000Z");
  assert.equal(normalizeContentDate("2026-07-30 12:13:14")?.toISOString(), "2026-07-30T12:13:14.000Z");
  assert.equal(normalizeContentDate("invalid"), null);
  assert.equal(toSitemapDate("invalid", "2026-07-29")?.toISOString(), "2026-07-29T00:00:00.000Z");
}

function testUrlGuard() {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://workers-test.workers.dev";
  assert.equal(resolveCanonicalSiteUrl().url.toString(), "https://workers-test.workers.dev/");
  process.env.NEXT_PUBLIC_SITE_URL = previous;
}

function testPublishedPredicate() {
  assert.equal(isPublishedStatus("published"), true);
  assert.equal(isPublishedStatus("draft"), false);
  assert.equal(isPublishedStatus("archived"), false);
  assert.equal(isPublishedStatus("deleted"), false);
}

function testRuntimeIsolation() {
  const previous = process.env.CONTENTFORGE_ALLOW_PRODUCTION_FALLBACK;
  process.env.CONTENTFORGE_ALLOW_PRODUCTION_FALLBACK = "0";
  assert.equal(decideContentRuntime(false).mode, "production");
  process.env.CONTENTFORGE_ALLOW_PRODUCTION_FALLBACK = "1";
  assert.equal(decideContentRuntime(false).mode, "fallback");
  process.env.CONTENTFORGE_ALLOW_PRODUCTION_FALLBACK = previous;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
