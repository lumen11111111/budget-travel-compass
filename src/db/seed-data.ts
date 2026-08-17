import { siteConfig } from "@/config/site.config";
import { homepageConfig } from "@/config/homepage.config";

export type ArticleStatus = "draft" | "published" | "archived";

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  enabled: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  enabled: boolean;
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  summary: string;
  bodyHtml: string;
  coverUrl: string;
  categoryId: number;
  tagIds: number[];
  status: ArticleStatus;
  isFeatured: boolean;
  isPinned: boolean;
  sortOrder?: number;
  viewCount: number;
  publishedAt: string;
  updatedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface HomepageBlock {
  id: number;
  key: string;
  title: string;
  blockType: "lead" | "heat" | "category_shortcuts" | "feed" | "tags" | "topics" | "editor_picks";
  enabled: boolean;
  sortOrder: number;
  displayCount: number;
  config: Record<string, unknown>;
}

export const categories: Category[] = [
  {
    id: 1,
    name: "Inspiration",
    slug: "inspiration",
    description: "Ideas and perspectives for affordable independent travel.",
    sortOrder: 1,
    enabled: true,
    seoTitle: "Travel Inspiration",
    seoDescription: "Explore ideas and perspectives for affordable independent travel.",
  },
  {
    id: 2,
    name: "Trip Planning",
    slug: "trip-planning",
    description: "Practical guidance for organizing an affordable independent trip.",
    sortOrder: 2,
    enabled: true,
    seoTitle: "Trip Planning Guides",
    seoDescription: "Browse practical guidance for planning affordable independent trips.",
  },
  {
    id: 3,
    name: "Flights & Stays",
    slug: "flights-stays",
    description: "General guidance for comparing transportation and accommodation options.",
    sortOrder: 3,
    enabled: true,
    seoTitle: "Flights and Stays Guides",
    seoDescription: "Browse general guidance for comparing flights, transportation, and stays.",
  },
  {
    id: 4,
    name: "Budget Tips",
    slug: "budget-tips",
    description: "Practical ways to plan spending and make travel budgets go further.",
    sortOrder: 4,
    enabled: true,
    seoTitle: "Budget Travel Tips",
    seoDescription: "Explore practical ways to plan spending for affordable independent travel.",
  },
  {
    id: 5,
    name: "Packing & Gear",
    slug: "packing-gear",
    description: "Guidance for packing thoughtfully and choosing useful travel gear.",
    sortOrder: 5,
    enabled: true,
    seoTitle: "Packing and Travel Gear",
    seoDescription: "Browse practical guidance for packing and choosing useful travel gear.",
  },
  {
    id: 6,
    name: "Travel Styles",
    slug: "travel-styles",
    description: "Approaches to independent travel for different needs and priorities.",
    sortOrder: 6,
    enabled: true,
    seoTitle: "Independent Travel Styles",
    seoDescription: "Explore different approaches to affordable independent travel.",
  },
];

export const tags: Tag[] = [
  { id: 1, name: "Planning", slug: "planning", description: "Disabled placeholder tag retained for CMS testing.", sortOrder: 1, enabled: false },
  { id: 2, name: "How To", slug: "how-to", description: "Disabled placeholder tag retained for CMS testing.", sortOrder: 2, enabled: false },
  { id: 3, name: "Checklist", slug: "checklist", description: "Disabled placeholder tag retained for CMS testing.", sortOrder: 3, enabled: false },
  { id: 4, name: "Comparison", slug: "comparison", description: "Disabled placeholder tag retained for CMS testing.", sortOrder: 4, enabled: false },
  { id: 5, name: "Reference", slug: "reference", description: "Disabled placeholder tag retained for CMS testing.", sortOrder: 5, enabled: false },
  { id: 6, name: "Example", slug: "example", description: "Disabled placeholder tag retained for CMS testing.", sortOrder: 6, enabled: false },
];

export const articles: Article[] = [
  {
    id: 1,
    title: "Placeholder: Inspiration Article",
    slug: "placeholder-inspiration-article",
    summary: "Draft placeholder retained for CMS and layout testing. This is not published travel guidance.",
    bodyHtml: "<p>This draft placeholder is retained for CMS and layout testing. Replace it during the formal content import phase.</p>",
    coverUrl: "",
    categoryId: 1,
    tagIds: [1, 4],
    status: "draft",
    isFeatured: false,
    isPinned: false,
    viewCount: 0,
    publishedAt: "",
  },
  {
    id: 2,
    title: "Placeholder: Trip Planning Article",
    slug: "placeholder-trip-planning-article",
    summary: "Draft placeholder retained for CMS and layout testing. This is not published travel guidance.",
    bodyHtml: "<p>This draft placeholder is retained for CMS and layout testing. Replace it during the formal content import phase.</p>",
    coverUrl: "",
    categoryId: 2,
    tagIds: [2, 5],
    status: "draft",
    isFeatured: false,
    isPinned: false,
    viewCount: 0,
    publishedAt: "",
  },
  {
    id: 3,
    title: "Placeholder: Flights and Stays Article",
    slug: "placeholder-flights-stays-article",
    summary: "Draft placeholder retained for CMS and layout testing. This is not published travel guidance.",
    bodyHtml: "<p>This draft placeholder is retained for CMS and layout testing. Replace it during the formal content import phase.</p>",
    coverUrl: "",
    categoryId: 3,
    tagIds: [1, 6],
    status: "draft",
    isFeatured: false,
    isPinned: false,
    viewCount: 0,
    publishedAt: "",
  },
  {
    id: 4,
    title: "Placeholder: Budget Tips Article",
    slug: "placeholder-budget-tips-article",
    summary: "Draft placeholder retained for CMS and layout testing. This is not published travel guidance.",
    bodyHtml: "<p>This draft placeholder is retained for CMS and layout testing. Replace it during the formal content import phase.</p>",
    coverUrl: "",
    categoryId: 4,
    tagIds: [3, 5, 6],
    status: "draft",
    isFeatured: false,
    isPinned: false,
    viewCount: 0,
    publishedAt: "",
  },
  {
    id: 5,
    title: "Placeholder: Packing and Gear Article",
    slug: "placeholder-packing-gear-article",
    summary: "Draft placeholder retained for CMS and layout testing. This is not published travel guidance.",
    bodyHtml: "<p>This draft placeholder is retained for CMS and layout testing. Replace it during the formal content import phase.</p>",
    coverUrl: "",
    categoryId: 5,
    tagIds: [4, 5],
    status: "draft",
    isFeatured: false,
    isPinned: false,
    viewCount: 0,
    publishedAt: "",
  },
  {
    id: 6,
    title: "Placeholder: Travel Styles Article",
    slug: "placeholder-travel-styles-article",
    summary: "Draft placeholder retained for CMS and layout testing. This is not published travel guidance.",
    bodyHtml: "<p>This draft placeholder is retained for CMS and layout testing. Replace it during the formal content import phase.</p>",
    coverUrl: "",
    categoryId: 6,
    tagIds: [1],
    status: "draft",
    isFeatured: false,
    isPinned: false,
    viewCount: 0,
    publishedAt: "",
  },
];

export const homepageBlocks: HomepageBlock[] = [
  { id: 1, key: "lead", title: homepageConfig.labels.leadStory, blockType: "lead", enabled: true, sortOrder: 1, displayCount: 1, config: {} },
  { id: 2, key: "heat", title: homepageConfig.labels.featuredLists, blockType: "heat", enabled: true, sortOrder: 2, displayCount: 4, config: {} },
  {
    id: 3,
    key: "category-shortcuts",
    title: homepageConfig.labels.categoryIndex,
    blockType: "category_shortcuts",
    enabled: true,
    sortOrder: 3,
    displayCount: 6,
    config: {},
  },
  {
    id: 4,
    key: "feed",
    title: homepageConfig.labels.popularRecommendations,
    blockType: "feed",
    enabled: true,
    sortOrder: 4,
    displayCount: 4,
    config: {},
  },
  { id: 5, key: "tags", title: homepageConfig.labels.genreGuides, blockType: "tags", enabled: true, sortOrder: 5, displayCount: 3, config: {} },
  {
    id: 6,
    key: "editor-picks",
    title: homepageConfig.labels.latestNews,
    blockType: "editor_picks",
    enabled: true,
    sortOrder: 6,
    displayCount: 4,
    config: {},
  },
];

export const siteSettings = {
  siteName: siteConfig.name,
  siteDescription: siteConfig.description,
  tagline: siteConfig.tagline,
  defaultSeoTitle: siteConfig.defaultSeoTitle,
  defaultSeoDescription: siteConfig.defaultSeoDescription,
  contactEmail: siteConfig.contactEmail,
  supportEmail: siteConfig.supportEmail,
  legalEmail: siteConfig.legalEmail,
  teamName: siteConfig.teamName,
  editorialTeamName: siteConfig.editorialTeamName,
  operatorName: siteConfig.operator.name,
  operatorCountry: siteConfig.operator.country,
  legalStatus: siteConfig.operator.legalStatus,
  defaultAuthor: siteConfig.brand.byline,
};
