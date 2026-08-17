export interface CloudflareEnv {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  NEXT_PUBLIC_SITE_URL?: string;
  R2_PUBLIC_BASE_URL?: string;
}

