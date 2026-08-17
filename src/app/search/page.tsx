import type { Metadata } from "next";
import { ArticleList } from "@/components/public/article-list";
import { SiteFooter } from "@/components/public/site-footer";
import { SearchPanel, SiteHeader } from "@/components/public/site-header";
import { Sidebar } from "@/components/public/sidebar";
import { seoConfig } from "@/config/seo.config";
import { siteConfig } from "@/config/site.config";
import { searchArticles } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { InnerPageHero } from "@/components/public/inner-page";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export const metadata: Metadata = {
  title: seoConfig.search.title,
  description: seoConfig.search.description,
};

export default async function SearchPage({ searchParams }: PageProps) {
  const { q = "" } = await searchParams;
  const [articles, identity] = await Promise.all([searchArticles(q), getSiteIdentitySettings()]);

  return (
    <main className="site-shell">
      <SiteHeader />
      <InnerPageHero compact eyebrow="Search Budget Travel Compass" title="Find your next guide" />
      <SearchPanel defaultValue={q} />
      <div className="container content-grid">
        <section>
          <div className="section-title" style={{ marginTop: 0 }}>
            <div>
              <span className="eyebrow">{seoConfig.search.eyebrow}</span>
              <h2>{q ? `${seoConfig.search.eyebrow}: ${q}` : seoConfig.search.title}</h2>
            </div>
            <span>{articles.length} results</span>
          </div>
          <ArticleList articles={articles} defaultAuthor={identity.defaultAuthor} emptyText={siteConfig.content.searchEmptyText} />
        </section>
        <Sidebar />
      </div>
      <SiteFooter />
    </main>
  );
}
