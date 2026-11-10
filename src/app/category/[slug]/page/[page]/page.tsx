import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleList } from "@/components/public/article-list";
import { InnerPageHero } from "@/components/public/inner-page";
import { articleCountLabel, Pagination, PaginationSummary } from "@/components/public/pagination";
import { Sidebar } from "@/components/public/sidebar";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { ARTICLE_PAGE_SIZE, getCategoryBySlug, listPaginatedArticlesByCategory } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { categories as categoryFixtures } from "@/db/seed-data";
import { budgetTravelPagePhotography } from "@/instance/brand-assets";
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
  if (!requestedPage) return { title: "Category page not found" };
  const category = (await getCategoryBySlug(slug)) ?? categoryFixtures.find((item) => item.slug === slug && item.enabled) ?? null;
  const articles = await listPaginatedArticlesByCategory(slug, requestedPage, ARTICLE_PAGE_SIZE);
  if (!category || articles.currentPage !== requestedPage) return { title: "Category page not found" };
  const basePath = `/category/${slug}`;

  return {
    ...(await buildSeoMetadata({
      title: `${category.seoTitle ?? category.name} — Page ${requestedPage}`,
      description: category.seoDescription ?? category.description,
      path: paginatedPath(basePath, requestedPage),
    })),
    other: paginationMetadata(basePath, requestedPage, articles.totalPages),
  };
}

export default async function PaginatedCategoryPage({ params }: PageProps) {
  const { slug, page } = await params;
  const requestedPage = parsePage(page);
  if (!requestedPage) notFound();
  const category = (await getCategoryBySlug(slug)) ?? categoryFixtures.find((item) => item.slug === slug && item.enabled) ?? null;
  if (!category) notFound();

  const [articles, identity] = await Promise.all([
    listPaginatedArticlesByCategory(slug, requestedPage, ARTICLE_PAGE_SIZE),
    getSiteIdentitySettings(),
  ]);
  if (articles.currentPage !== requestedPage) notFound();

  return (
    <main className="site-shell">
      <SiteHeader />
      <InnerPageHero eyebrow="Explore" title={category.name} intro={category.description} image={budgetTravelPagePhotography.category} imageAlt="Mediterranean coastal town above a blue bay" />
      <div className="container content-grid">
        <section>
          <div className="section-title" style={{ marginTop: 0 }}>
            <div><span className="eyebrow">Travel collection</span><h2>{articleCountLabel(articles.totalItems)}</h2></div>
          </div>
          <PaginationSummary currentPage={articles.currentPage} pageSize={articles.pageSize} totalItems={articles.totalItems} />
          <ArticleList articles={articles.items} defaultAuthor={identity.defaultAuthor} />
          <Pagination basePath={`/category/${slug}`} currentPage={articles.currentPage} totalPages={articles.totalPages} />
        </section>
        <Sidebar />
      </div>
      <SiteFooter />
    </main>
  );
}
