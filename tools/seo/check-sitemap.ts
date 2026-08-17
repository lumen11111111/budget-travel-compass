import { fileURLToPath } from "node:url";

const googlebotUserAgent = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

type SitemapProbe = {
  label: string;
  method: "GET" | "HEAD";
  headers?: HeadersInit;
};

export type SitemapCheckResult = {
  ok: boolean;
  url: string;
  issues: string[];
  details: string[];
};

const probes: SitemapProbe[] = [
  { label: "HEAD", method: "HEAD" },
  { label: "GET", method: "GET" },
  { label: "Googlebot HEAD", method: "HEAD", headers: { "User-Agent": googlebotUserAgent } },
  { label: "Googlebot GET", method: "GET", headers: { "User-Agent": googlebotUserAgent } },
  { label: "Googlebot GET with Accept-Encoding", method: "GET", headers: { "User-Agent": googlebotUserAgent, "Accept-Encoding": "gzip, deflate, br" } },
  { label: "Googlebot GET with Range", method: "GET", headers: { "User-Agent": googlebotUserAgent, Range: "bytes=0-1023" } },
];

export async function checkSitemapUrl(url: string): Promise<SitemapCheckResult> {
  const issues: string[] = [];
  const details: string[] = [];
  const responses = new Map<string, { status: number; headers: Headers; body: Uint8Array }>();

  for (const probe of probes) {
    const response = await fetch(url, {
      method: probe.method,
      headers: probe.headers,
      redirect: "follow",
    });
    const body = new Uint8Array(await response.arrayBuffer());
    responses.set(probe.label, { status: response.status, headers: response.headers, body });
    details.push(`${probe.label}: ${response.status}, length=${response.headers.get("content-length") ?? "missing"}, transfer=${response.headers.get("transfer-encoding") ?? "none"}`);
  }

  const get = responses.get("GET");
  const head = responses.get("HEAD");
  if (!get || !head) {
    issues.push("Missing baseline GET or HEAD response.");
    return { ok: false, url, issues, details };
  }

  for (const [label, response] of responses) {
    if (response.status !== 200) issues.push(`${label} returned ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/xml")) issues.push(`${label} Content-Type is not application/xml.`);
    const contentLength = Number(response.headers.get("content-length"));
    if (!Number.isFinite(contentLength) || contentLength <= 0) issues.push(`${label} Content-Length is missing or invalid.`);
    if ((response.headers.get("transfer-encoding") ?? "").toLowerCase().includes("chunked")) issues.push(`${label} uses Transfer-Encoding: chunked.`);
    if (response.headers.get("content-encoding") && response.headers.get("content-encoding") !== "identity") issues.push(`${label} is compressed instead of identity.`);
    if (response.body.byteLength > 0 && response.body.byteLength !== contentLength) issues.push(`${label} body length does not match Content-Length.`);
  }

  const getLength = get.headers.get("content-length");
  const headLength = head.headers.get("content-length");
  if (!getLength || getLength !== headLength) issues.push("HEAD Content-Length does not match GET Content-Length.");
  if (head.body.byteLength !== 0) issues.push("HEAD returned a response body.");

  const xml = new TextDecoder().decode(get.body);
  if (!/<urlset[\s>]/i.test(xml) || !/<loc>[^<]+<\/loc>/i.test(xml)) issues.push("XML is not a sitemap urlset with loc entries.");
  if (!xml.includes("<loc>")) issues.push("Sitemap has no homepage URL entry.");
  if (/workers\.dev/i.test(xml)) issues.push("Sitemap contains workers.dev.");
  if (/example\.com/i.test(xml) && !/https:\/\/example\.com\/sitemap\.xml$/i.test(url)) issues.push("Sitemap contains example.com.");
  if (/https:\/\/www\./i.test(xml)) issues.push("Sitemap contains www canonical URLs.");

  return { ok: issues.length === 0, url, issues, details };
}

function parseArgs(args: string[]) {
  const urlArg = args.find((arg) => arg.startsWith("--url="));
  return { url: urlArg?.slice("--url=".length).trim() ?? "" };
}

async function cli() {
  const { url } = parseArgs(process.argv.slice(2));
  if (!url) {
    console.error("Usage: npm run seo:sitemap-check -- --url=https://example.com/sitemap.xml");
    process.exitCode = 2;
    return;
  }

  const result = await checkSitemapUrl(url);
  console.log(`Sitemap check: ${result.ok ? "passed" : "failed"}`);
  console.log(`URL: ${result.url}`);
  for (const detail of result.details) console.log(`- ${detail}`);
  for (const issue of result.issues) console.error(`FAIL ${issue}`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  cli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
