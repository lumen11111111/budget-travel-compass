import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleList } from "@/components/public/article-list";
import { articleCountLabel, Pagination, PaginationSummary } from "@/components/public/pagination";
import { SiteFooter } from "@/components/public/site-footer";
import { SearchPanel, SiteHeader } from "@/components/public/site-header";
import { Sidebar } from "@/components/public/sidebar";
import { InnerPageHero } from "@/components/public/inner-page";
import { budgetTravelPagePhotography } from "@/instance/brand-assets";
import { ARTICLE_PAGE_SIZE, getCategoryBySlug, listPaginatedArticlesByCategory } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { buildSeoMetadata, paginatedPath, paginationMetadata } from "@/lib/seo";
import { categories as categoryFixtures } from "@/db/seed-data";

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
  const category = await getCategoryBySlug(slug) ?? categoryFixtures.find(item => item.slug === slug && item.enabled) ?? null;
  const articles = await listPaginatedArticlesByCategory(slug, parsePage(page), ARTICLE_PAGE_SIZE);
  const basePath = `/category/${slug}`;

  return {
    ...(await buildSeoMetadata({
      title: category?.seoTitle ?? category?.name ?? "Category",
      description: category?.seoDescription ?? category?.description,
      path: paginatedPath(basePath, articles.currentPage),
    })),
    other: paginationMetadata(basePath, articles.currentPage, articles.totalPages),
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page } = await searchParams;
  const category = await getCategoryBySlug(slug) ?? categoryFixtures.find(item => item.slug === slug && item.enabled) ?? null;

  if (!category) {
    notFound();
  }

  const [articles, identity] = await Promise.all([
    listPaginatedArticlesByCategory(slug, parsePage(page), ARTICLE_PAGE_SIZE),
    getSiteIdentitySettings(),
  ]);

  return (
    <main className="site-shell">
      <SiteHeader />
      <InnerPageHero eyebrow="Explore" title={category.name} intro={category.description} image={budgetTravelPagePhotography.category} imageAlt="Mediterranean coastal town above a blue bay" />
      <div className="container content-grid">
        <section>
          <div className="section-title" style={{ marginTop: 0 }}>
            <div>
              <span className="eyebrow">Travel collection</span>
              <h2>{articleCountLabel(articles.totalItems)}</h2>
            </div>
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
