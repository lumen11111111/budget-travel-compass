import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleList } from "@/components/public/article-list";
import { Pagination, PaginationSummary } from "@/components/public/pagination";
import { SiteFooter } from "@/components/public/site-footer";
import { SearchPanel, SiteHeader } from "@/components/public/site-header";
import { Sidebar } from "@/components/public/sidebar";
import { InnerPageHero } from "@/components/public/inner-page";
import { ARTICLE_PAGE_SIZE, getTagBySlug, listPaginatedArticlesByTag } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { buildSeoMetadata, paginatedPath, paginationMetadata } from "@/lib/seo";
import { tags as tagFixtures } from "@/db/seed-data";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await searchParams;
  const tag = await getTagBySlug(slug) ?? tagFixtures.find(item => item.slug === slug) ?? null;
  const articles = await listPaginatedArticlesByTag(slug, parsePage(page), ARTICLE_PAGE_SIZE);
  const basePath = `/tag/${slug}`;

  return {
    ...(await buildSeoMetadata({
      title: tag ? `${tag.name} News` : "Tag",
      description: tag?.description,
      path: paginatedPath(basePath, articles.currentPage),
    })),
    other: paginationMetadata(basePath, articles.currentPage, articles.totalPages),
  };
}

export default async function TagPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page } = await searchParams;
  const tag = await getTagBySlug(slug) ?? tagFixtures.find(item => item.slug === slug) ?? null;

  if (!tag) {
    notFound();
  }

  const [articles, identity] = await Promise.all([
    listPaginatedArticlesByTag(slug, parsePage(page), ARTICLE_PAGE_SIZE),
    getSiteIdentitySettings(),
  ]);

  return (
    <main className="site-shell">
      <SiteHeader />
      <InnerPageHero compact eyebrow="Topic" title={tag.name} intro={tag.description} />
      <div className="container content-grid">
        <section>
          <div className="section-title" style={{ marginTop: 0 }}>
            <div>
              <span className="eyebrow">Tag</span>
              <h2>{tag.name}</h2>
              <p>{tag.description}</p>
            </div>
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
