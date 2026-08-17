import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { articles as seedArticles, categories as seedCategories } from "../src/db/seed-data";
import {
  createDeterministicImportRecord,
  validateMarkdownHref,
  type DeterministicImportRecord,
} from "../tools/starter/import-articles";

type ManifestRecord = {
  contentId: string;
  title: string;
  slug: string;
  category: string;
  cluster: string;
  role: string;
};

type PreparedRecord = {
  contentId: string;
  bodySource: string;
  eligibility: "ELIGIBLE";
  conversionResult: "PASS";
  sourceFeatureCounts: {
    strong: number;
    emphasis: number;
    tables: number;
    unorderedListBlocks: number;
    orderedListBlocks: number;
    markdownLinks: number;
  };
  importRecord: DeterministicImportRecord;
};

const projectRoot = process.cwd();
const manifestPath = path.join(projectRoot, "docs", "content", "BUDGET_TRAVEL_COMPASS_PRODUCTION_CONTENT_MANIFEST.md");
const eligibilityPath = path.join(projectRoot, "docs", "content", "BUDGET_TRAVEL_COMPASS_IMPORT_ELIGIBILITY_MATRIX.md");
const researchRoot = path.join(projectRoot, "content-preparation", "research");
const artifactRoot = path.join(projectRoot, "content", "import", "budget-travel-compass");
const importManifestPath = path.join(projectRoot, "docs", "content", "BUDGET_TRAVEL_COMPASS_DRAFT_IMPORT_MANIFEST.md");
const localStorePath = path.join(projectRoot, "data", "admin-content.json");

const categoryMap = new Map([
  ["Inspiration", "inspiration"],
  ["Trip Planning", "trip-planning"],
  ["Flights & Stays", "flights-stays"],
  ["Budget Tips", "budget-tips"],
  ["Packing & Gear", "packing-gear"],
  ["Travel Styles", "travel-styles"],
]);

function main() {
  const manifest = readManifest();
  const eligibility = readEligibility();
  const allowlist = readAllowlist(manifest);
  validateCategoryBaseline();
  const records = manifest.map((entry) => prepareRecord(entry, eligibility));
  validateCorpus(records);
  validateExistingCollisions(records);
  if (allowlist) {
    writeTargetedArtifact(records, allowlist);
  } else {
    writeArtifact(records);
    writeImportManifest(records);
  }
  const artifactHash = hashArtifactFiles();

  console.log(
    allowlist
      ? `PASS prepared ${allowlist.size} targeted deterministic draft import records`
      : `PASS prepared ${records.length} deterministic draft import records`,
  );
  console.log(`ARTIFACT_SHA256=${artifactHash}`);
  console.log(`ARTIFACT_ROOT=${path.relative(projectRoot, artifactRoot).replace(/\\/g, "/")}`);
  console.log(`IMPORT_MANIFEST=${path.relative(projectRoot, importManifestPath).replace(/\\/g, "/")}`);
}

function readAllowlist(manifest: ManifestRecord[]) {
  const option = process.argv.slice(2).find((value) => value.startsWith("--allowlist="));
  if (!option) return null;

  const values = option
    .slice("--allowlist=".length)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0) throw new Error("Targeted preparation allowlist is empty.");

  const allowlist = new Set(values);
  if (allowlist.size !== values.length) throw new Error("Targeted preparation allowlist contains duplicates.");
  const known = new Set(manifest.map((record) => record.contentId));
  for (const contentId of allowlist) {
    if (!known.has(contentId)) throw new Error(`Unknown targeted preparation Content ID: ${contentId}`);
  }
  return allowlist;
}

function readManifest() {
  const rows = new Map<string, ManifestRecord>();
  for (const line of readFileSync(manifestPath, "utf8").split(/\r?\n/)) {
    if (!/^\| BTC-\d{3} \|/.test(line)) continue;
    const cells = splitMarkdownRow(line);
    const contentId = cells[0] ?? "";
    const production = cells[3] ?? "";
    const taxonomy = cells[4] ?? "";
    const productionMatch = production.match(/^\*\*(.+)\*\*\s*·\s*`([^`]+)`$/);
    const taxonomyParts = taxonomy.split(" · ");
    if (/·\s*n\/a$/i.test(production) || taxonomyParts[2] === "Merged source") continue;
    if (!productionMatch || taxonomyParts.length !== 3) throw new Error(`Unable to parse Manifest row: ${contentId}`);
    if (rows.has(contentId)) throw new Error(`Duplicate Manifest Content ID: ${contentId}`);
    rows.set(contentId, {
      contentId,
      title: productionMatch[1] ?? "",
      slug: productionMatch[2] ?? "",
      category: taxonomyParts[0] ?? "",
      cluster: taxonomyParts[1] ?? "",
      role: taxonomyParts[2] ?? "",
    });
  }
  if (rows.size !== 44) throw new Error(`Expected 44 Manifest records, received ${rows.size}.`);
  return [...rows.values()].sort((a, b) => a.contentId.localeCompare(b.contentId));
}

function readEligibility() {
  const lines = readFileSync(eligibilityPath, "utf8").split(/\r?\n/);
  const header = lines.find((line) => line.startsWith("| ID |"));
  if (!header) throw new Error("Eligibility Matrix header not found.");
  const headerCells = splitMarkdownRow(header);
  const eligibilityIndex = headerCells.indexOf("Import Eligibility");
  if (eligibilityIndex === -1) throw new Error("Import Eligibility column not found.");

  const values = new Map<string, string>();
  for (const line of lines) {
    if (!/^\| BTC-\d{3} \|/.test(line)) continue;
    const cells = splitMarkdownRow(line);
    values.set(cells[0] ?? "", cells[eligibilityIndex] ?? "");
  }
  if (values.size !== 44) throw new Error(`Expected 44 eligibility rows, received ${values.size}.`);
  return values;
}

function prepareRecord(manifest: ManifestRecord, eligibility: Map<string, string>): PreparedRecord {
  if (eligibility.get(manifest.contentId) !== "ELIGIBLE") {
    throw new Error(`${manifest.contentId} is not ELIGIBLE.`);
  }
  const categorySlug = categoryMap.get(manifest.category);
  if (!categorySlug) throw new Error(`${manifest.contentId} has unsupported category: ${manifest.category}`);

  const draftPath = path.join(researchRoot, manifest.contentId, "ARTICLE_DRAFT.md");
  if (!existsSync(draftPath)) throw new Error(`Missing ARTICLE_DRAFT.md: ${manifest.contentId}`);
  const draft = readFileSync(draftPath, "utf8");
  const { frontmatter, body } = splitDraft(draft, draftPath);
  const draftTitle = frontmatter.get("production_title") || frontmatter.get("title") || "";
  requireEqual(`${manifest.contentId} Production Title`, draftTitle, manifest.title);
  requireEqual(`${manifest.contentId} slug`, frontmatter.get("slug") || "", manifest.slug);
  if (frontmatter.get("content_id")) requireEqual(`${manifest.contentId} content_id`, frontmatter.get("content_id") || "", manifest.contentId);
  if (frontmatter.get("category")) requireEqual(`${manifest.contentId} category`, frontmatter.get("category") || "", manifest.category);
  if (frontmatter.get("cluster")) requireEqual(`${manifest.contentId} cluster`, frontmatter.get("cluster") || "", manifest.cluster);

  const seoTitle = requiredField(frontmatter, "seo_title", manifest.contentId);
  const metaDescription = requiredField(frontmatter, "meta_description", manifest.contentId);
  const summary = requiredField(frontmatter, "excerpt", manifest.contentId);
  if (metaDescription === summary) throw new Error(`${manifest.contentId} Meta Description exactly duplicates Excerpt.`);

  const bodyMarkdown = removeLeadingH1(body, manifest.title, manifest.contentId);
  validatePassOneBody(bodyMarkdown, manifest.contentId);
  const sourceFeatureCounts = countSourceFeatures(bodyMarkdown);
  const importRecord = createDeterministicImportRecord({
    title: manifest.title,
    slug: manifest.slug,
    summary,
    categorySlug,
    status: "draft",
    seoTitle,
    seoDescription: metaDescription,
    tagSlugs: [],
    coverObjectKey: null,
    bodyMarkdown,
  });
  validateConvertedBody(bodyMarkdown, importRecord.bodyHtml, sourceFeatureCounts, manifest.contentId);

  return {
    contentId: manifest.contentId,
    bodySource: path.relative(projectRoot, draftPath).replace(/\\/g, "/"),
    eligibility: "ELIGIBLE",
    conversionResult: "PASS",
    sourceFeatureCounts,
    importRecord,
  };
}

function splitDraft(value: string, filePath: string) {
  if (!value.startsWith("---")) throw new Error(`${filePath} does not begin with frontmatter.`);
  const match = value.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${filePath} has invalid frontmatter delimiters.`);
  const frontmatter = new Map<string, string>();
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    frontmatter.set(key, raw.replace(/^["']/, "").replace(/["']$/, ""));
  }
  return { frontmatter, body: (match[2] ?? "").trim() };
}

function removeLeadingH1(body: string, title: string, contentId: string) {
  const lines = body.split(/\r?\n/);
  const firstNonBlank = lines.findIndex((line) => line.trim().length > 0);
  if (firstNonBlank === -1) throw new Error(`${contentId} body is empty.`);
  requireEqual(`${contentId} leading H1`, lines[firstNonBlank]?.trim() ?? "", `# ${title}`);
  lines.splice(firstNonBlank, 1);
  while (lines[0]?.trim() === "") lines.shift();
  const result = lines.join("\n").trim();
  if (/^#\s+/m.test(result)) throw new Error(`${contentId} contains an additional page-level H1.`);
  if (!/^##\s+/m.test(result)) throw new Error(`${contentId} has no H2 after leading H1 removal.`);
  return result;
}

function validatePassOneBody(body: string, contentId: string) {
  if (/^---\s*$/m.test(body)) throw new Error(`${contentId} body contains raw YAML delimiter.`);
  if (/\uFFFD/.test(body)) throw new Error(`${contentId} contains a replacement character.`);
  if (/!\[[^\]]*\]\([^)]+\)/.test(body)) throw new Error(`${contentId} contains media; Phase 6 media is prohibited.`);
  if (!/^## Source notes\s*$/im.test(body)) throw new Error(`${contentId} is missing approved Source notes.`);

  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(body)) !== null) {
    const href = validateMarkdownHref(match[1] ?? "");
    if (href.startsWith("/") || href.startsWith("#")) {
      throw new Error(`${contentId} contains a Pass 1 internal link: ${href}`);
    }
  }
  if (/\[[^\]]*\]\([^)]*$/.test(body)) throw new Error(`${contentId} contains a malformed Markdown link.`);
}

function countSourceFeatures(body: string) {
  return {
    strong: (body.match(/\*\*[^*\r\n]+\*\*/g) ?? []).length,
    emphasis: (body.match(/(?<!\*)\*[^*\r\n]+\*(?!\*)/g) ?? []).length,
    tables: (body.match(/^\|.*\|\r?\n\|\s*:?-.*\|$/gm) ?? []).length,
    unorderedListBlocks: countLineRuns(body, /^[-*]\s+/),
    orderedListBlocks: countLineRuns(body, /^\d+\.\s+/),
    markdownLinks: (body.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length,
  };
}

function validateConvertedBody(body: string, html: string, counts: PreparedRecord["sourceFeatureCounts"], contentId: string) {
  if (/<h1[ >]/i.test(html)) throw new Error(`${contentId} converted body contains imported H1.`);
  if (!/<h2[ >]/i.test(html)) throw new Error(`${contentId} converted body lost H2 headings.`);
  if (/\*\*[^*]+\*\*/.test(html) || /(^|[\s>(])\*[^*]+\*/m.test(html)) throw new Error(`${contentId} converted body contains raw emphasis.`);
  if (/^\s*\|.*\|\s*$/m.test(html)) throw new Error(`${contentId} converted body contains raw pipe-table residue.`);
  if ((html.match(/<table>/g) ?? []).length !== counts.tables) throw new Error(`${contentId} table count changed during conversion.`);
  if ((html.match(/<strong>/g) ?? []).length < counts.strong) throw new Error(`${contentId} lost strong emphasis.`);
  if ((html.match(/<em>/g) ?? []).length < counts.emphasis) throw new Error(`${contentId} lost emphasis.`);
  if ((html.match(/<ul>/g) ?? []).length !== counts.unorderedListBlocks) throw new Error(`${contentId} unordered-list block count changed.`);
  if ((html.match(/<ol>/g) ?? []).length !== counts.orderedListBlocks) throw new Error(`${contentId} ordered-list block count changed.`);
  if ((html.match(/<a /g) ?? []).length !== counts.markdownLinks) throw new Error(`${contentId} link count changed.`);
  if (!/<h2>Source notes<\/h2>/i.test(html)) throw new Error(`${contentId} Source notes heading was not preserved.`);
  validateHeadingOrder(html, contentId);
  const markdownText = normalizeMarkdownText(body);
  const htmlText = normalizeHtmlText(html);
  if (markdownText !== htmlText) {
    const mismatch = firstMismatch(markdownText, htmlText);
    throw new Error(`${contentId} visible text changed during conversion near [${markdownText.slice(mismatch, mismatch + 80)}] vs [${htmlText.slice(mismatch, mismatch + 80)}].`);
  }
}

function validateHeadingOrder(html: string, contentId: string) {
  const headings = [...html.matchAll(/<h([23])>/g)].map((match) => Number(match[1]));
  if (headings[0] !== 2) throw new Error(`${contentId} heading hierarchy does not start at H2.`);
  let seenH2 = false;
  for (const level of headings) {
    if (level === 2) seenH2 = true;
    if (level === 3 && !seenH2) throw new Error(`${contentId} contains H3 before H2.`);
  }
}

function validateCorpus(records: PreparedRecord[]) {
  if (records.length !== 44) throw new Error(`Expected 44 prepared records, received ${records.length}.`);
  assertUnique(records.map((record) => record.contentId), "Content ID");
  assertUnique(records.map((record) => record.importRecord.title.toLowerCase()), "Production Title");
  assertUnique(records.map((record) => (record.importRecord.seoTitle ?? "").toLowerCase()), "SEO Title");
  assertUnique(records.map((record) => record.importRecord.slug), "Slug");
  assertUnique(records.map((record) => createHash("sha256").update(record.importRecord.bodyHtml).digest("hex")), "converted body");
  if (records.some((record) => record.importRecord.status !== "draft")) throw new Error("Non-draft status found in prepared records.");
  if (records.some((record) => record.importRecord.tagSlugs.length !== 0)) throw new Error("Tags found in prepared records.");
  if (records.some((record) => record.importRecord.coverObjectKey !== null)) throw new Error("Media found in prepared records.");
  requireEqual("BTC-039 canonical slug", records.find((record) => record.contentId === "BTC-039")?.importRecord.slug ?? "", "pack-for-long-trip");
  requireEqual("BTC-045 canonical slug", records.find((record) => record.contentId === "BTC-045")?.importRecord.slug ?? "", "plan-solo-weekend-city-break");
}

function validateCategoryBaseline() {
  const actual = new Map(seedCategories.map((category) => [category.name, category.slug]));
  if (actual.size !== categoryMap.size) throw new Error(`Expected six CMS categories, received ${actual.size}.`);
  for (const [name, slug] of categoryMap) requireEqual(`CMS category ${name}`, actual.get(name) ?? "", slug);
}

function validateExistingCollisions(records: PreparedRecord[]) {
  const localArticles = readLocalArticles();
  const existing = [...seedArticles, ...localArticles];
  const incomingSlugs = new Set(records.map((record) => record.importRecord.slug.toLowerCase()));
  const incomingTitles = new Set(records.map((record) => record.importRecord.title.toLowerCase()));
  for (const article of existing) {
    if (incomingSlugs.has(article.slug.toLowerCase())) throw new Error(`Existing CMS slug collision: ${article.slug}`);
    if (incomingTitles.has(article.title.toLowerCase())) throw new Error(`Existing CMS title collision: ${article.title}`);
  }
  const published = existing.filter((article) => article.status === "published").length;
  const drafts = existing.filter((article) => article.status === "draft").length;
  if (published !== 0 || drafts !== 6 || localArticles.length !== 0) {
    throw new Error(`CMS baseline mismatch: ${published} Published, ${drafts} Draft, ${localArticles.length} local production records.`);
  }
}

function readLocalArticles() {
  if (!existsSync(localStorePath)) return [] as typeof seedArticles;
  const parsed = JSON.parse(readFileSync(localStorePath, "utf8")) as { articles?: typeof seedArticles };
  return Array.isArray(parsed.articles) ? parsed.articles : [];
}

function writeArtifact(records: PreparedRecord[]) {
  const expectedRoot = path.resolve(projectRoot, "content", "import", "budget-travel-compass");
  if (path.resolve(artifactRoot) !== expectedRoot || !artifactRoot.startsWith(path.resolve(projectRoot) + path.sep)) {
    throw new Error(`Refusing to replace unexpected artifact path: ${artifactRoot}`);
  }
  rmSync(artifactRoot, { recursive: true, force: true });
  mkdirSync(artifactRoot, { recursive: true });
  for (const record of records) {
    const folder = path.join(artifactRoot, record.contentId);
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(folder, "article.md"), renderArticle(record), "utf8");
  }
  writeFileSync(path.join(artifactRoot, "normalized-import-records.json"), `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

function writeTargetedArtifact(records: PreparedRecord[], allowlist: Set<string>) {
  if (!existsSync(artifactRoot)) throw new Error(`Artifact root does not exist: ${artifactRoot}`);
  const normalizedPath = path.join(artifactRoot, "normalized-import-records.json");
  if (!existsSync(normalizedPath)) throw new Error("Normalized import records do not exist for targeted preparation.");

  const existing = JSON.parse(readFileSync(normalizedPath, "utf8")) as PreparedRecord[];
  if (existing.length !== 44) throw new Error(`Expected 44 existing normalized records, received ${existing.length}.`);
  const replacementMap = new Map(records.filter((record) => allowlist.has(record.contentId)).map((record) => [record.contentId, record]));
  if (replacementMap.size !== allowlist.size) throw new Error("Targeted preparation records did not resolve exactly.");

  const merged = existing.map((record) => replacementMap.get(record.contentId) ?? record);
  if (merged.length !== 44 || new Set(merged.map((record) => record.contentId)).size !== 44) {
    throw new Error("Targeted normalized-record merge changed the 44-record corpus shape.");
  }

  for (const contentId of allowlist) {
    const record = replacementMap.get(contentId);
    if (!record) throw new Error(`Missing targeted prepared record: ${contentId}`);
    const folder = path.join(artifactRoot, contentId);
    if (!existsSync(folder)) throw new Error(`Target artifact folder does not exist: ${contentId}`);
    writeFileSync(path.join(folder, "article.md"), renderArticle(record), "utf8");
  }
  writeFileSync(normalizedPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
}

function renderArticle(record: PreparedRecord) {
  const item = record.importRecord;
  return [
    "---",
    `title: ${quoteFrontmatter(item.title)}`,
    `slug: ${quoteFrontmatter(item.slug)}`,
    `summary: ${quoteFrontmatter(item.summary)}`,
    `categorySlug: ${quoteFrontmatter(item.categorySlug)}`,
    'status: "draft"',
    `seoTitle: ${quoteFrontmatter(item.seoTitle ?? "")}`,
    `seoDescription: ${quoteFrontmatter(item.seoDescription ?? "")}`,
    "tags: []",
    "---",
    "",
    extractBodyMarkdown(record),
    "",
  ].join("\n");
}

function extractBodyMarkdown(record: PreparedRecord) {
  const draft = readFileSync(path.join(projectRoot, record.bodySource), "utf8");
  const { body } = splitDraft(draft, record.bodySource);
  return removeLeadingH1(body, record.importRecord.title, record.contentId);
}

function writeImportManifest(records: PreparedRecord[]) {
  const lines = [
    "# Budget Travel Compass — Draft Import Manifest",
    "",
    "Status: **PREPARED — NOT IMPORTED**  ",
    "Scope: deterministic Pass 1 draft artifact only; no media, tags, planned links, CMS writes or publication.",
    "",
    "| Content ID | Title | Slug | Category | SEO Title | Summary | Body Source | Import Status | Eligibility | Conversion Result |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...records.map((record) => {
      const item = record.importRecord;
      return `| ${record.contentId} | ${escapeTable(item.title)} | \`${item.slug}\` | \`${item.categorySlug}\` | ${escapeTable(item.seoTitle ?? "")} | ${escapeTable(item.summary)} | \`${record.bodySource}\` | PREPARED_NOT_IMPORTED | ${record.eligibility} | ${record.conversionResult} |`;
    }),
    "",
    "## Totals",
    "",
    "- Records: 44",
    "- Draft: 44",
    "- Published: 0",
    "- Eligible: 44",
    "- Conversion PASS: 44",
    "- Media: 0",
    "- Tags: 0",
    "- Planned internal links emitted: 0",
    "",
  ];
  writeFileSync(importManifestPath, lines.join("\n"), "utf8");
}

function hashArtifactFiles() {
  const files = listFiles(artifactRoot).sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(path.relative(artifactRoot, file).replace(/\\/g, "/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function listFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? listFiles(target) : [target];
  });
}

function countLineRuns(body: string, pattern: RegExp) {
  let runs = 0;
  let inside = false;
  let fenced = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^```/.test(line.trim())) {
      fenced = !fenced;
      inside = false;
      continue;
    }
    if (fenced) continue;
    const matches = pattern.test(line);
    if (matches && !inside) runs += 1;
    inside = matches;
  }
  return runs;
}

function normalizeMarkdownText(value: string) {
  let fenced = false;
  return normalizeVisibleText(
    value
      .split(/\r?\n/)
      .filter((line) => fenced || !/^\s*\|?\s*:?-{3,}/.test(line))
      .map((line) => {
        if (/^```/.test(line.trim())) {
          fenced = !fenced;
          return line;
        }
        if (fenced) return line;
        return line.replace(/^#{2,3}\s+/, "").replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").replace(/^>\s?/, "");
      })
      .join(" ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\*\*\*|\*\*|\*/g, "")
      .replace(/\|/g, " "),
  );
}

function normalizeHtmlText(value: string) {
  return normalizeVisibleText(
    value
      .replace(/<\/(?:p|h[1-6]|li|th|td|tr|table|blockquote|ul|ol)>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&"),
  );
}

function normalizeVisibleText(value: string) {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function firstMismatch(left: string, right: string) {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) if (left[index] !== right[index]) return index;
  return limit;
}

function requiredField(values: Map<string, string>, key: string, contentId: string) {
  const value = values.get(key)?.trim() ?? "";
  if (!value) throw new Error(`${contentId} is missing ${key}.`);
  return value;
}

function assertUnique(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function requireEqual(label: string, actual: string, expected: string) {
  if (actual !== expected) throw new Error(`${label} mismatch: [${actual}] vs [${expected}]`);
}

function splitMarkdownRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function quoteFrontmatter(value: string) {
  if (/["\r\n]/.test(value)) throw new Error(`Importer frontmatter value cannot be represented without mutation: ${value}`);
  return `"${value}"`;
}

function escapeTable(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

main();
