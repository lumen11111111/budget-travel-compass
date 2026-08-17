import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudflareEnv } from "@/types/cloudflare";

const requiredTables = ["articles", "categories", "tags", "article_tags", "homepage_blocks"];

export async function getCloudflareDb(): Promise<D1Database | null> {
  let context;
  try {
    context = await getCloudflareContext<{ [key: string]: unknown }, ExecutionContext>({ async: true });
  } catch {
    return null;
  }

  const env = context.env as CloudflareEnv;
  const db = env.DB ?? null;
  if (!db) return null;

  try {
    const placeholders = requiredTables.map(() => "?").join(", ");
    const result = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`)
      .bind(...requiredTables)
      .all<{ name: string }>();
    const existingTables = new Set(result.results.map((table) => table.name));
    return requiredTables.every((table) => existingTables.has(table)) ? db : null;
  } catch {
    return null;
  }
}
