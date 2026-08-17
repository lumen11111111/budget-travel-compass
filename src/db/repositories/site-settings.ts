import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { getCloudflareDb } from "@/db/repositories/cloudflare-env";
import { getLocalSiteSettings, updateLocalSiteSettings } from "@/db/repositories/local-admin-content";
import { defaultSiteIdentitySettings, mergeSiteIdentitySettings, type SiteIdentitySettings } from "@/lib/site-identity";

const SITE_SETTINGS_KEY = "site";

function nowIso() {
  return new Date().toISOString();
}

export async function getSiteIdentitySettings(): Promise<SiteIdentitySettings> {
  noStore();
  const db = await getCloudflareDb();
  if (db) {
    const row = await db.prepare("SELECT value_json FROM site_settings WHERE key = ?").bind(SITE_SETTINGS_KEY).first<{ value_json: string }>();
    if (!row) return defaultSiteIdentitySettings;

    try {
      return mergeSiteIdentitySettings(JSON.parse(row.value_json));
    } catch {
      return defaultSiteIdentitySettings;
    }
  }

  return getLocalSiteSettings();
}

export async function saveSiteIdentitySettings(input: SiteIdentitySettings) {
  const settings = mergeSiteIdentitySettings(input);
  const db = await getCloudflareDb();

  if (db) {
    await db
      .prepare(
        "INSERT INTO site_settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
      )
      .bind(SITE_SETTINGS_KEY, JSON.stringify(settings), nowIso())
      .run();
    return settings;
  }

  await updateLocalSiteSettings(settings);
  return settings;
}
