import type { Metadata } from "next";
import { SiteFooter } from "@/components/public/site-footer";
import { SearchPanel, SiteHeader } from "@/components/public/site-header";
import { Sidebar } from "@/components/public/sidebar";
import { StaticSearchResults } from "@/components/public/static-search-results";
import { seoConfig } from "@/config/seo.config";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { InnerPageHero } from "@/components/public/inner-page";

export const metadata: Metadata = {
  title: seoConfig.search.title,
  description: seoConfig.search.description,
};

export default async function SearchPage() {
  const identity = await getSiteIdentitySettings();

  return (
    <main className="site-shell">
      <SiteHeader />
      <InnerPageHero compact eyebrow="Search Budget Travel Compass" title="Find your next guide" />
      <SearchPanel />
      <div className="container content-grid">
        <StaticSearchResults defaultAuthor={identity.defaultAuthor} />
        <Sidebar />
      </div>
      <SiteFooter />
    </main>
  );
}
