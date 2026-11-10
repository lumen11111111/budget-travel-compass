import assert from "node:assert/strict";
import {
  buildLocalSnapshotSql,
  buildStaticPublicSnapshot,
  staticHtmlAssetPath,
  validateStaticPublicSnapshotData,
  type StaticPublicSnapshotData,
} from "./static-public/snapshot";

function fixture(): StaticPublicSnapshotData {
  return {
    articles: [
      {
        id: 1,
        title: "Guide",
        slug: "guide",
        summary: "Summary",
        body_html: "<p>Body</p>",
        cover_url: "https://media.example/cover.webp",
        category_id: 1,
        status: "published",
        is_featured: 1,
        is_pinned: 0,
        sort_order: 1,
        view_count: 0,
        published_at: "2026-01-01T00:00:00.000Z",
        editorial_updated_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        seo_title: null,
        seo_description: null,
      },
    ],
    categories: [
      {
        id: 1,
        name: "Category",
        slug: "category",
        description: "Description",
        sort_order: 1,
        enabled: 1,
        seo_title: null,
        seo_description: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    tags: [
      {
        id: 2,
        name: "Tag",
        slug: "tag",
        description: "Description",
        sort_order: 1,
        enabled: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    articleTags: [{ article_id: 1, tag_id: 2 }],
    homepageBlocks: [
      {
        id: 1,
        key: "feed",
        title: "Feed",
        block_type: "feed",
        enabled: 1,
        sort_order: 1,
        display_count: 6,
        config_json: "{}",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    siteSettings: [{ key: "site", value_json: "{}", updated_at: "2026-01-01T00:00:00.000Z" }],
  };
}

const data = fixture();
validateStaticPublicSnapshotData(data);
const snapshot = buildStaticPublicSnapshot(
  data,
  { accountId: "account", databaseId: "database", databaseName: "name" },
  "2026-01-02T00:00:00.000Z",
);
assert.equal(snapshot.manifest.publishedArticleCount, 1);
assert.match(snapshot.manifest.contentDigest, /^[a-f0-9]{64}$/);

const sql = buildLocalSnapshotSql(snapshot);
assert.match(sql, /CREATE TABLE articles/);
assert.match(sql, /INSERT INTO articles/);
assert.doesNotMatch(sql, /CREATE TABLE admin_sessions/);
assert.doesNotMatch(sql, /INSERT INTO users/);

assert.equal(staticHtmlAssetPath("/"), "index.html");
assert.equal(staticHtmlAssetPath("/guides/example"), "guides/example.html");
assert.throws(() => staticHtmlAssetPath("/../secret"));

const draft = fixture();
draft.articles[0].status = "draft";
assert.throws(() => validateStaticPublicSnapshotData(draft), /Non-Published/);

const privateField = fixture();
privateField.siteSettings[0].session_token = "forbidden";
assert.throws(() => validateStaticPublicSnapshotData(privateField), /forbidden private field/);

console.log("Static public snapshot tests: 0 fail, 0 error");
