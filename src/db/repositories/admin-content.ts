import "server-only";

import { getCloudflareDb } from "@/db/repositories/cloudflare-env";
import {
  createD1Article,
  createD1Category,
  createD1Tag,
  deleteD1Article,
  deleteD1Category,
  deleteD1Tag,
  updateD1Article,
  updateD1ArticleOrder,
  updateD1Category,
  updateD1HomepageBlock,
  updateD1Tag,
  setD1FeaturedArticlePin,
} from "@/db/repositories/d1-admin-content";
import {
  createLocalArticle,
  createLocalCategory,
  createLocalTag,
  deleteLocalArticle,
  deleteLocalCategory,
  deleteLocalTag,
  updateLocalArticle,
  updateLocalArticleOrder,
  updateLocalCategory,
  updateLocalHomepageBlock,
  setLocalFeaturedArticlePin,
  updateLocalTag,
  type ArticleInput,
  type CategoryInput,
  type HomepageBlockInput,
  type TagInput,
} from "@/db/repositories/local-admin-content";

export type { ArticleInput, CategoryInput, HomepageBlockInput, TagInput };

export async function createArticle(input: ArticleInput) {
  const db = await getCloudflareDb();
  if (db) return createD1Article(db, input);
  return createLocalArticle(input);
}

export async function updateArticle(id: number, input: ArticleInput) {
  const db = await getCloudflareDb();
  if (db) return updateD1Article(db, id, input);
  return updateLocalArticle(id, input);
}

export async function deleteArticle(id: number) {
  const db = await getCloudflareDb();
  if (db) return deleteD1Article(db, id);
  return deleteLocalArticle(id);
}

export async function updateArticleOrder(articleId: number, sortOrder: number) {
  const db = await getCloudflareDb();
  if (db) return updateD1ArticleOrder(db, articleId, sortOrder);
  return updateLocalArticleOrder(articleId, sortOrder);
}

export async function setFeaturedArticlePin(articleId: number, pinned: boolean) {
  const db = await getCloudflareDb();
  if (db) return setD1FeaturedArticlePin(db, articleId, pinned);
  return setLocalFeaturedArticlePin(articleId, pinned);
}

export async function createCategory(input: CategoryInput) {
  const db = await getCloudflareDb();
  if (db) return createD1Category(db, input);
  return createLocalCategory(input);
}

export async function updateCategory(id: number, input: CategoryInput) {
  const db = await getCloudflareDb();
  if (db) return updateD1Category(db, id, input);
  return updateLocalCategory(id, input);
}

export async function deleteCategory(id: number) {
  const db = await getCloudflareDb();
  if (db) return deleteD1Category(db, id);
  return deleteLocalCategory(id);
}

export async function createTag(input: TagInput) {
  const db = await getCloudflareDb();
  if (db) return createD1Tag(db, input);
  return createLocalTag(input);
}

export async function updateTag(id: number, input: TagInput) {
  const db = await getCloudflareDb();
  if (db) return updateD1Tag(db, id, input);
  return updateLocalTag(id, input);
}

export async function deleteTag(id: number) {
  const db = await getCloudflareDb();
  if (db) return deleteD1Tag(db, id);
  return deleteLocalTag(id);
}

export async function updateHomepageBlock(id: number, input: HomepageBlockInput) {
  const db = await getCloudflareDb();
  if (db) return updateD1HomepageBlock(db, id, input);
  return updateLocalHomepageBlock(id, input);
}
