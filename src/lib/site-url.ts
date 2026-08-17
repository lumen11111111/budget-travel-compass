import { siteConfig } from "@/config/site.config";

export type SiteUrlSource = "environment" | "config" | "development";

export function normalizeSiteUrl(value?: string) {
  const raw = value?.trim() || siteConfig.url;

  try {
    const url = new URL(raw);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return developmentSiteUrl();
    }
    url.protocol = "https:";
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return developmentSiteUrl();
  }
}

export function getCanonicalSiteUrl() {
  return resolveCanonicalSiteUrl().url;
}

export function resolveCanonicalSiteUrl(): { source: SiteUrlSource; url: URL; warnings: string[] } {
  const warnings: string[] = [];
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const raw = envUrl || siteConfig.url;
  const source: SiteUrlSource = envUrl ? "environment" : siteConfig.url ? "config" : "development";
  const url = normalizeSiteUrl(raw);
  const host = url.hostname.toLowerCase();
  const strict = process.env.CONTENTFORGE_STRICT_PRODUCTION_URL === "1";

  if (host === "example.com" || host.endsWith(".example.com")) warnings.push("Canonical URL uses example.com.");
  if (host === "localhost" || host === "127.0.0.1") warnings.push("Canonical URL uses localhost.");
  if (url.protocol !== "https:" && host !== "localhost" && host !== "127.0.0.1") warnings.push("Canonical URL should use HTTPS.");
  if (strict && warnings.length > 0) throw new Error(`Invalid production canonical URL: ${warnings.join(" ")}`);

  return { source, url, warnings };
}

export function getAbsoluteUrl(value: string) {
  const siteUrl = getCanonicalSiteUrl();

  try {
    const url = new URL(value, siteUrl);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return new URL(`${url.pathname}${url.search}${url.hash}`, siteUrl).toString();
    }
    return url.toString();
  } catch {
    return siteUrl.toString();
  }
}

export function getMediaPublicUrl(path: string) {
  return getAbsoluteUrl(path);
}

function developmentSiteUrl() {
  return new URL("http://localhost:3000");
}
