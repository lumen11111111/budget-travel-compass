import type { Metadata } from "next";
import { homepageConfig } from "@/config/homepage.config";
import { listLatestPublishedArticles } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { BudgetTravelHomepage } from "@/instance/homepage/budget-travel-homepage";
import { buildHomepageStories } from "@/instance/homepage/preview-data";
import { buildSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return await buildSeoMetadata({
    title: homepageConfig.seoTitle,
    description: homepageConfig.seoDescription,
    path: "/",
  });
}

export default async function HomePage() {
  const [identity, publishedArticles] = await Promise.all([
    getSiteIdentitySettings(),
    listLatestPublishedArticles(7),
  ]);

  return <BudgetTravelHomepage identity={identity} stories={buildHomepageStories(publishedArticles)} />;
}
