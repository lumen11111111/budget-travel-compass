import "server-only";

import type { Article, Category, HomepageBlock, Tag } from "@/db/seed-data";
import type { ArticleInput, CategoryInput, HomepageBlockInput, TagInput } from "@/db/repositories/local-admin-content";
import { PUBLIC_ARTICLE_LIST_SQL, PUBLISHED_ARTICLE_DETAIL_SQL } from "@/db/repositories/d1-public-queries";
import { getReadingTimeMinutes } from "@/lib/reading-time";

type ArticleRow = {
  id: number;
  title: string;
  slug: string;
  summary: string;
  body_html: string;
  cover_url: string;
  category_id: number;
  status: Article["status"];
  is_featured: number;
  is_pinned: number;
  sort_order: number;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  seo_title: string | null;
  seo_description: string | null;
};

type PublicArticleRow = Omit<ArticleRow, "body_html" | "created_at"> & {
  reading_time_minutes: number;
};

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  enabled: number;
  seo_title: string | null;
  seo_description: string | null;
};

type TagRow = {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  enabled: number;
};

type HomepageBlockRow = {
  id: number;
  key: string;
  title: string;
  block_type: HomepageBlock["blockType"];
  enabled: number;
  sort_order: number;
  display_count: number;
  config_json: string;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizedPublishedAt(input: ArticleInput, fallback?: string | null) {
  const value = input.publishedAt?.trim() ?? "";
  if (input.status === "published") return value || fallback || nowIso();
  return value || null;
}

async function runD1Query<T>(label: string, query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (error) {
    console.error(`D1 QUERY ERROR ${label}`, error);
    throw error;
  }
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
    enabled: Boolean(row.enabled),
    seoTitle: row.seo_title ?? undefined,
    seoDescription: row.seo_description ?? undefined,
  };
}

function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
    enabled: Boolean(row.enabled),
  };
}

function rowToHomepageBlock(row: HomepageBlockRow): HomepageBlock {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    blockType: row.block_type,
    enabled: Boolean(row.enabled),
    sortOrder: row.sort_order,
    displayCount: row.display_count,
    config: JSON.parse(row.config_json || "{}") as Record<string, unknown>,
  };
}

function rowToArticle(row: ArticleRow, tagIds: number[]): Article & { readingTimeMinutes: number } {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    bodyHtml: row.body_html,
    coverUrl: row.cover_url,
    categoryId: row.category_id,
    tagIds,
    status: row.status,
    isFeatured: Boolean(row.is_featured),
    isPinned: Boolean(row.is_pinned),
    sortOrder: row.sort_order,
    viewCount: row.view_count,
    publishedAt: row.published_at ?? "",
    updatedAt: row.updated_at,
    seoTitle: row.seo_title ?? undefined,
    seoDescription: row.seo_description ?? undefined,
    readingTimeMinutes: getReadingTimeMinutes(row.body_html),
  };
}

function rowToPublicArticle(row: PublicArticleRow, tagIds: number[]): Article & { readingTimeMinutes: number } {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    bodyHtml: "",
    coverUrl: row.cover_url,
    categoryId: row.category_id,
    tagIds,
    status: row.status,
    isFeatured: Boolean(row.is_featured),
    isPinned: Boolean(row.is_pinned),
    sortOrder: row.sort_order,
    viewCount: row.view_count,
    publishedAt: row.published_at ?? "",
    updatedAt: row.updated_at,
    seoTitle: row.seo_title ?? undefined,
    seoDescription: row.seo_description ?? undefined,
    readingTimeMinutes: Math.max(1, row.reading_time_minutes),
  };
}

export async function listD1Categories(db: D1Database) {
  const result = await runD1Query("listD1Categories", () =>
    db.prepare("SELECT * FROM categories ORDER BY sort_order ASC, id ASC").all<CategoryRow>(),
  );
  return result.results.map(rowToCategory);
}

export async function listD1Tags(db: D1Database) {
  const result = await runD1Query("listD1Tags", () => db.prepare("SELECT * FROM tags ORDER BY sort_order ASC, id ASC").all<TagRow>());
  return result.results.map(rowToTag);
}

export async function listD1HomepageBlocks(db: D1Database) {
  const result = await runD1Query("listD1HomepageBlocks", () =>
    db.prepare("SELECT * FROM homepage_blocks ORDER BY sort_order ASC, id ASC").all<HomepageBlockRow>(),
  );
  return result.results.map(rowToHomepageBlock);
}

export async function listD1Articles(db: D1Database): Promise<Array<Article & { readingTimeMinutes: number }>> {
  const [articleResult, tagResult] = await Promise.all([
    runD1Query("listD1Articles.articles", () =>
      db.prepare("SELECT * FROM articles ORDER BY sort_order ASC, published_at DESC, id ASC").all<ArticleRow>(),
    ),
    runD1Query("listD1Articles.articleTags", () =>
      db.prepare("SELECT article_id, tag_id FROM article_tags").all<{ article_id: number; tag_id: number }>(),
    ),
  ]);
  const tagMap = new Map<number, number[]>();

  for (const row of tagResult.results) {
    tagMap.set(row.article_id, [...(tagMap.get(row.article_id) ?? []), row.tag_id]);
  }

  return articleResult.results.map((row) => rowToArticle(row, tagMap.get(row.id) ?? []));
}

export async function listD1PublicArticles(db: D1Database): Promise<Array<Article & { readingTimeMinutes: number }>> {
  const [articleResult, tagResult] = await Promise.all([
    runD1Query("listD1PublicArticles.articles", () => db.prepare(PUBLIC_ARTICLE_LIST_SQL).all<PublicArticleRow>()),
    runD1Query("listD1PublicArticles.articleTags", () =>
      db.prepare("SELECT article_id, tag_id FROM article_tags").all<{ article_id: number; tag_id: number }>(),
    ),
  ]);
  const tagMap = new Map<number, number[]>();

  for (const row of tagResult.results) {
    tagMap.set(row.article_id, [...(tagMap.get(row.article_id) ?? []), row.tag_id]);
  }

  return articleResult.results.map((row) => rowToPublicArticle(row, tagMap.get(row.id) ?? []));
}

export async function getD1PublishedArticleBySlug(
  db: D1Database,
  slug: string,
): Promise<(Article & { readingTimeMinutes: number }) | null> {
  const row = await runD1Query("getD1PublishedArticleBySlug.article", () =>
    db.prepare(PUBLISHED_ARTICLE_DETAIL_SQL).bind(slug).first<ArticleRow>(),
  );
  if (!row) return null;

  const tagResult = await runD1Query("getD1PublishedArticleBySlug.articleTags", () =>
    db.prepare("SELECT tag_id FROM article_tags WHERE article_id = ?").bind(row.id).all<{ tag_id: number }>(),
  );
  return rowToArticle(
    row,
    tagResult.results.map((item) => item.tag_id),
  );
}

export async function createD1Article(db: D1Database, input: ArticleInput) {
  const timestamp = nowIso();
  const publishedAt = normalizedPublishedAt(input);
  const maxOrder = await runD1Query("createD1Article.maxOrder", () =>
    db.prepare("SELECT MAX(sort_order) as value FROM articles").first<{ value: number | null }>(),
  );
  const sortOrder = (maxOrder?.value ?? 0) + 1;

  await runD1Query("createD1Article.insertArticle", () =>
    db
      .prepare(
        "INSERT INTO articles (title, slug, summary, body_html, cover_url, category_id, status, is_featured, is_pinned, sort_order, view_count, published_at, created_at, updated_at, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, (SELECT id FROM categories WHERE slug = ?), ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)",
      )
      .bind(
        input.title,
        input.slug,
        input.summary,
        input.bodyHtml,
        input.coverUrl,
        input.categorySlug,
        input.status,
        input.isFeatured ? 1 : 0,
        input.isPinned ? 1 : 0,
        sortOrder,
        publishedAt,
        timestamp,
        timestamp,
        input.seoTitle || null,
        input.seoDescription || null,
      )
      .run(),
  );

  const article = await runD1Query("createD1Article.selectCreatedArticle", () =>
    db.prepare("SELECT id FROM articles WHERE slug = ?").bind(input.slug).first<{ id: number }>(),
  );
  if (!article) throw new Error("Failed to create article.");
  if (input.isPinned && input.status === "published") {
    await setD1FeaturedArticlePin(db, article.id, true);
  }
  await replaceD1ArticleTags(db, article.id, input.tagSlugs);
  return { id: article.id };
}

export async function updateD1Article(db: D1Database, id: number, input: ArticleInput) {
  const existing = await runD1Query("updateD1Article.selectExistingArticle", () =>
    db.prepare("SELECT published_at FROM articles WHERE id = ?").bind(id).first<{ published_at: string | null }>(),
  );
  if (!existing) return null;
  const timestamp = nowIso();
  const publishedAt = normalizedPublishedAt(input, existing.published_at);
  const isPinned = input.status === "published" && input.isPinned;
  if (isPinned) {
    await setD1FeaturedArticlePin(db, id, true);
  }

  await runD1Query("updateD1Article.updateArticle", () =>
    db
      .prepare(
        "UPDATE articles SET title = ?, slug = ?, summary = ?, body_html = ?, cover_url = ?, category_id = (SELECT id FROM categories WHERE slug = ?), status = ?, is_featured = ?, is_pinned = ?, published_at = ?, updated_at = ?, seo_title = ?, seo_description = ? WHERE id = ?",
      )
      .bind(
        input.title,
        input.slug,
        input.summary,
        input.bodyHtml,
        input.coverUrl,
        input.categorySlug,
        input.status,
        input.isFeatured ? 1 : 0,
        isPinned ? 1 : 0,
        publishedAt,
        timestamp,
        input.seoTitle || null,
        input.seoDescription || null,
        id,
      )
      .run(),
  );
  await replaceD1ArticleTags(db, id, input.tagSlugs);
  return { id };
}

export async function setD1FeaturedArticlePin(db: D1Database, id: number, pinned: boolean) {
  const timestamp = nowIso();
  if (!pinned) {
    await runD1Query("setD1FeaturedArticlePin.unpin", () =>
      db.prepare("UPDATE articles SET is_pinned = 0, updated_at = ? WHERE id = ?").bind(timestamp, id).run(),
    );
    return;
  }

  const article = await runD1Query("setD1FeaturedArticlePin.selectArticle", () =>
    db.prepare("SELECT status FROM articles WHERE id = ?").bind(id).first<{ status: Article["status"] }>(),
  );
  if (!article || article.status !== "published") return;

  await runD1Query("setD1FeaturedArticlePin.clearOtherPins", () =>
    db.prepare("UPDATE articles SET is_pinned = 0, updated_at = ? WHERE is_pinned = 1 AND id <> ?").bind(timestamp, id).run(),
  );
  await runD1Query("setD1FeaturedArticlePin.pinArticle", () =>
    db.prepare("UPDATE articles SET is_pinned = 1, updated_at = ? WHERE id = ? AND status = 'published'").bind(timestamp, id).run(),
  );
}

export async function deleteD1Article(db: D1Database, id: number) {
  await runD1Query("deleteD1Article.deleteArticleTags", () => db.prepare("DELETE FROM article_tags WHERE article_id = ?").bind(id).run());
  const result = await runD1Query("deleteD1Article.deleteArticle", () => db.prepare("DELETE FROM articles WHERE id = ?").bind(id).run());
  return result.meta.changes > 0;
}

export async function updateD1ArticleOrder(db: D1Database, articleId: number, sortOrder: number) {
  await runD1Query("updateD1ArticleOrder", () =>
    db.prepare("UPDATE articles SET sort_order = ?, updated_at = ? WHERE id = ?").bind(sortOrder, nowIso(), articleId).run(),
  );
}

async function replaceD1ArticleTags(db: D1Database, articleId: number, tagSlugs: string[]) {
  await runD1Query("replaceD1ArticleTags.deleteExistingTags", () =>
    db.prepare("DELETE FROM article_tags WHERE article_id = ?").bind(articleId).run(),
  );
  for (const slug of tagSlugs) {
    await runD1Query("replaceD1ArticleTags.insertTag", () =>
      db
        .prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) SELECT ?, id FROM tags WHERE slug = ?")
        .bind(articleId, slug)
        .run(),
    );
  }
}

export async function createD1Category(db: D1Database, input: CategoryInput) {
  const timestamp = nowIso();
  await runD1Query("createD1Category", () =>
    db
      .prepare(
        "INSERT INTO categories (name, slug, description, sort_order, enabled, seo_title, seo_description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        input.name,
        input.slug,
        input.description,
        input.sortOrder,
        input.enabled ? 1 : 0,
        input.seoTitle ?? null,
        input.seoDescription ?? null,
        timestamp,
        timestamp,
      )
      .run(),
  );
}

export async function updateD1Category(db: D1Database, id: number, input: CategoryInput) {
  await runD1Query("updateD1Category", () =>
    db
      .prepare(
        "UPDATE categories SET name = ?, slug = ?, description = ?, sort_order = ?, enabled = ?, seo_title = ?, seo_description = ?, updated_at = ? WHERE id = ?",
      )
      .bind(
        input.name,
        input.slug,
        input.description,
        input.sortOrder,
        input.enabled ? 1 : 0,
        input.seoTitle ?? null,
        input.seoDescription ?? null,
        nowIso(),
        id,
      )
      .run(),
  );
}

export async function deleteD1Category(db: D1Database, id: number) {
  const result = await runD1Query("deleteD1Category", () => db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run());
  return result.meta.changes > 0;
}

export async function createD1Tag(db: D1Database, input: TagInput) {
  const timestamp = nowIso();
  await runD1Query("createD1Tag", () =>
    db
      .prepare("INSERT INTO tags (name, slug, description, sort_order, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(input.name, input.slug, input.description, input.sortOrder, input.enabled ? 1 : 0, timestamp, timestamp)
      .run(),
  );
}

export async function updateD1Tag(db: D1Database, id: number, input: TagInput) {
  await runD1Query("updateD1Tag", () =>
    db
      .prepare("UPDATE tags SET name = ?, slug = ?, description = ?, sort_order = ?, enabled = ?, updated_at = ? WHERE id = ?")
      .bind(input.name, input.slug, input.description, input.sortOrder, input.enabled ? 1 : 0, nowIso(), id)
      .run(),
  );
}

export async function deleteD1Tag(db: D1Database, id: number) {
  await runD1Query("deleteD1Tag.deleteArticleTags", () => db.prepare("DELETE FROM article_tags WHERE tag_id = ?").bind(id).run());
  const result = await runD1Query("deleteD1Tag.deleteTag", () => db.prepare("DELETE FROM tags WHERE id = ?").bind(id).run());
  return result.meta.changes > 0;
}

export async function updateD1HomepageBlock(db: D1Database, id: number, input: HomepageBlockInput) {
  await runD1Query("updateD1HomepageBlock", () =>
    db
      .prepare("UPDATE homepage_blocks SET title = ?, enabled = ?, sort_order = ?, display_count = ?, updated_at = ? WHERE id = ?")
      .bind(input.title, input.enabled ? 1 : 0, input.sortOrder, input.displayCount, nowIso(), id)
      .run(),
  );
}
