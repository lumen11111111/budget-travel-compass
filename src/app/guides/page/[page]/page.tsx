import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleList } from "@/components/public/article-list";
import { InnerPageHero } from "@/components/public/inner-page";
import { Pagination, PaginationSummary } from "@/components/public/pagination";
import { Sidebar } from "@/components/public/sidebar";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { seoConfig } from "@/config/seo.config";
import { ARTICLE_PAGE_SIZE, listPaginatedPublishedArticles } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { buildSeoMetadata, paginatedPath, paginationMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ page: string }>;
}

function parsePage(value: string) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 2 ? page : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const requestedPage = parsePage((await params).page);
  if (!requestedPage) return { title: "Travel guides page not found" };
  const articles = await listPaginatedPublishedArticles(requestedPage, ARTICLE_PAGE_SIZE);
  if (articles.currentPage !== requestedPage) return { title: "Travel guides page not found" };

  return {
    ...(await buildSeoMetadata({
      title: `${seoConfig.guides.title} — Page ${requestedPage}`,
      description: seoConfig.guides.description,
      path: paginatedPath("/guides", requestedPage),
    })),
    other: paginationMetadata("/guides", requestedPage, articles.totalPages),
  };
}

export default async function PaginatedGuidesPage({ params }: PageProps) {
  const requestedPage = parsePage((await params).page);
  if (!requestedPage) notFound();

  const [articles, identity] = await Promise.all([
    listPaginatedPublishedArticles(requestedPage, ARTICLE_PAGE_SIZE),
    getSiteIdentitySettings(),
  ]);
  if (articles.currentPage !== requestedPage) notFound();

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
          <Pagination basePath="/guides" currentPage={articles.currentPage} totalPages={articles.totalPages} />
        </section>
        <Sidebar />
      </div>
      <SiteFooter />
    </main>
  );
}
