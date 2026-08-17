import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  articles as seedArticles,
  categories as seedCategories,
  homepageBlocks as seedHomepageBlocks,
  siteSettings,
  tags as seedTags,
  type Article,
  type Category,
  type HomepageBlock,
  type Tag,
} from "@/db/seed-data";

interface LocalContentStore {
  articles?: Article[];
  articleOrders?: Array<{ articleId: number; sortOrder: number }>;
  categories?: Category[];
  tags?: Tag[];
  homepageBlocks?: HomepageBlock[];
}

const storePath = path.join(process.cwd(), "data", "admin-content.json");

function readLocalStore(): LocalContentStore {
  if (!existsSync(storePath)) return {};
  return JSON.parse(readFileSync(storePath, "utf8")) as LocalContentStore;
}

function sqlString(value: unknown) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlText(value: unknown) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function sqlBool(value: boolean) {
  return value ? 1 : 0;
}

function nowIso() {
  return new Date().toISOString();
}

const localStore = readLocalStore();
const categories = localStore.categories ?? seedCategories;
const tags = localStore.tags ?? seedTags;
const articles = [...(localStore.articles ?? []), ...seedArticles].filter(
  (article, index, items) => items.findIndex((item) => item.id === article.id) === index,
);
const homepageBlocks = localStore.homepageBlocks ?? seedHomepageBlocks;
const articleOrderMap = new Map((localStore.articleOrders ?? []).map((order) => [order.articleId, order.sortOrder]));
const timestamp = nowIso();
const statements: string[] = [
  "PRAGMA foreign_keys = OFF;",
  "DELETE FROM article_tags;",
  "DELETE FROM articles;",
  "DELETE FROM categories;",
  "DELETE FROM tags;",
  "DELETE FROM homepage_blocks;",
  "DELETE FROM site_settings;",
];

for (const category of categories) {
  statements.push(
    `INSERT INTO categories (id, name, slug, description, sort_order, enabled, seo_title, seo_description, created_at, updated_at) VALUES (${category.id}, ${sqlText(category.name)}, ${sqlText(category.slug)}, ${sqlText(category.description)}, ${category.sortOrder}, ${sqlBool(category.enabled)}, ${sqlString(category.seoTitle)}, ${sqlString(category.seoDescription)}, ${sqlText(timestamp)}, ${sqlText(timestamp)});`,
  );
}

for (const tag of tags) {
  statements.push(
    `INSERT INTO tags (id, name, slug, description, sort_order, enabled, created_at, updated_at) VALUES (${tag.id}, ${sqlText(tag.name)}, ${sqlText(tag.slug)}, ${sqlText(tag.description)}, ${tag.sortOrder}, ${sqlBool(tag.enabled)}, ${sqlText(timestamp)}, ${sqlText(timestamp)});`,
  );
}

for (const article of articles) {
  const sortOrder = articleOrderMap.get(article.id) ?? article.id;
  statements.push(
    `INSERT INTO articles (id, title, slug, summary, body_html, cover_url, category_id, status, is_featured, is_pinned, sort_order, view_count, published_at, created_at, updated_at, seo_title, seo_description) VALUES (${article.id}, ${sqlText(article.title)}, ${sqlText(article.slug)}, ${sqlText(article.summary)}, ${sqlText(article.bodyHtml)}, ${sqlText(article.coverUrl)}, ${article.categoryId}, ${sqlText(article.status)}, ${sqlBool(article.isFeatured)}, ${sqlBool(article.isPinned)}, ${sortOrder}, ${article.viewCount}, ${sqlString(article.publishedAt)}, ${sqlText(timestamp)}, ${sqlText(timestamp)}, ${sqlString(article.seoTitle)}, ${sqlString(article.seoDescription)});`,
  );

  for (const tagId of article.tagIds) {
    statements.push(`INSERT INTO article_tags (article_id, tag_id) VALUES (${article.id}, ${tagId});`);
  }
}

for (const block of homepageBlocks) {
  statements.push(
    `INSERT INTO homepage_blocks (id, key, title, block_type, enabled, sort_order, display_count, config_json, created_at, updated_at) VALUES (${block.id}, ${sqlText(block.key)}, ${sqlText(block.title)}, ${sqlText(block.blockType)}, ${sqlBool(block.enabled)}, ${block.sortOrder}, ${block.displayCount}, ${sqlText(JSON.stringify(block.config))}, ${sqlText(timestamp)}, ${sqlText(timestamp)});`,
  );
}

statements.push(
  `INSERT INTO site_settings (key, value_json, updated_at) VALUES ('site', ${sqlText(JSON.stringify(siteSettings))}, ${sqlText(timestamp)});`,
  "PRAGMA foreign_keys = ON;",
);

const output = `${statements.join("\n")}\n`;
const outArg = process.argv.find((arg) => arg.startsWith("--out="));

async function main() {
  if (outArg) {
    const outPath = path.resolve(process.cwd(), outArg.replace("--out=", ""));
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, output, "utf8");
    console.log(`Wrote ${outPath}`);
    return;
  }

  console.log(output);
}

void main();
