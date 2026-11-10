import { createHash } from "node:crypto";

export type SnapshotScalar = string | number | null;
export type SnapshotRow = Record<string, SnapshotScalar>;

export interface StaticPublicSnapshotData {
  articles: SnapshotRow[];
  categories: SnapshotRow[];
  tags: SnapshotRow[];
  articleTags: SnapshotRow[];
  homepageBlocks: SnapshotRow[];
  siteSettings: SnapshotRow[];
}

export interface StaticPublicSnapshotManifest {
  accountId: string;
  databaseId: string;
  databaseName: string;
  exportedAt: string;
  publishedArticleCount: number;
  categoryCount: number;
  tagCount: number;
  articleTagCount: number;
  homepageBlockCount: number;
  contentDigest: string;
}

export interface StaticPublicSnapshot {
  manifest: StaticPublicSnapshotManifest;
  data: StaticPublicSnapshotData;
}

export const STATIC_PUBLIC_QUERIES = {
  articles: `
    SELECT
      id, title, slug, summary, body_html, cover_url, category_id, status,
      is_featured, is_pinned, sort_order, view_count, published_at,
      editorial_updated_at, created_at, updated_at, seo_title, seo_description
    FROM articles
    WHERE lower(status) = 'published'
    ORDER BY sort_order ASC, published_at DESC, id ASC
  `,
  categories: `
    SELECT id, name, slug, description, sort_order, enabled, seo_title,
      seo_description, created_at, updated_at
    FROM categories
    WHERE enabled = 1
    ORDER BY sort_order ASC, id ASC
  `,
  tags: `
    SELECT id, name, slug, description, sort_order, enabled, created_at, updated_at
    FROM tags
    WHERE enabled = 1
    ORDER BY sort_order ASC, id ASC
  `,
  articleTags: `
    SELECT article_id, tag_id
    FROM article_tags
    WHERE article_id IN (SELECT id FROM articles WHERE lower(status) = 'published')
      AND tag_id IN (SELECT id FROM tags WHERE enabled = 1)
    ORDER BY article_id ASC, tag_id ASC
  `,
  homepageBlocks: `
    SELECT id, key, title, block_type, enabled, sort_order, display_count,
      config_json, created_at, updated_at
    FROM homepage_blocks
    WHERE enabled = 1
    ORDER BY sort_order ASC, id ASC
  `,
  siteSettings: `
    SELECT key, value_json, updated_at
    FROM site_settings
    WHERE key = 'site'
  `,
} as const;

function requireInteger(row: SnapshotRow, key: string) {
  const value = row[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Snapshot field ${key} must be an integer.`);
  }
  return value;
}

function requireString(row: SnapshotRow, key: string) {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`Snapshot field ${key} must be a string.`);
  }
  return value;
}

function assertUnique(rows: SnapshotRow[], key: string, label: string) {
  const values = rows.map((row) => requireString(row, key));
  if (new Set(values).size !== values.length) {
    throw new Error(`Static public snapshot contains duplicate ${label}.`);
  }
}

export function contentDigest(data: StaticPublicSnapshotData) {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export function validateStaticPublicSnapshotData(data: StaticPublicSnapshotData) {
  if (data.articles.length === 0) throw new Error("Static public snapshot has no Published articles.");
  if (data.categories.length === 0) throw new Error("Static public snapshot has no enabled categories.");
  if (data.homepageBlocks.length === 0) throw new Error("Static public snapshot has no enabled homepage blocks.");
  if (data.siteSettings.length !== 1 || data.siteSettings[0]?.key !== "site") {
    throw new Error("Static public snapshot must contain exactly one public site settings row.");
  }

  assertUnique(data.articles, "slug", "article slugs");
  assertUnique(data.categories, "slug", "category slugs");
  assertUnique(data.tags, "slug", "tag slugs");

  const articleIds = new Set(data.articles.map((row) => requireInteger(row, "id")));
  const categoryIds = new Set(data.categories.map((row) => requireInteger(row, "id")));
  const tagIds = new Set(data.tags.map((row) => requireInteger(row, "id")));

  for (const article of data.articles) {
    if (requireString(article, "status").toLowerCase() !== "published") {
      throw new Error(`Non-Published article entered the static snapshot: ${String(article.slug)}.`);
    }
    if (!requireString(article, "body_html").trim()) {
      throw new Error(`Published article has an empty body: ${String(article.slug)}.`);
    }
    if (!categoryIds.has(requireInteger(article, "category_id"))) {
      throw new Error(`Published article references a disabled or missing category: ${String(article.slug)}.`);
    }
  }

  const relationshipKeys = new Set<string>();
  for (const relationship of data.articleTags) {
    const articleId = requireInteger(relationship, "article_id");
    const tagId = requireInteger(relationship, "tag_id");
    if (!articleIds.has(articleId) || !tagIds.has(tagId)) {
      throw new Error(`Invalid public article-tag relationship: ${articleId}:${tagId}.`);
    }
    const key = `${articleId}:${tagId}`;
    if (relationshipKeys.has(key)) throw new Error(`Duplicate public article-tag relationship: ${key}.`);
    relationshipKeys.add(key);
  }

  const fieldNames = Object.values(data).flatMap((rows) =>
    (rows as Array<Record<string, unknown>>).flatMap((row: Record<string, unknown>) => Object.keys(row)),
  );
  if (fieldNames.some((field) => /password|secret|session|token/i.test(field))) {
    throw new Error("Static public snapshot contains a forbidden private field.");
  }
}

export function buildStaticPublicSnapshot(
  data: StaticPublicSnapshotData,
  identity: Pick<StaticPublicSnapshotManifest, "accountId" | "databaseId" | "databaseName">,
  exportedAt = new Date().toISOString(),
): StaticPublicSnapshot {
  validateStaticPublicSnapshotData(data);
  return {
    manifest: {
      ...identity,
      exportedAt,
      publishedArticleCount: data.articles.length,
      categoryCount: data.categories.length,
      tagCount: data.tags.length,
      articleTagCount: data.articleTags.length,
      homepageBlockCount: data.homepageBlocks.length,
      contentDigest: contentDigest(data),
    },
    data,
  };
}

function sqlLiteral(value: SnapshotScalar) {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Snapshot contains a non-finite number.");
    return String(value);
  }
  return `'${value.replaceAll("'", "''")}'`;
}

function insertStatements(table: string, columns: string[], rows: SnapshotRow[]) {
  return rows.map((row) => {
    const values = columns.map((column) => sqlLiteral(row[column] ?? null));
    return `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${values.join(", ")});`;
  });
}

export function buildLocalSnapshotSql(snapshot: StaticPublicSnapshot) {
  const statements = [
    "PRAGMA foreign_keys = OFF;",
    "BEGIN TRANSACTION;",
    `CREATE TABLE categories (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1, seo_title TEXT, seo_description TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE tags (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE articles (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL, body_html TEXT NOT NULL, cover_url TEXT NOT NULL DEFAULT '',
      category_id INTEGER NOT NULL, status TEXT NOT NULL, is_featured INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0, published_at TEXT, editorial_updated_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, seo_title TEXT, seo_description TEXT
    );`,
    `CREATE TABLE article_tags (
      article_id INTEGER NOT NULL, tag_id INTEGER NOT NULL,
      PRIMARY KEY (article_id, tag_id)
    );`,
    `CREATE TABLE homepage_blocks (
      id INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      block_type TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0, display_count INTEGER NOT NULL DEFAULT 6,
      config_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );`,
    "CREATE TABLE site_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);",
    ...insertStatements(
      "categories",
      ["id", "name", "slug", "description", "sort_order", "enabled", "seo_title", "seo_description", "created_at", "updated_at"],
      snapshot.data.categories,
    ),
    ...insertStatements(
      "tags",
      ["id", "name", "slug", "description", "sort_order", "enabled", "created_at", "updated_at"],
      snapshot.data.tags,
    ),
    ...insertStatements(
      "articles",
      [
        "id", "title", "slug", "summary", "body_html", "cover_url", "category_id", "status",
        "is_featured", "is_pinned", "sort_order", "view_count", "published_at",
        "editorial_updated_at", "created_at", "updated_at", "seo_title", "seo_description",
      ],
      snapshot.data.articles,
    ),
    ...insertStatements("article_tags", ["article_id", "tag_id"], snapshot.data.articleTags),
    ...insertStatements(
      "homepage_blocks",
      ["id", "key", "title", "block_type", "enabled", "sort_order", "display_count", "config_json", "created_at", "updated_at"],
      snapshot.data.homepageBlocks,
    ),
    ...insertStatements("site_settings", ["key", "value_json", "updated_at"], snapshot.data.siteSettings),
    "COMMIT;",
  ];

  return `${statements.join("\n")}\n`;
}

export function staticHtmlAssetPath(pathname: string) {
  if (pathname === "/") return "index.html";
  const normalized = pathname.replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized.includes("..")) throw new Error(`Unsafe static route: ${pathname}`);
  return `${normalized}.html`;
}
