import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

type ImportRecord = {
  contentId: string;
  importRecord: {
    title: string;
    slug: string;
    summary: string;
    status: string;
    seoTitle: string | null;
    seoDescription: string | null;
    bodyHtml: string;
  };
};

type ArticleRow = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  status: string;
  seo_title: string | null;
  seo_description: string | null;
  body_html: string;
};

const databaseName = "example-site-db";
const allowed = new Map([
  ["BTC-013", "find-cheaper-flights-flexible-dates"],
  ["BTC-042", "plan-first-solo-female-trip"],
]);
const forbidden = /CLAIM_SOURCE_LEDGER|RESEARCH_NOTES|EDITORIAL_QA|Freshness Register|Research Tier|Content ID/i;

function main() {
  const records = readTargetRecords();
  const before = readRows();
  validateRows(before, records, true);

  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "btc-phase7b-"));
  const sqlPath = path.join(temporaryDirectory, "body-only-patch.sql");
  try {
    writeFileSync(sqlPath, buildSql(before, records), "utf8");
    runWrangler(["d1", "execute", databaseName, "--local", `--file=${sqlPath}`]);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }

  const after = readRows();
  validateRows(after, records, false);
  for (const row of after) {
    console.log(`PASS ${row.slug} ${sha256(row.body_html)}`);
  }
  console.log("PASS patched exactly 2 local Draft body_html rows");
}

function readTargetRecords() {
  const artifactPath = path.join(process.cwd(), "content", "import", "budget-travel-compass", "normalized-import-records.json");
  const all = JSON.parse(readFileSync(artifactPath, "utf8")) as ImportRecord[];
  const records = all.filter((record) => allowed.has(record.contentId));
  if (records.length !== allowed.size) throw new Error(`Expected ${allowed.size} targeted records, received ${records.length}.`);
  for (const record of records) {
    if (allowed.get(record.contentId) !== record.importRecord.slug) throw new Error(`Slug authority mismatch for ${record.contentId}.`);
    if (record.importRecord.status !== "draft") throw new Error(`${record.contentId} is not Draft.`);
    if (forbidden.test(record.importRecord.bodyHtml)) throw new Error(`${record.contentId} corrected body still exposes editorial-only data.`);
  }
  return records;
}

function readRows() {
  const slugs = [...allowed.values()].map(sqlString).join(",");
  const output = runWrangler([
    "d1",
    "execute",
    databaseName,
    "--local",
    "--command",
    `SELECT id,slug,title,summary,status,seo_title,seo_description,body_html FROM articles WHERE slug IN (${slugs}) ORDER BY slug;`,
    "--json",
  ]);
  const parsed = JSON.parse(output) as Array<{ results: ArticleRow[]; success: boolean }>;
  const rows = parsed[0]?.results ?? [];
  if (rows.length !== allowed.size) throw new Error(`Expected ${allowed.size} local D1 rows, received ${rows.length}.`);
  return rows;
}

function validateRows(rows: ArticleRow[], records: ImportRecord[], expectOldBody: boolean) {
  const bySlug = new Map(records.map((record) => [record.importRecord.slug, record.importRecord]));
  for (const row of rows) {
    const expected = bySlug.get(row.slug);
    if (!expected) throw new Error(`Unexpected local D1 slug: ${row.slug}`);
    if (row.status !== "draft") throw new Error(`${row.slug} is not Draft.`);
    if (
      row.title !== expected.title ||
      row.summary !== expected.summary ||
      row.seo_title !== expected.seoTitle ||
      row.seo_description !== expected.seoDescription
    ) {
      throw new Error(`${row.slug} metadata does not match the authority artifact.`);
    }
    if (expectOldBody) {
      const removed = singleRemovedSegment(row.body_html, expected.bodyHtml);
      if (!/^ See `CLAIM_SOURCE_LEDGER\.md` for .+\.$/.test(removed)) {
        throw new Error(`${row.slug} body diff is broader than the approved Source Notes cleanup.`);
      }
    } else if (row.body_html !== expected.bodyHtml) {
      throw new Error(`${row.slug} stored body does not exactly match the corrected artifact.`);
    }
  }
}

function singleRemovedSegment(before: string, after: string) {
  let prefix = 0;
  while (prefix < Math.min(before.length, after.length) && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < Math.min(before.length, after.length) - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const inserted = after.slice(prefix, after.length - suffix);
  if (inserted !== "") throw new Error("Corrected body contains an insertion outside the approved removal-only change.");
  return before.slice(prefix, before.length - suffix);
}

function buildSql(rows: ArticleRow[], records: ImportRecord[]) {
  const bySlug = new Map(records.map((record) => [record.importRecord.slug, record.importRecord]));
  const cases: string[] = [];
  const conditions: string[] = [];
  for (const row of rows) {
    const expected = bySlug.get(row.slug);
    if (!expected) throw new Error(`Missing corrected artifact for ${row.slug}.`);
    cases.push(`WHEN ${sqlString(row.slug)} THEN ${sqlString(expected.bodyHtml)}`);
    conditions.push(
      `(id = ${row.id} AND slug = ${sqlString(row.slug)} AND status = 'draft' AND body_html = ${sqlString(row.body_html)})`,
    );
  }
  const guardedRows = conditions.join(" OR ");
  return [
    "UPDATE articles",
    `SET body_html = CASE slug ${cases.join(" ")} ELSE body_html END`,
    `WHERE (${guardedRows})`,
    `AND (SELECT COUNT(*) FROM articles WHERE ${guardedRows}) = ${allowed.size};`,
    "",
  ].join("\n");
}

function runWrangler(args: string[]) {
  const wranglerEntry = path.join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");
  const result = spawnSync(process.execPath, [wranglerEntry, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Wrangler failed (${result.status}):\n${result.stdout}\n${result.stderr}\n${result.error?.message ?? ""}`);
  }
  return result.stdout.trim();
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

main();
