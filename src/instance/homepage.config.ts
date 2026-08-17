import { siteConfig } from "@/config/site.config";

export const homepageConfig = {
  seoTitle: siteConfig.defaultSeoTitle,
  seoDescription: siteConfig.defaultSeoDescription,
  hiddenTitle: siteConfig.defaultSeoTitle,
  labels: {
    leadStory: "Featured Guide",
    genreGuides: "Start Planning",
    featuredLists: "Travel Inspiration",
    categoryIndex: "Explore Travel Topics",
    latestNews: "Latest Guides",
    popularRecommendations: "Featured Guides",
    viewAll: "View All Guides",
    leadStoryEmpty: "Featured travel guides are coming soon.",
    noGenreGuides: "Trip planning guides are coming soon.",
    noFeaturedLists: "Travel inspiration is coming soon.",
    noPublishedArticles: "Practical travel guides are coming soon.",
    noPopularRecommendations: "Featured travel guides are coming soon.",
    popularRecommendationsDeck: "Practical ideas for planning affordable independent travel",
  },
  categorySlugs: {
    genreGuides: "trip-planning",
    featuredLists: "inspiration",
    popularRecommendations: "budget-tips",
  },
  limits: {
    featuredLists: 4,
    genreGuides: 3,
    latestNews: 5,
    popularRecommendations: 4,
  },
} as const;
