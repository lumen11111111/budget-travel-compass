import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  articles as seedArticles,
  categories as seedCategories,
  homepageBlocks as seedHomepageBlocks,
  tags as seedTags,
  type Article,
  type Category,
  type HomepageBlock,
  type Tag,
} from "@/db/seed-data";
import { defaultSiteIdentitySettings, mergeSiteIdentitySettings, type SiteIdentitySettings } from "@/lib/site-identity";

interface LocalContentStore {
  articles: Article[];
  articleOrders?: ArticleOrder[];
  categories?: Category[];
  deletedArticleIds?: number[];
  tags?: Tag[];
  homepageBlocks?: HomepageBlock[];
  siteSettings?: Partial<SiteIdentitySettings>;
}

export interface ArticleOrder {
  articleId: number;
  sortOrder: number;
}

export interface ArticleInput {
  title: string;
  slug: string;
  summary: string;
  bodyHtml: string;
  coverUrl: string;
  categorySlug: string;
  tagSlugs: string[];
  status: "draft" | "published" | "archived";
  isFeatured: boolean;
  isPinned: boolean;
  publishedAt?: string;
  seoTitle: string;
  seoDescription: string;
}

export type CategoryInput = Omit<Category, "id">;
export type TagInput = Omit<Tag, "id">;
export type HomepageBlockInput = Pick<HomepageBlock, "title" | "enabled" | "sortOrder" | "displayCount">;

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "admin-content.json");

function emptyStore(): LocalContentStore {
  return { articles: [] };
}

function normalizeStore(value: unknown): LocalContentStore {
  if (!value || typeof value !== "object") return emptyStore();
  const store = value as Partial<LocalContentStore>;
  return {
    articles: Array.isArray(store.articles) ? store.articles : [],
    articleOrders: Array.isArray(store.articleOrders) ? store.articleOrders : undefined,
    categories: Array.isArray(store.categories) ? store.categories : undefined,
    deletedArticleIds: Array.isArray(store.deletedArticleIds) ? store.deletedArticleIds.filter((id) => Number.isFinite(id)) : undefined,
    tags: Array.isArray(store.tags) ? store.tags : undefined,
    homepageBlocks: Array.isArray(store.homepageBlocks) ? store.homepageBlocks : undefined,
    siteSettings: store.siteSettings && typeof store.siteSettings === "object" ? store.siteSettings : undefined,
  };
}

async function readStore(): Promise<LocalContentStore> {
  try {
    const raw = await readFile(storePath, "utf8");
    return normalizeStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

function readStoreSync(): LocalContentStore {
  try {
    if (!existsSync(storePath)) return emptyStore();
    return normalizeStore(JSON.parse(readFileSync(storePath, "utf8")));
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: LocalContentStore) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function nextArticleId(existing: Article[]) {
  const allIds = [...seedArticles, ...existing].map((article) => article.id);
  return Math.max(0, ...allIds) + 1;
}

function nextId<T extends { id: number }>(existing: T[], seedItems: T[]) {
  return Math.max(0, ...seedItems.map((item) => item.id), ...existing.map((item) => item.id)) + 1;
}

function managedCategories(store: LocalContentStore) {
  return store.categories ?? seedCategories;
}

function managedTags(store: LocalContentStore) {
  return store.tags ?? seedTags;
}

function managedHomepageBlocks(store: LocalContentStore) {
  return store.homepageBlocks ?? seedHomepageBlocks;
}

function categoryIdFromSlug(slug: string) {
  const categories = listLocalCategoriesSync();
  return categories.find((category) => category.slug === slug)?.id ?? categories[0]?.id ?? 1;
}

function tagIdsFromSlugs(slugs: string[]) {
  const tags = listLocalTagsSync();
  const slugSet = new Set(slugs);
  return tags.filter((tag) => slugSet.has(tag.slug)).map((tag) => tag.id);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizedPublishedAt(input: ArticleInput) {
  const value = input.publishedAt?.trim() ?? "";
  if (input.status === "published") return value || nowIso();
  return value;
}

function normalizeArticleInput(input: ArticleInput): Omit<Article, "id" | "viewCount" | "publishedAt"> & { publishedAt: string } {
  const status = input.status;
  return {
    title: input.title.trim(),
    slug: input.slug.trim(),
    summary: input.summary.trim(),
    bodyHtml: input.bodyHtml.trim(),
    coverUrl: input.coverUrl.trim(),
    categoryId: categoryIdFromSlug(input.categorySlug),
    tagIds: tagIdsFromSlugs(input.tagSlugs),
    status,
    isFeatured: input.isFeatured,
    isPinned: status === "published" && input.isPinned,
    publishedAt: normalizedPublishedAt(input),
    seoTitle: input.seoTitle.trim() || undefined,
    seoDescription: input.seoDescription.trim() || undefined,
  };
}

export function listLocalArticlesSync() {
  const store = readStoreSync();
  const deletedIds = new Set(store.deletedArticleIds ?? []);
  return store.articles.filter((article) => !deletedIds.has(article.id));
}

export function listLocalDeletedArticleIdsSync() {
  return readStoreSync().deletedArticleIds ?? [];
}

export function listLocalArticleOrdersSync() {
  return readStoreSync().articleOrders ?? [];
}

export async function listLocalArticles() {
  const store = await readStore();
  const deletedIds = new Set(store.deletedArticleIds ?? []);
  return store.articles.filter((article) => !deletedIds.has(article.id));
}

export async function getLocalArticle(id: number) {
  return (await readStore()).articles.find((article) => article.id === id) ?? null;
}

export async function createLocalArticle(input: ArticleInput) {
  const store = await readStore();
  if (input.status === "published" && input.isPinned) {
    store.articles = store.articles.map((item) => ({ ...item, isPinned: false }));
  }
  const article: Article = {
    ...normalizeArticleInput(input),
    id: nextArticleId(store.articles),
    viewCount: 0,
  };
  store.deletedArticleIds = store.deletedArticleIds?.filter((id) => id !== article.id);
  store.articles = [article, ...store.articles];
  await writeStore(store);
  return article;
}

export async function updateLocalArticle(id: number, input: ArticleInput) {
  const store = await readStore();
  const index = store.articles.findIndex((article) => article.id === id);
  if (index === -1) return null;

  const existing = store.articles[index];
  const normalized = normalizeArticleInput(input);
  const article: Article = {
    ...existing,
    ...normalized,
    publishedAt: normalized.publishedAt,
  };

  if (article.status === "published" && article.isPinned) {
    store.articles = store.articles.map((item) => (item.id === id ? article : { ...item, isPinned: false }));
  } else {
    store.articles[index] = article;
  }
  await writeStore(store);
  return article;
}

export async function setLocalFeaturedArticlePin(id: number, pinned: boolean) {
  const store = await readStore();
  const target = store.articles.find((article) => article.id === id);
  if (!target) return null;

  if (!pinned || target.status !== "published") {
    store.articles = store.articles.map((article) => (article.id === id ? { ...article, isPinned: false } : article));
    await writeStore(store);
    return { id };
  }

  store.articles = store.articles.map((article) => ({ ...article, isPinned: article.id === id }));
  await writeStore(store);
  return { id };
}

export async function deleteLocalArticle(id: number) {
  const store = await readStore();
  const nextArticles = store.articles.filter((article) => article.id !== id);
  const isSeedArticle = seedArticles.some((article) => article.id === id);
  const deleted = nextArticles.length !== store.articles.length || isSeedArticle;
  store.articles = nextArticles;
  store.articleOrders = store.articleOrders?.filter((order) => order.articleId !== id);
  if (isSeedArticle) {
    store.deletedArticleIds = [...new Set([...(store.deletedArticleIds ?? []), id])];
  }
  await writeStore(store);
  return deleted;
}

export async function updateLocalArticleOrder(articleId: number, sortOrder: number) {
  const store = await readStore();
  const articleOrders = store.articleOrders ?? [];
  const index = articleOrders.findIndex((order) => order.articleId === articleId);

  if (index === -1) {
    store.articleOrders = [...articleOrders, { articleId, sortOrder }];
  } else {
    const nextOrders = [...articleOrders];
    nextOrders[index] = { articleId, sortOrder };
    store.articleOrders = nextOrders;
  }

  store.articleOrders = store.articleOrders.toSorted((a, b) => a.sortOrder - b.sortOrder);
  await writeStore(store);
}

export function listLocalCategoriesSync() {
  return managedCategories(readStoreSync());
}

export async function listLocalCategories() {
  return managedCategories(await readStore());
}

export async function createLocalCategory(input: CategoryInput) {
  const store = await readStore();
  const categories = managedCategories(store);
  const category: Category = {
    ...input,
    id: nextId(categories, seedCategories),
  };
  store.categories = [...categories, category].sort((a, b) => a.sortOrder - b.sortOrder);
  await writeStore(store);
  return category;
}

export async function updateLocalCategory(id: number, input: CategoryInput) {
  const store = await readStore();
  const categories = managedCategories(store);
  const index = categories.findIndex((category) => category.id === id);
  if (index === -1) return null;

  const nextCategories = [...categories];
  nextCategories[index] = { ...nextCategories[index], ...input, id };
  store.categories = nextCategories.sort((a, b) => a.sortOrder - b.sortOrder);
  await writeStore(store);
  return nextCategories[index];
}

export async function deleteLocalCategory(id: number) {
  const store = await readStore();
  const categories = managedCategories(store);
  const nextCategories = categories.filter((category) => category.id !== id);
  const deleted = nextCategories.length !== categories.length;
  store.categories = nextCategories;
  await writeStore(store);
  return deleted;
}

export function listLocalTagsSync() {
  return managedTags(readStoreSync());
}

export async function listLocalTags() {
  return managedTags(await readStore());
}

export async function createLocalTag(input: TagInput) {
  const store = await readStore();
  const tags = managedTags(store);
  const tag: Tag = {
    ...input,
    id: nextId(tags, seedTags),
  };
  store.tags = [...tags, tag].sort((a, b) => a.sortOrder - b.sortOrder);
  await writeStore(store);
  return tag;
}

export async function updateLocalTag(id: number, input: TagInput) {
  const store = await readStore();
  const tags = managedTags(store);
  const index = tags.findIndex((tag) => tag.id === id);
  if (index === -1) return null;

  const nextTags = [...tags];
  nextTags[index] = { ...nextTags[index], ...input, id };
  store.tags = nextTags.sort((a, b) => a.sortOrder - b.sortOrder);
  await writeStore(store);
  return nextTags[index];
}

export async function deleteLocalTag(id: number) {
  const store = await readStore();
  const tags = managedTags(store);
  const nextTags = tags.filter((tag) => tag.id !== id);
  const deleted = nextTags.length !== tags.length;
  store.tags = nextTags;
  await writeStore(store);
  return deleted;
}

export function listLocalHomepageBlocksSync() {
  return managedHomepageBlocks(readStoreSync());
}

export async function updateLocalHomepageBlock(id: number, input: HomepageBlockInput) {
  const store = await readStore();
  const blocks = managedHomepageBlocks(store);
  const index = blocks.findIndex((block) => block.id === id);
  if (index === -1) return null;

  const nextBlocks = [...blocks];
  nextBlocks[index] = { ...nextBlocks[index], ...input, id };
  store.homepageBlocks = nextBlocks.sort((a, b) => a.sortOrder - b.sortOrder);
  await writeStore(store);
  return nextBlocks[index];
}

export function getLocalSiteSettings() {
  return mergeSiteIdentitySettings(readStoreSync().siteSettings ?? defaultSiteIdentitySettings);
}

export async function updateLocalSiteSettings(input: SiteIdentitySettings) {
  const store = await readStore();
  store.siteSettings = mergeSiteIdentitySettings(input);
  await writeStore(store);
  return store.siteSettings;
}
