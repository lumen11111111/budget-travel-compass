import type { Metadata } from "next";
import { ArticleList } from "@/components/public/article-list";
import { Pagination, PaginationSummary } from "@/components/public/pagination";
import { SiteFooter } from "@/components/public/site-footer";
import { SearchPanel, SiteHeader } from "@/components/public/site-header";
import { Sidebar } from "@/components/public/sidebar";
import { InnerPageHero } from "@/components/public/inner-page";
import { homepageConfig } from "@/config/homepage.config";
import { seoConfig } from "@/config/seo.config";
import { ARTICLE_PAGE_SIZE, listPaginatedPublishedArticles } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { buildSeoMetadata, paginatedPath, paginationMetadata } from "@/lib/seo";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { page } = await searchParams;
  const articles = await listPaginatedPublishedArticles(parsePage(page), ARTICLE_PAGE_SIZE);

  return {
    ...(await buildSeoMetadata({
      title: seoConfig.news.title,
      description: seoConfig.news.description,
      path: paginatedPath("/news", articles.currentPage),
    })),
    other: paginationMetadata("/news", articles.currentPage, articles.totalPages),
  };
}

export default async function NewsPage({ searchParams }: PageProps) {
  const { page } = await searchParams;
  const [articles, identity] = await Promise.all([
    listPaginatedPublishedArticles(parsePage(page), ARTICLE_PAGE_SIZE),
    getSiteIdentitySettings(),
  ]);

  return (
    <main className="site-shell">
      <SiteHeader />
      <InnerPageHero compact eyebrow="Travel guides" title="Explore all travel guides" intro="Practical field guides for planning farther and spending smarter." />
      <div className="container content-grid">
        <section>
          <div className="section-title" style={{ marginTop: 0 }}>
            <h2>All Guides</h2>
            <span>{articles.totalItems} published articles</span>
          </div>
          <PaginationSummary currentPage={articles.currentPage} pageSize={articles.pageSize} totalItems={articles.totalItems} />
          <ArticleList articles={articles.items} defaultAuthor={identity.defaultAuthor} />
          <Pagination basePath="/news" currentPage={articles.currentPage} totalPages={articles.totalPages} />
        </section>
        <Sidebar />
      </div>
      <SiteFooter />
    </main>
  );
}
