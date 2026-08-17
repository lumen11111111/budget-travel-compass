export const CACHE_EXCLUDED_PATHS = new Set(["/sitemap.xml", "/robots.txt"]);

export function isPublicEdgeCacheEligible(pathname: string) {
  return !CACHE_EXCLUDED_PATHS.has(pathname);
}
