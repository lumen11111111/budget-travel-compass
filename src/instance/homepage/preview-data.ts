import type { ArticleView } from "@/db/repositories/content";

export type HomepageStory = {
  number: string;
  title: string;
  excerpt: string;
  category: string;
  categorySlug: string;
  readTime: string;
  image: string;
  alt: string;
  href: string;
  source: "published" | "preview";
};

export const journeyStripAssets = [
  "/brand/budget-travel-compass/journey-alpine-lake-v2.webp",
  "/brand/budget-travel-compass/journey-mediterranean-coast-v2.webp",
  "/brand/budget-travel-compass/journey-asian-city-night-v2.webp",
  "/brand/budget-travel-compass/journey-desert-canyon-v2.webp",
  "/brand/budget-travel-compass/journey-forest-lake-v2.webp",
  "/brand/budget-travel-compass/journey-historic-street-v2.webp",
] as const;

const previewStories: HomepageStory[] = [
  {
    number: "01",
    title: "How to Plan an Affordable European Adventure",
    excerpt: "Build a flexible route, choose the right bases, and leave room for the moments that make a trip memorable.",
    category: "Trip Planning",
    categorySlug: "trip-planning",
    readTime: "10 min read",
    image: "/brand/budget-travel-compass/featured-coastal-town-v2.webp",
    alt: "Cliffside town overlooking a blue Mediterranean bay",
    href: "/category/trip-planning",
    source: "preview",
  },
  {
    number: "02",
    title: "12 Ways to Travel More for Less",
    excerpt: "Make room in the budget for the experiences that matter most.",
    category: "Budget Tips",
    categorySlug: "budget-tips",
    readTime: "8 min read",
    image: "/brand/budget-travel-compass/featured-local-market-v2.webp",
    alt: "Independent traveler walking through a lively local market",
    href: "/category/budget-tips",
    source: "preview",
  },
  {
    number: "03",
    title: "Solo Travel: Embrace Freedom and Discover You",
    excerpt: "Plan confidently while leaving space for discovery.",
    category: "Inspiration",
    categorySlug: "inspiration",
    readTime: "7 min read",
    image: "/brand/budget-travel-compass/featured-solo-mountain-v2.webp",
    alt: "Solo traveler looking across a mountain valley",
    href: "/category/inspiration",
    source: "preview",
  },
  {
    number: "04",
    title: "How to Find Cheap Flights Without the Stress",
    excerpt: "Use flexible dates, sensible alerts, and a clear booking window to compare routes without chasing every price change.",
    category: "Flights & Stays",
    categorySlug: "flights-stays",
    readTime: "7 min read",
    image: "/brand/budget-travel-compass/latest-tropical-coast.webp",
    alt: "Tropical coastline seen from a quiet hillside path",
    href: "/category/flights-stays",
    source: "preview",
  },
  {
    number: "05",
    title: "The Ultimate Carry-On Packing List",
    excerpt: "Pack light, keep the essentials close, and make every item earn its place in your bag.",
    category: "Packing & Gear",
    categorySlug: "packing-gear",
    readTime: "6 min read",
    image: "/brand/budget-travel-compass/latest-carry-on.webp",
    alt: "Open carry-on bag with practical travel essentials",
    href: "/category/packing-gear",
    source: "preview",
  },
  {
    number: "06",
    title: "Slow Travel on a Budget: Savor the Journey",
    excerpt: "Stay longer, connect deeper, and trade a rushed checklist for a more rewarding rhythm.",
    category: "Travel Styles",
    categorySlug: "travel-styles",
    readTime: "6 min read",
    image: "/brand/budget-travel-compass/latest-city-street.webp",
    alt: "Travelers walking along an atmospheric city street",
    href: "/category/travel-styles",
    source: "preview",
  },
  {
    number: "07",
    title: "Weekend Getaways That Won't Break the Bank",
    excerpt: "Choose a close-to-home route, set one meaningful priority, and keep the rest of the plan simple.",
    category: "Inspiration",
    categorySlug: "inspiration",
    readTime: "6 min read",
    image: "/brand/budget-travel-compass/latest-road-trip.webp",
    alt: "Small camper van parked beside a mountain lake",
    href: "/category/inspiration",
    source: "preview",
  },
];

export function buildHomepageStories(published: ArticleView[]): HomepageStory[] {
  return previewStories.map((preview, index) => {
    const article = published[index];
    if (!article) return preview;

    return {
      number: String(index + 1).padStart(2, "0"),
      title: article.title,
      excerpt: article.summary,
      category: article.category.name,
      categorySlug: article.category.slug,
      readTime: readingTime(article.bodyHtml),
      image: article.coverUrl || preview.image,
      alt: article.title,
      href: `/news/${article.slug}`,
      source: "published",
    };
  });
}

function readingTime(bodyHtml: string) {
  const wordCount = bodyHtml.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(wordCount / 220))} min read`;
}
