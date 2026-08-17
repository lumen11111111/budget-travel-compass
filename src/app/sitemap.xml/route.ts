import { listSitemapContent } from "@/db/repositories/content";
import { buildSitemapXml, createSitemapResponse } from "@/lib/sitemap-runtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function buildRuntimeSitemapResponse(includeBody: boolean): Promise<Response> {
  const content = await listSitemapContent();
  const xml = buildSitemapXml(content);
  return createSitemapResponse(xml, includeBody);
}

export async function GET() {
  return buildRuntimeSitemapResponse(true);
}

export async function HEAD() {
  return buildRuntimeSitemapResponse(false);
}
