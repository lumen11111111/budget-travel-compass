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
    leadStoryEmpty: "No featured travel guide is currently available.",
    noGenreGuides: "No trip-planning guides are currently available.",
    noFeaturedLists: "No travel-inspiration guides are currently available.",
    noPublishedArticles: "No practical travel guides are currently available.",
    noPopularRecommendations: "No featured travel guides are currently available.",
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
