export function buildAnalyticsPageLocation(origin: string, pathname: string) {
  const baseOrigin = new URL(origin).origin;
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const sanitized = new URL(path, baseOrigin);
  return `${baseOrigin}${sanitized.pathname}`;
}
