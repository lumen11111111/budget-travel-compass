import { listPublishedArticles } from "@/db/repositories/content";
import { toStaticSearchArticle } from "@/lib/static-search";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const articles = await listPublishedArticles();
  return Response.json(articles.map(toStaticSearchArticle), {
    headers: { "Cache-Control": "public, max-age=0, must-revalidate, no-transform" },
  });
}
