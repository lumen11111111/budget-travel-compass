import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { printCheck, readJsoncFile, truncate } from "./cli-utils";
import {
  createJobId,
  executeImportPlan,
  idempotentObjectKey,
  readImportJobManifest,
  rollbackImportPlan,
  writeImportJobManifest,
  type DatabaseExecutionMode,
  type ImportPlanV2,
} from "./importer-execution";
import { wranglerD1Execute, wranglerR2ObjectDelete, wranglerR2ObjectPut } from "./wrangler";

type WranglerConfig = {
  d1_databases?: Array<{ binding?: string; database_name?: string }>;
  r2_buckets?: Array<{ binding?: string; bucket_name?: string }>;
  vars?: Record<string, string>;
};

export type ArticleFrontmatter = {
  title: string;
  slug: string;
  summary: string;
  categorySlug: string;
  tags: string[];
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  cover: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  author: string | null;
  readingTime: number | null;
  articleType: string | null;
  sources: string[];
  safetyNote: string | null;
  isFeatured: boolean;
  isPinned: boolean;
};

type ArticleCandidate = {
  folder: string;
  markdownPath: string;
  bodyMarkdown: string;
  frontmatter: ArticleFrontmatter;
  coverPath: string | null;
  inlineImages: string[];
};

type ImportPlan = {
  jobId: string;
  generatedAt: string;
  dryRun: boolean;
  executionMode: DatabaseExecutionMode;
  sourceDir: string;
  databaseName: string;
  bucketName: string;
  r2PublicBaseUrl: string;
  articles: Array<{
    title: string;
    slug: string;
    status: string;
    categorySlug: string;
    tagSlugs: string[];
      coverObjectKey: string | null;
      inlineImageObjectKeys: string[];
      sourceCount: number;
      safetyNote: string | null;
      headingCount: number;
      linkCount: number;
      bodyImageCount: number;
      readingTime: number | null;
      author: string | null;
      articleType: string | null;
      htmlFeatures: {
        h1: boolean;
        h2: boolean;
        h3: boolean;
        ul: boolean;
        blockquote: boolean;
        table: boolean;
        figure: boolean;
      };
  }>;
  rollback: Array<{
    slug: string;
    d1Sql: string;
    r2ObjectKeys: string[];
  }>;
};

type CliOptions = {
  sourceDir: string;
  planPath: string;
  execute: boolean;
  remote: boolean;
  slug: string | null;
  allowlist: Set<string>;
  rollbackJob: string | null;
};

export type DeterministicImportRecord = {
  title: string;
  slug: string;
  summary: string;
  categorySlug: string;
  status: "draft" | "published" | "archived";
  seoTitle: string | null;
  seoDescription: string | null;
  tagSlugs: string[];
  coverObjectKey: string | null;
  bodyHtml: string;
};

export type DeterministicImportRecordInput = {
  title: string;
  slug: string;
  summary: string;
  categorySlug: string;
  status: "draft" | "published" | "archived";
  seoTitle: string | null;
  seoDescription: string | null;
  bodyMarkdown: string;
  tagSlugs?: string[];
  coverObjectKey?: string | null;
  r2PublicBaseUrl?: string;
};

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = readJsoncFile<WranglerConfig>(path.join(process.cwd(), "wrangler.jsonc"));
  const databaseName = config.d1_databases?.find((database) => database.binding === "DB")?.database_name;
  const bucketName = config.r2_buckets?.find((bucket) => bucket.binding === "MEDIA_BUCKET")?.bucket_name;
  const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL || config.vars?.R2_PUBLIC_BASE_URL;

  if (!databaseName) throw new Error("Missing DB database_name in wrangler.jsonc.");
  if (!bucketName) throw new Error("Missing MEDIA_BUCKET bucket_name in wrangler.jsonc.");
  if (!r2PublicBaseUrl) throw new Error("Missing R2_PUBLIC_BASE_URL in environment or wrangler.jsonc vars.");

  if (options.rollbackJob) {
    await rollbackJob(options.rollbackJob, bucketName, databaseName, options.remote);
    return;
  }

  const sourceDir = path.resolve(process.cwd(), options.sourceDir);
  const candidates = validateFolders(sourceDir);
  const articles = candidates
    .map(readAndValidateArticle)
    .filter((article) => !options.slug || article.frontmatter.slug === options.slug)
    .filter((article) => options.allowlist.size === 0 || options.allowlist.has(article.frontmatter.slug));
  if (articles.length === 0) {
    throw new Error(options.slug ? `No article found for slug: ${options.slug}` : `No allowlisted article folders found in ${sourceDir}`);
  }
  validateAllowlist(options.allowlist, articles);
  validateUniqueSlugs(articles);
  validateImages(articles);
  await validateD1(databaseName, options.remote, options.execute, articles);

  const plan = generatePlan(options, sourceDir, databaseName, bucketName, r2PublicBaseUrl, articles);
  writePlan(options.planPath, plan);

  if (!options.execute) {
    printPlan(plan);
    printRollbackGuidance(plan);
    console.log("");
    console.log("Dry run complete. Re-run with `npm run import:articles -- --execute` after reviewing the plan.");
    return;
  }

  await executePlan(plan, articles, bucketName, databaseName, options.remote);
  printRollbackGuidance(plan);
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    sourceDir: "content/import/articles",
    planPath: "data/article-import-plan.json",
    execute: false,
    remote: false,
    slug: null,
    allowlist: new Set(),
    rollbackJob: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--source" && next) {
      options.sourceDir = next;
      index += 1;
    } else if (arg.startsWith("--source=")) {
      options.sourceDir = arg.slice("--source=".length);
    } else if (arg === "--plan" && next) {
      options.planPath = next;
      index += 1;
    } else if (arg.startsWith("--plan=")) {
      options.planPath = arg.slice("--plan=".length);
    } else if (arg === "--execute") {
      options.execute = true;
    } else if (arg === "--dry-run") {
      options.execute = false;
    } else if (arg === "--remote") {
      options.remote = true;
    } else if (arg === "--slug" && next) {
      options.slug = next;
      index += 1;
    } else if (arg.startsWith("--slug=")) {
      options.slug = arg.slice("--slug=".length);
    } else if (arg === "--allowlist" && next) {
      options.allowlist = parseAllowlist(next);
      index += 1;
    } else if (arg.startsWith("--allowlist=")) {
      options.allowlist = parseAllowlist(arg.slice("--allowlist=".length));
    } else if (arg === "--rollback-job" && next) {
      options.rollbackJob = next;
      index += 1;
    } else if (arg.startsWith("--rollback-job=")) {
      options.rollbackJob = arg.slice("--rollback-job=".length);
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log("Usage:");
  console.log("  npm run import:articles -- --source content/import/articles --dry-run");
  console.log("  npm run import:articles -- --source content/import/articles --slug article-slug --dry-run --remote");
  console.log("  npm run import:articles -- --source content/import/articles --allowlist=article-one,article-two --dry-run");
  console.log("  npm run import:articles -- --source content/import/articles --execute --remote");
  console.log("  npm run import:articles -- --rollback-job <jobId> --remote");
}

function parseAllowlist(value: string) {
  return new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
}

function validateFolders(sourceDir: string) {
  printCheck("PASS", "Pipeline", "Dry run -> Validate folders -> Validate markdown -> Validate images -> Validate D1 -> Generate import plan -> Execute");

  if (!existsSync(sourceDir)) {
    throw new Error(`Source folder does not exist: ${sourceDir}`);
  }

  const folders = readdirSync(sourceDir)
    .map((name) => path.join(sourceDir, name))
    .filter((folder) => statSync(folder).isDirectory());

  if (folders.length === 0) {
    throw new Error(`No article folders found in ${sourceDir}`);
  }

  for (const folder of folders) {
    const markdownPath = path.join(folder, "article.md");
    if (!existsSync(markdownPath)) {
      throw new Error(`Missing article.md in ${folder}`);
    }
  }

  printCheck("PASS", "Validate folders", `${folders.length} article folder(s) found.`);
  return folders;
}

function readAndValidateArticle(folder: string): ArticleCandidate {
  const markdownPath = path.join(folder, "article.md");
  const markdown = readFileSync(markdownPath, "utf8");
  const { rawFrontmatter, bodyMarkdown } = splitFrontmatter(markdown, markdownPath);
  const frontmatter = normalizeFrontmatter(parseFrontmatter(rawFrontmatter), markdownPath);
  validateArticleContract(frontmatter, bodyMarkdown, markdownPath);
  const coverPath = resolveCoverPath(folder, frontmatter.cover);
  const inlineImages = extractInlineImages(bodyMarkdown)
    .map((imagePath) => path.resolve(folder, imagePath))
    .filter((imagePath, index, list) => list.indexOf(imagePath) === index);

  return {
    folder,
    markdownPath,
    bodyMarkdown,
    frontmatter,
    coverPath,
    inlineImages,
  };
}

function splitFrontmatter(markdown: string, markdownPath: string) {
  if (!markdown.startsWith("---")) {
    throw new Error(`${markdownPath} must start with frontmatter delimited by ---`);
  }

  const endIndex = markdown.indexOf("\n---", 3);
  if (endIndex === -1) {
    throw new Error(`${markdownPath} is missing closing frontmatter delimiter.`);
  }

  return {
    rawFrontmatter: markdown.slice(3, endIndex).trim(),
    bodyMarkdown: markdown.slice(endIndex + 4).trim(),
  };
}

function parseFrontmatter(raw: string) {
  const values = new Map<string, string>();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf(":");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    values.set(key, unquote(value));
  }

  return values;
}

function normalizeFrontmatter(values: Map<string, string>, markdownPath: string): ArticleFrontmatter {
  const required = ["title", "slug", "summary", "categorySlug"];
  for (const key of required) {
    if (!values.get(key)) throw new Error(`${markdownPath} is missing required frontmatter field: ${key}`);
  }

  const status = values.get("status") || "draft";
  if (!["draft", "published", "archived"].includes(status)) {
    throw new Error(`${markdownPath} has invalid status: ${status}`);
  }

  const slug = values.get("slug") || "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${markdownPath} has invalid slug: ${slug}`);
  }

  return {
    title: values.get("title") || "",
    slug,
    summary: values.get("summary") || "",
    categorySlug: values.get("categorySlug") || "",
    tags: parseList(values.get("tags")),
    status: status as ArticleFrontmatter["status"],
    publishedAt: values.get("publishedAt") || null,
    cover: values.get("cover") || null,
    seoTitle: values.get("seoTitle") || null,
    seoDescription: values.get("seoDescription") || null,
    author: values.get("author") || null,
    readingTime: parseNumber(values.get("readingTime")),
    articleType: values.get("articleType") || null,
    sources: parseList(values.get("sources")),
    safetyNote: values.get("safetyNote") || null,
    isFeatured: parseBoolean(values.get("isFeatured")),
    isPinned: parseBoolean(values.get("isPinned")),
  };
}

function validateUniqueSlugs(articles: ArticleCandidate[]) {
  const seen = new Set<string>();
  for (const article of articles) {
    if (seen.has(article.frontmatter.slug)) {
      throw new Error(`Duplicate slug in import source: ${article.frontmatter.slug}`);
    }
    seen.add(article.frontmatter.slug);
  }
  printCheck("PASS", "Validate slugs", `${articles.length} unique article slug(s).`);
}

function validateArticleContract(frontmatter: ArticleFrontmatter, bodyMarkdown: string, markdownPath: string) {
  if (frontmatter.status === "published") {
    if (!frontmatter.publishedAt) throw new Error(`${markdownPath} published articles require publishedAt.`);
    if (!frontmatter.seoTitle) throw new Error(`${markdownPath} published articles require seoTitle.`);
    if (!frontmatter.seoDescription) throw new Error(`${markdownPath} published articles require seoDescription.`);
  }

  if (frontmatter.seoTitle && frontmatter.seoTitle.length > 70) throw new Error(`${markdownPath} seoTitle is longer than 70 characters.`);
  if (frontmatter.seoDescription && frontmatter.seoDescription.length > 170) throw new Error(`${markdownPath} seoDescription is longer than 170 characters.`);
  if (countMarkdownHeadings(bodyMarkdown) === 0) throw new Error(`${markdownPath} must contain at least one markdown heading.`);
}

function validateAllowlist(allowlist: Set<string>, articles: ArticleCandidate[]) {
  if (allowlist.size === 0) return;
  const found = new Set(articles.map((article) => article.frontmatter.slug));
  const missing = Array.from(allowlist).filter((slug) => !found.has(slug));
  if (missing.length > 0) throw new Error(`Allowlisted article slug(s) not found: ${missing.join(", ")}`);
  printCheck("PASS", "Validate allowlist", `${allowlist.size} explicit article slug(s).`);
}

function resolveCoverPath(folder: string, cover: string | null) {
  if (cover) return path.resolve(folder, cover);

  const found = readdirSync(folder).find((fileName) => fileName.toLowerCase().startsWith("cover.") && imageExtensions.has(path.extname(fileName).toLowerCase()));
  return found ? path.join(folder, found) : null;
}

function extractInlineImages(markdown: string) {
  const images: string[] = [];
  const imagePattern = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(markdown)) !== null) {
    const imagePath = match[1]?.trim();
    if (!imagePath || /^https?:\/\//i.test(imagePath) || imagePath.startsWith("/")) continue;
    images.push(imagePath);
  }

  return images;
}

function validateImages(articles: ArticleCandidate[]) {
  for (const article of articles) {
    if (article.coverPath) validateImagePath(article.coverPath, article.markdownPath);
    for (const imagePath of article.inlineImages) validateImagePath(imagePath, article.markdownPath);
  }

  printCheck("PASS", "Validate images", "Cover and inline image references exist.");
}

function validateImagePath(imagePath: string, markdownPath: string) {
  if (!existsSync(imagePath)) throw new Error(`${markdownPath} references missing image: ${imagePath}`);
  if (!imageExtensions.has(path.extname(imagePath).toLowerCase())) throw new Error(`${markdownPath} references unsupported image type: ${imagePath}`);
}

async function validateD1(databaseName: string, remote: boolean, execute: boolean, articles: ArticleCandidate[]) {
  const args = [
    "--json",
    "--command",
    [
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('articles','categories','tags','article_tags','media_assets');",
      "SELECT slug FROM categories;",
      "SELECT slug FROM tags;",
      `SELECT slug FROM articles WHERE slug IN (${articles.map((article) => `'${sqlString(article.frontmatter.slug)}'`).join(",")});`,
    ].join(" "),
  ];
  if (remote) args.push("--remote");

  const result = await wranglerD1Execute(databaseName, args);
  if (result.code !== 0) {
    const detail = truncate(result.stderr || result.stdout || "D1 validation failed.");
    if (execute) throw new Error(detail);
    printCheck("WARNING", "Validate D1", detail);
    return;
  }

  const resultSets = parseD1Results(result.stdout);
  const tableNames = new Set((resultSets[0] ?? []).map((row) => String(row.name ?? "")));
  for (const table of ["articles", "categories", "tags", "article_tags", "media_assets"]) {
    if (!tableNames.has(table)) throw new Error(`Required D1 table is missing: ${table}`);
  }

  const categorySlugs = new Set((resultSets[1] ?? []).map((row) => String(row.slug ?? "")));
  const tagSlugs = new Set((resultSets[2] ?? []).map((row) => String(row.slug ?? "")));
  const existingSlugs = new Set((resultSets[3] ?? []).map((row) => String(row.slug ?? "")));

  for (const article of articles) {
    if (!categorySlugs.has(article.frontmatter.categorySlug)) {
      throw new Error(`${article.markdownPath} references missing categorySlug: ${article.frontmatter.categorySlug}`);
    }
    for (const tag of article.frontmatter.tags) {
      if (!tagSlugs.has(tag)) throw new Error(`${article.markdownPath} references missing tag: ${tag}`);
    }
    if (existingSlugs.has(article.frontmatter.slug)) {
      throw new Error(`Article slug already exists in D1: ${article.frontmatter.slug}`);
    }
  }

  printCheck("PASS", "Validate D1", "Required tables, categories, tags, and unique slugs are valid.");
}

function generatePlan(options: CliOptions, sourceDir: string, databaseName: string, bucketName: string, r2PublicBaseUrl: string, articles: ArticleCandidate[]): ImportPlan {
  const plan: ImportPlan = {
    jobId: createJobId(articles[0]?.frontmatter.slug ?? "articles"),
    generatedAt: new Date().toISOString(),
    dryRun: !options.execute,
    executionMode: options.remote ? "remote" : "local",
    sourceDir,
    databaseName,
    bucketName,
    r2PublicBaseUrl,
    articles: articles.map((article) => {
      const coverObjectKey = article.coverPath ? objectKey(article.frontmatter.slug, article.coverPath, "cover") : null;
      const inlineImageObjectKeys = article.inlineImages.map((imagePath) => objectKey(article.frontmatter.slug, imagePath, "images"));
      const normalizedRecord = deterministicRecordForCandidate(article, r2PublicBaseUrl, coverObjectKey);
      const bodyHtml = normalizedRecord.bodyHtml;

      return {
        title: article.frontmatter.title,
        slug: article.frontmatter.slug,
        status: article.frontmatter.status,
        categorySlug: article.frontmatter.categorySlug,
        tagSlugs: article.frontmatter.tags,
        coverObjectKey,
        inlineImageObjectKeys,
        sourceCount: article.frontmatter.sources.length,
        safetyNote: article.frontmatter.safetyNote,
        headingCount: countMarkdownHeadings(article.bodyMarkdown),
        linkCount: countMarkdownLinks(article.bodyMarkdown),
        bodyImageCount: article.inlineImages.length,
        readingTime: article.frontmatter.readingTime,
        author: article.frontmatter.author,
        articleType: article.frontmatter.articleType,
        htmlFeatures: {
          h1: bodyHtml.includes("<h1>"),
          h2: bodyHtml.includes("<h2>"),
          h3: bodyHtml.includes("<h3>"),
          ul: bodyHtml.includes("<ul>"),
          blockquote: bodyHtml.includes("<blockquote>"),
          table: bodyHtml.includes("<table>"),
          figure: bodyHtml.includes("<figure>"),
        },
      };
    }),
    rollback: [],
  };

  plan.rollback = plan.articles.map((article) => ({
    slug: article.slug,
    d1Sql: `DELETE FROM article_tags WHERE article_id IN (SELECT id FROM articles WHERE slug = '${sqlString(article.slug)}'); DELETE FROM articles WHERE slug = '${sqlString(article.slug)}'; DELETE FROM media_assets WHERE r2_key IN (${[article.coverObjectKey, ...article.inlineImageObjectKeys].filter((key): key is string => Boolean(key)).map((key) => `'${sqlString(key)}'`).join(",")});`,
    r2ObjectKeys: [article.coverObjectKey, ...article.inlineImageObjectKeys].filter((key): key is string => Boolean(key)),
  }));

  printCheck("PASS", "Generate import plan", `${plan.articles.length} article(s), ${plan.rollback.reduce((count, entry) => count + entry.r2ObjectKeys.length, 0)} R2 object(s).`);
  return plan;
}

function writePlan(planPath: string, plan: ImportPlan) {
  const absolutePath = path.resolve(process.cwd(), planPath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  writeImportJobManifest(toImportPlanV2(plan));
  printCheck("PASS", "Write import plan", absolutePath);
}

function printPlan(plan: ImportPlan) {
  console.log("");
  console.log("Import plan:");
  for (const article of plan.articles) {
    console.log(`- ${article.slug}: ${article.title}`);
  }
}

async function executePlan(plan: ImportPlan, articles: ArticleCandidate[], bucketName: string, databaseName: string, remote: boolean) {
  const sourcePathsByObjectKey = new Map<string, string>();
  for (const article of articles) {
    if (article.coverPath) sourcePathsByObjectKey.set(objectKey(article.frontmatter.slug, article.coverPath, "cover"), article.coverPath);
    for (const imagePath of article.inlineImages) {
      sourcePathsByObjectKey.set(objectKey(article.frontmatter.slug, imagePath, "images"), imagePath);
    }
  }

  const result = await executeImportPlan(toImportPlanV2(plan, articles), sourcePathsByObjectKey, {
    putObject: async (objectKey, sourcePath) => {
      const upload = await wranglerR2ObjectPut(bucketName, objectKey, sourcePath, remote);
      if (upload.code !== 0) throw new Error(upload.stderr || upload.stdout || `Failed to upload ${objectKey}`);
    },
    deleteObject: async (objectKey) => {
      const deletion = await wranglerR2ObjectDelete(bucketName, objectKey, remote);
      if (deletion.code !== 0) throw new Error(deletion.stderr || deletion.stdout || `Failed to delete ${objectKey}`);
    },
    executeSql: async (sql) => {
      const args = ["--command", sql];
      if (remote) args.push("--remote");
      const result = await wranglerD1Execute(databaseName, args);
      if (result.code !== 0) throw new Error(result.stderr || result.stdout || "D1 write failed.");
      return {};
    },
  });

  writeImportJobManifest(toImportPlanV2(plan, articles), result);
  if (result.status !== "success") {
    throw new Error(JSON.stringify(result.errors, null, 2));
  }

  printCheck("PASS", "Execute import plan", `${articles.length} article(s) imported. jobId=${plan.jobId}`);
}

async function rollbackJob(jobId: string, bucketName: string, databaseName: string, remote: boolean) {
  const manifest = readImportJobManifest(jobId);
  const result = manifest.result ?? {
    jobId,
    status: "failed" as const,
    articleIds: [],
    uploadedObjects: manifest.plan.articles.flatMap((article) => article.r2ObjectKeys),
    createdDatabaseRows: [],
    skippedExistingObjects: [],
    errors: [],
    rollbackStatus: "not-run" as const,
  };

  const rollback = await rollbackImportPlan(manifest.plan, result, {
    putObject: async () => undefined,
    deleteObject: async (objectKey) => {
      const deletion = await wranglerR2ObjectDelete(bucketName, objectKey, remote);
      if (deletion.code !== 0) throw new Error(deletion.stderr || deletion.stdout || `Failed to delete ${objectKey}`);
    },
    executeSql: async (sql) => {
      const args = ["--command", sql];
      if (remote) args.push("--remote");
      const write = await wranglerD1Execute(databaseName, args);
      if (write.code !== 0) throw new Error(write.stderr || write.stdout || "Rollback D1 write failed.");
      return {};
    },
  });

  writeImportJobManifest(manifest.plan, { ...result, rollbackStatus: rollback.rollbackStatus, errors: [...result.errors, ...rollback.errors] });
  if (rollback.rollbackStatus !== "success") throw new Error(`Rollback incomplete for ${jobId}: ${JSON.stringify(rollback.errors)}`);
  printCheck("PASS", "Rollback import job", jobId);
}

function toImportPlanV2(plan: ImportPlan, articles: ArticleCandidate[] = []): ImportPlanV2 {
  return {
    jobId: plan.jobId,
    generatedAt: plan.generatedAt,
    dryRun: plan.dryRun,
    executionMode: plan.executionMode,
    sourceDir: plan.sourceDir,
    databaseName: plan.databaseName,
    bucketName: plan.bucketName,
    r2PublicBaseUrl: plan.r2PublicBaseUrl,
    articles: plan.articles.map((articlePlan) => {
      const article = articles.find((candidate) => candidate.frontmatter.slug === articlePlan.slug);
      return {
        slug: articlePlan.slug,
        articleInsertSql: article ? buildArticleSql(article, plan.r2PublicBaseUrl) : "",
        mediaInsertSql: [],
        tagInsertSql: [],
        r2ObjectKeys: [articlePlan.coverObjectKey, ...articlePlan.inlineImageObjectKeys].filter((key): key is string => Boolean(key)),
        rollbackSql: plan.rollback.find((rollback) => rollback.slug === articlePlan.slug)?.d1Sql.split(";").map((sql) => sql.trim()).filter(Boolean) ?? [],
      };
    }),
  };
}

function buildArticleSql(article: ArticleCandidate, r2PublicBaseUrl: string) {
  const now = new Date().toISOString();
  const coverObjectKey = article.coverPath ? objectKey(article.frontmatter.slug, article.coverPath, "cover") : null;
  const coverUrl = coverObjectKey ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${coverObjectKey}` : "";
  const bodyHtml = deterministicRecordForCandidate(article, r2PublicBaseUrl, coverObjectKey).bodyHtml;
  const publishedAt = article.frontmatter.status === "published" ? article.frontmatter.publishedAt || now : null;
  const tagValues = article.frontmatter.tags.map((tag) => `'${sqlString(tag)}'`).join(",");
  const mediaInserts = [
    ...(article.coverPath && coverObjectKey ? [mediaAssetSql(coverObjectKey, coverUrl, article.coverPath, article.frontmatter.title, now)] : []),
    ...article.inlineImages.map((imagePath) => {
      const key = objectKey(article.frontmatter.slug, imagePath, "images");
      return mediaAssetSql(key, `${r2PublicBaseUrl.replace(/\/$/, "")}/${key}`, imagePath, article.frontmatter.title, now);
    }),
  ];

  return [
    ...mediaInserts,
    `INSERT INTO articles (title, slug, summary, body_html, cover_media_id, cover_url, category_id, status, is_featured, is_pinned, sort_order, view_count, published_at, created_at, updated_at, seo_title, seo_description)`,
    `SELECT '${sqlString(article.frontmatter.title)}', '${sqlString(article.frontmatter.slug)}', '${sqlString(article.frontmatter.summary)}', '${sqlString(bodyHtml)}', ${coverObjectKey ? `(SELECT id FROM media_assets WHERE r2_key = '${sqlString(coverObjectKey)}')` : "NULL"}, '${sqlString(coverUrl)}', categories.id, '${article.frontmatter.status}', ${article.frontmatter.isFeatured ? 1 : 0}, ${article.frontmatter.isPinned ? 1 : 0}, COALESCE((SELECT MAX(sort_order) FROM articles), 0) + 1, 0, ${publishedAt ? `'${sqlString(publishedAt)}'` : "NULL"}, '${now}', '${now}', ${nullableSql(article.frontmatter.seoTitle)}, ${nullableSql(article.frontmatter.seoDescription)}`,
    `FROM categories WHERE categories.slug = '${sqlString(article.frontmatter.categorySlug)}' AND NOT EXISTS (SELECT 1 FROM articles WHERE slug = '${sqlString(article.frontmatter.slug)}');`,
    tagValues ? `INSERT OR IGNORE INTO article_tags (article_id, tag_id) SELECT articles.id, tags.id FROM articles JOIN tags ON tags.slug IN (${tagValues}) WHERE articles.slug = '${sqlString(article.frontmatter.slug)}';` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function markdownToHtml(markdown: string, slug: string, r2PublicBaseUrl = ""): string {
  const html: string = markdown
    .split(/\r?\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const headingWithBody = block.match(/^(#{1,3})\s+([^\r\n]+)\r?\n([\s\S]+)$/);
      if (headingWithBody) {
        const level = headingWithBody[1]?.length ?? 0;
        const heading = escapeHtml(headingWithBody[2] ?? "");
        return `<h${level}>${heading}</h${level}>\n${markdownToHtml(headingWithBody[3] ?? "", slug, r2PublicBaseUrl)}`;
      }

      const imageMatch = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imageMatch) {
        const alt = escapeHtml(imageMatch[1] || "");
        const source = imageMatch[2] || "";
        const src = /^https?:\/\//i.test(source) || source.startsWith("/") ? source : `${r2PublicBaseUrl.replace(/\/$/, "")}/${objectKey(slug, source, "images")}`;
        return `<figure><img src="${escapeHtml(src)}" alt="${alt}" /></figure>`;
      }

      if (block.startsWith("### ")) return `<h3>${escapeHtml(block.slice(4))}</h3>`;
      if (block.startsWith("## ")) return `<h2>${escapeHtml(block.slice(3))}</h2>`;
      if (block.startsWith("# ")) return `<h1>${escapeHtml(block.slice(2))}</h1>`;
      if (isUnorderedList(block)) return `<ul>${block.split(/\r?\n/).map((line) => `<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      if (isOrderedList(block)) return `<ol>${block.split(/\r?\n/).map((line) => `<li>${inlineMarkdown(line.replace(/^\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
      if (isBlockquote(block)) return `<blockquote>${block.split(/\r?\n/).map((line) => `<p>${inlineMarkdown(line.replace(/^>\s?/, ""))}</p>`).join("")}</blockquote>`;
      if (isMarkdownTable(block)) return markdownTableToHtml(block);
      return `<p>${inlineMarkdown(block).replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  assertNoRawMarkdownResidue(html);
  return html;
}

export function createDeterministicImportRecord(input: DeterministicImportRecordInput): DeterministicImportRecord {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new Error(`Invalid deterministic record slug: ${input.slug}`);
  if (!input.title.trim()) throw new Error("Deterministic import record requires title.");
  if (!input.summary.trim()) throw new Error(`Deterministic import record requires summary: ${input.slug}`);
  if (!input.categorySlug.trim()) throw new Error(`Deterministic import record requires categorySlug: ${input.slug}`);

  return {
    title: input.title,
    slug: input.slug,
    summary: input.summary,
    categorySlug: input.categorySlug,
    status: input.status,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    tagSlugs: [...(input.tagSlugs ?? [])],
    coverObjectKey: input.coverObjectKey ?? null,
    bodyHtml: markdownToHtml(input.bodyMarkdown, input.slug, input.r2PublicBaseUrl ?? ""),
  };
}

function deterministicRecordForCandidate(article: ArticleCandidate, r2PublicBaseUrl: string, coverObjectKey: string | null) {
  return createDeterministicImportRecord({
    title: article.frontmatter.title,
    slug: article.frontmatter.slug,
    summary: article.frontmatter.summary,
    categorySlug: article.frontmatter.categorySlug,
    status: article.frontmatter.status,
    seoTitle: article.frontmatter.seoTitle,
    seoDescription: article.frontmatter.seoDescription,
    tagSlugs: article.frontmatter.tags,
    coverObjectKey,
    bodyMarkdown: article.bodyMarkdown,
    r2PublicBaseUrl,
  });
}

function mediaAssetSql(r2Key: string, url: string, filePath: string, altText: string, now: string) {
  const stats = statSync(filePath);
  const mimeType = mimeTypeFor(filePath);
  return `INSERT INTO media_assets (r2_key, url, mime_type, file_size, alt_text, usage_state, created_at) SELECT '${sqlString(r2Key)}', '${sqlString(url)}', '${sqlString(mimeType)}', ${stats.size}, '${sqlString(altText)}', 'used', '${now}' WHERE NOT EXISTS (SELECT 1 FROM media_assets WHERE r2_key = '${sqlString(r2Key)}');`;
}

function mimeTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function parseD1Results(stdout: string): Array<Array<Record<string, unknown>>> {
  const parsed = JSON.parse(stdout || "[]") as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => {
    if (typeof item === "object" && item !== null && "results" in item) {
      const results = (item as { results?: unknown }).results;
      return Array.isArray(results) ? results.filter(isRecord) : [];
    }
    return [];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countMarkdownHeadings(markdown: string) {
  return (markdown.match(/^#{1,6}\s+/gm) ?? []).length;
}

function countMarkdownLinks(markdown: string) {
  return (markdown.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
}

function isUnorderedList(block: string) {
  return block.split(/\r?\n/).every((line) => /^[-*]\s+/.test(line));
}

function isOrderedList(block: string) {
  return block.split(/\r?\n/).every((line) => /^\d+\.\s+/.test(line));
}

function isBlockquote(block: string) {
  return block.split(/\r?\n/).every((line) => /^>\s?/.test(line));
}

function isMarkdownTable(block: string) {
  const lines = block.split(/\r?\n/);
  return lines.length >= 2 && lines[0].includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[1]);
}

function markdownTableToHtml(block: string) {
  const lines = block.split(/\r?\n/);
  const headers = splitTableRow(lines[0]);
  const bodyRows = lines.slice(2).map(splitTableRow).filter((row) => row.length > 0);
  if (headers.length === 0 || headers.some((header) => !header)) throw new Error("Markdown table has an empty header cell.");
  for (const row of bodyRows) {
    if (row.length !== headers.length) {
      throw new Error(`Markdown table column mismatch: expected ${headers.length}, received ${row.length}.`);
    }
  }
  return [
    "<table>",
    `<thead><tr>${headers.map((header) => `<th>${inlineMarkdown(header)}</th>`).join("")}</tr></thead>`,
    `<tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`,
    "</table>",
  ].join("");
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function inlineMarkdown(value: string) {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const output: string[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(value)) !== null) {
    output.push(renderEmphasis(escapeHtml(value.slice(cursor, match.index))));
    const label = match[1] ?? "";
    const href = validateMarkdownHref(match[2] ?? "");
    output.push(`<a href="${escapeHtml(href)}">${renderEmphasis(escapeHtml(label))}</a>`);
    cursor = match.index + match[0].length;
  }

  const tail = value.slice(cursor);
  if (/\[[^\]]*\]\([^)]*$/.test(tail) || /\[[^\]]*\]\(\s*\)/.test(value)) {
    throw new Error("Malformed Markdown link.");
  }
  output.push(renderEmphasis(escapeHtml(tail)));
  return output.join("");
}

export function validateMarkdownHref(value: string) {
  const href = value.trim();
  if (!href || /[\u0000-\u001f\u007f\s]/.test(href)) throw new Error(`Unsafe or malformed Markdown href: ${value}`);
  if (/^https?:\/\//i.test(href)) {
    try {
      const parsed = new URL(href);
      if (!parsed.hostname || !["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid");
      return href;
    } catch {
      throw new Error(`Unsafe or malformed Markdown href: ${href}`);
    }
  }
  if (/^mailto:[^@\s]+@[^@\s]+$/i.test(href) || /^#[A-Za-z0-9][A-Za-z0-9_-]*$/.test(href) || (/^\/(?!\/)[^\s]*$/.test(href))) return href;
  throw new Error(`Unsafe or unsupported Markdown href: ${href}`);
}

function renderEmphasis(value: string) {
  return value
    .replace(/\*\*\*([^*\r\n]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*\r\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\r\n]+)\*(?!\*)/g, "$1<em>$2</em>");
}

export function assertNoRawMarkdownResidue(html: string) {
  if (/\*\*[^*\r\n]+\*\*/.test(html)) throw new Error("Raw Markdown strong residue detected after conversion.");
  if (/(^|[\s>(])\*[^*\r\n]+\*(?=[\s<.,;:!?)]|$)/m.test(html)) throw new Error("Raw Markdown emphasis residue detected after conversion.");
  if (/^\s*\|.*\|\s*$/m.test(html)) throw new Error("Raw Markdown table residue detected after conversion.");
}

function printRollbackGuidance(plan: ImportPlan) {
  console.log("");
  console.log("Rollback guidance:");
  console.log("If the import stops halfway, review data/article-import-plan.json first.");
  console.log("For D1 cleanup, run the d1Sql statements listed under rollback for affected slugs.");
  console.log("For R2 cleanup, delete the object keys listed under rollback.r2ObjectKeys.");
  console.log(`Example D1 target: ${plan.databaseName}`);
  console.log(`Example R2 bucket: ${plan.bucketName}`);
}

function objectKey(slug: string, filePath: string, group: "cover" | "images") {
  return idempotentObjectKey(slug, filePath, group);
}

function parseList(value: string | undefined) {
  if (!value) return [];
  return value
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((item) => unquote(item.trim()))
    .filter(Boolean);
}

function parseBoolean(value: string | undefined) {
  return value === "true" || value === "1" || value === "yes";
}

function parseNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function unquote(value: string) {
  return value.replace(/^['"]/, "").replace(/['"]$/, "");
}

function sqlString(value: string) {
  return value.replace(/'/g, "''");
}

function nullableSql(value: string | null) {
  return value ? `'${sqlString(value)}'` : "NULL";
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown import error.";
    printCheck("FAIL", "Article import", message);
    console.log("");
    console.log("Recovery:");
    console.log("- If no D1 write happened, fix the validation error and run the dry run again.");
    console.log("- If R2 uploads completed but D1 failed, delete uploaded object keys from data/article-import-plan.json.");
    console.log("- If D1 wrote an article and later steps failed, run the rollback SQL from data/article-import-plan.json for the affected slug.");
    process.exitCode = 1;
  });
}
