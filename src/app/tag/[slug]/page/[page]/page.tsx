import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleList } from "@/components/public/article-list";
import { InnerPageHero } from "@/components/public/inner-page";
import { Pagination, PaginationSummary } from "@/components/public/pagination";
import { Sidebar } from "@/components/public/sidebar";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { ARTICLE_PAGE_SIZE, getTagBySlug, listPaginatedArticlesByTag } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { tags as tagFixtures } from "@/db/seed-data";
import { buildSeoMetadata, paginatedPath, paginationMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string; page: string }>;
}

function parsePage(value: string) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 2 ? page : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, page } = await params;
  const requestedPage = parsePage(page);
  if (!requestedPage) return { title: "Tag page not found" };
  const tag = (await getTagBySlug(slug)) ?? tagFixtures.find((item) => item.slug === slug && item.enabled) ?? null;
  const articles = await listPaginatedArticlesByTag(slug, requestedPage, ARTICLE_PAGE_SIZE);
  if (!tag || articles.currentPage !== requestedPage) return { title: "Tag page not found" };
  const basePath = `/tag/${slug}`;

  return {
    ...(await buildSeoMetadata({
      title: `${tag.name} — Page ${requestedPage}`,
      description: tag.description,
      path: paginatedPath(basePath, requestedPage),
    })),
    other: paginationMetadata(basePath, requestedPage, articles.totalPages),
  };
}

export default async function PaginatedTagPage({ params }: PageProps) {
  const { slug, page } = await params;
  const requestedPage = parsePage(page);
  if (!requestedPage) notFound();
  const tag = (await getTagBySlug(slug)) ?? tagFixtures.find((item) => item.slug === slug && item.enabled) ?? null;
  if (!tag) notFound();

  const [articles, identity] = await Promise.all([
    listPaginatedArticlesByTag(slug, requestedPage, ARTICLE_PAGE_SIZE),
    getSiteIdentitySettings(),
  ]);
  if (articles.currentPage !== requestedPage) notFound();

  return (
    <main className="site-shell">
      <SiteHeader />
      <InnerPageHero compact eyebrow="Topic" title={tag.name} intro={tag.description} />
      <div className="container content-grid">
        <section>
          <div className="section-title" style={{ marginTop: 0 }}>
            <div><span className="eyebrow">Tag</span><h2>{tag.name}</h2><p>{tag.description}</p></div>
            <span>{articles.totalItems} articles</span>
          </div>
          <PaginationSummary currentPage={articles.currentPage} pageSize={articles.pageSize} totalItems={articles.totalItems} />
          <ArticleList articles={articles.items} defaultAuthor={identity.defaultAuthor} />
          <Pagination basePath={`/tag/${slug}`} currentPage={articles.currentPage} totalPages={articles.totalPages} />
        </section>
        <Sidebar />
      </div>
      <SiteFooter />
    </main>
  );
}
