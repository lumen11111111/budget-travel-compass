import { readFileSync } from "node:fs";
import path from "node:path";

const ORIGIN = "https://budgettravelcompass.com";
const manifest = JSON.parse(
  readFileSync(path.join(process.cwd(), ".tmp", "static-public", "static-assets-manifest.json"), "utf8"),
) as { contentDigest: string; htmlRoutes: string[] };

type Failure = { route: string; status?: number; staticDigest?: string | null; error?: string };

async function checkStaticRoute(route: string, failures: Failure[]) {
  try {
    const response = await fetch(`${ORIGIN}${route}`, { redirect: "manual", headers: { "cache-control": "no-cache" } });
    const staticDigest = response.headers.get("x-budget-travel-static");
    if (response.status !== 200 || staticDigest !== manifest.contentDigest) {
      failures.push({ route, status: response.status, staticDigest });
    }
    await response.body?.cancel();
  } catch (error) {
    failures.push({ route, error: String(error) });
  }
}

async function main() {
  const failures: Failure[] = [];
  for (let round = 1; round <= 2; round += 1) {
    for (let index = 0; index < manifest.htmlRoutes.length; index += 8) {
      await Promise.all(manifest.htmlRoutes.slice(index, index + 8).map((route) => checkStaticRoute(route, failures)));
    }
  }

  const special = [
    { url: `${ORIGIN}/search?q=budget`, status: 200, static: true },
    { url: `${ORIGIN}/search-index.json`, status: 200, static: true },
    { url: `${ORIGIN}/ads.txt`, status: 200, static: true },
    { url: `${ORIGIN}/icon.png?static-public-check=1`, status: 200, static: true },
    { url: `${ORIGIN}/apple-icon.png?static-public-check=1`, status: 200, static: true },
    { url: `${ORIGIN}/__static-public-verification-missing__`, status: 404, static: true },
    { url: `${ORIGIN}/news`, status: 308, static: true },
    { url: `${ORIGIN}/admin/login`, status: 200, static: false },
    { url: "http://budgettravelcompass.com/guides", status: 301, static: false },
  ];
  for (const check of special) {
    const response = await fetch(check.url, { redirect: "manual" });
    const staticDigest = response.headers.get("x-budget-travel-static");
    if (response.status !== check.status || (check.static ? staticDigest !== manifest.contentDigest : staticDigest !== null)) {
      failures.push({ route: check.url, status: response.status, staticDigest });
    }
    await response.body?.cancel();
  }

  if (failures.length > 0) throw new Error(`Static production verification failed:\n${JSON.stringify(failures, null, 2)}`);
  console.log(JSON.stringify({ versionValidated: "current", staticHtmlRequests: manifest.htmlRoutes.length * 2, specialChecks: special.length, failures: 0, contentDigest: manifest.contentDigest }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
