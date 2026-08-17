import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudflareEnv } from "@/types/cloudflare";

const SESSION_PREFIX = "v1";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const MISSING_ADMIN_PASSWORD = "__CONTENTFORGE_ADMIN_PASSWORD_NOT_CONFIGURED__";
const MISSING_SESSION_SECRET = "__CONTENTFORGE_SESSION_SECRET_NOT_CONFIGURED__";

export const ADMIN_SESSION_COOKIE = "qf_admin_session";

export interface AdminAuthConfig {
  adminPassword: string;
  sessionSecret: string;
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

async function getCloudflareAdminAuthConfig(): Promise<Partial<AdminAuthConfig> | null> {
  try {
    const context = await getCloudflareContext<{ [key: string]: unknown }, ExecutionContext>({ async: true });
    const env = context.env as CloudflareEnv;

    return {
      adminPassword: env.ADMIN_PASSWORD,
      sessionSecret: env.SESSION_SECRET,
    };
  } catch {
    return null;
  }
}

export async function getAdminAuthConfig(): Promise<AdminAuthConfig> {
  const cloudflareConfig = await getCloudflareAdminAuthConfig();

  return {
    adminPassword: cloudflareConfig?.adminPassword || process.env.ADMIN_PASSWORD || MISSING_ADMIN_PASSWORD,
    sessionSecret: cloudflareConfig?.sessionSecret || process.env.SESSION_SECRET || MISSING_SESSION_SECRET,
  };
}

export async function createAdminSessionValue(secret: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${SESSION_PREFIX}.${expiresAt}`;
  const signature = await digest(`${payload}.${secret}`);
  return `${payload}.${signature}`;
}

export async function verifyAdminSessionValue(value: string | undefined, secret: string) {
  if (!value) return false;

  const [prefix, expiresAtRaw, signature] = value.split(".");
  if (prefix !== SESSION_PREFIX || !expiresAtRaw || !signature) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;

  const expected = await digest(`${prefix}.${expiresAtRaw}.${secret}`);
  return expected === signature;
}

export function getAdminCookieMaxAge() {
  return SESSION_TTL_SECONDS;
}
