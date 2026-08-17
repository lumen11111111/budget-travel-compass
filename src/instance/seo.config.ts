import { siteConfig } from "@/config/site.config";

export const seoConfig = {
  news: {
    title: "Travel Guides",
    description:
      "Browse practical guides for affordable independent travel, including trip planning, flights, stays, budgeting, packing, and travel styles.",
  },
  search: {
    title: "Search Travel Guides",
    eyebrow: "Search",
    description:
      "Search Budget Travel Compass for practical trip planning, budget travel, flights, stays, packing, and independent travel guides.",
  },
  defaults: {
    title: siteConfig.defaultSeoTitle,
    description: siteConfig.defaultSeoDescription,
    shareTitle: siteConfig.social.defaultShareTitle,
    shareDescription: siteConfig.social.defaultShareDescription,
    twitterCard: siteConfig.social.twitterCard,
  },
} as const;
