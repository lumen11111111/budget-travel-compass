import { siteConfig } from "@/config/site.config";
import type { SitemapContent } from "@/db/repositories/content";
import { toMetadataDate } from "@/lib/content-dates";
import { getCanonicalSiteUrl } from "@/lib/site-url";

export const sitemapStaticPages = [
  "/",
  "/news",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms-of-service",
  "/cookie-policy",
  "/editorial-policy",
  "/affiliate-disclosure",
  "/dmca-copyright",
  "/disclaimer",
] as const;

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderUrlEntry(input: {
  loc: string;
  lastmod?: string | null;
  changefreq?: string;
  priority?: number;
}): string {
  const lines = ["  <url>", `    <loc>${escapeXml(input.loc)}</loc>`];
  if (input.lastmod) lines.push(`    <lastmod>${escapeXml(input.lastmod)}</lastmod>`);
  if (input.changefreq) lines.push(`    <changefreq>${escapeXml(input.changefreq)}</changefreq>`);
  if (typeof input.priority === "number") lines.push(`    <priority>${input.priority.toFixed(1)}</priority>`);
  lines.push("  </url>");
  return lines.join("\n");
}

export function buildSitemapXml(content: SitemapContent, siteUrl = getCanonicalSiteUrl()): string {
  const urls = new Map<string, { lastmod?: string | null; changefreq?: string; priority?: number }>();

  const add = (path: string, metadata: { lastmod?: string | null; changefreq?: string; priority?: number }) => {
    const loc = absoluteCanonicalUrl(siteUrl, path);
    if (!isSitemapAllowedUrl(loc)) return;
    urls.set(loc, metadata);
  };

  for (const path of sitemapStaticPages) {
    add(path, {
      changefreq: path === "/" || path === "/news" ? "daily" : "monthly",
      priority: path === "/" ? 1 : path === "/news" ? 0.9 : 0.5,
    });
  }

  for (const article of content.articles) {
    add(`/news/${article.slug}`, {
      lastmod: toMetadataDate(article.updatedAt, article.publishedAt),
      changefreq: "weekly",
      priority: 0.8,
    });
  }

  for (const category of content.categories) {
    add(categoryPathForSlug(category.slug), {
      lastmod: toMetadataDate(category.updatedAt),
      changefreq: "weekly",
      priority: 0.7,
    });
  }

  for (const tag of content.tags) {
    add(`/tag/${tag.slug}`, {
      lastmod: toMetadataDate(tag.updatedAt),
      changefreq: "weekly",
      priority: 0.6,
    });
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...Array.from(urls.entries()).map(([loc, metadata]) => renderUrlEntry({ loc, ...metadata })),
    "</urlset>",
    "",
  ].join("\n");
}

export function createSitemapResponse(xml: string, includeBody: boolean): Response {
  const body = new TextEncoder().encode(xml);

  return new Response(includeBody ? body : null, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=0, must-revalidate, no-transform",
      "Content-Encoding": "identity",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function categoryPathForSlug(slug: string): string {
  const primaryNavigation = Array.from(siteConfig.navigation.primary);
  const topLevel = primaryNavigation.find((item) => normalizePath(item.href) === `/${slug}`);
  if (topLevel) return normalizePath(topLevel.href);

  const categoryRoute = primaryNavigation.find((item) => normalizePath(item.href) === `/category/${slug}`);
  return categoryRoute ? normalizePath(categoryRoute.href) : `/category/${slug}`;
}

function absoluteCanonicalUrl(siteUrl: URL, path: string) {
  const base = new URL(siteUrl.toString());
  base.pathname = "";
  base.search = "";
  base.hash = "";
  return new URL(normalizePath(path), base).toString();
}

function normalizePath(path: string) {
  const value = path.trim() || "/";
  if (value === "/") return "/";
  return `/${value.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function isSitemapAllowedUrl(value: string) {
  const url = new URL(value);
  const path = url.pathname;
  if (url.hostname.endsWith(".workers.dev")) return false;
  if (path === "/admin" || path.startsWith("/admin/")) return false;
  if (path === "/search" || path.startsWith("/search/")) return false;
  if (path.includes("preview") || path.includes("test-article")) return false;
  return true;
}
