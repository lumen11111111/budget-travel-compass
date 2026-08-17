export type PreviewArticle = {
  title: string;
  href: string;
  excerpt: string;
  category: { label: string; href: string };
  date: { label: string; dateTime: string };
  readingTime: string;
  author: string;
  image: { src: string; alt: string };
  tags: readonly { label: string; href: string }[];
};

export type PreviewCategory = {
  title: string;
  href: string;
  description: string;
  image: { src: string; alt: string };
};

export const previewBrand = {
  siteName: "Botanical Journal",
  tagline: "Thoughtful guides for modern botanical living.",
  author: "Botanical Journal Editors",
};

export const previewNavigation = [
  { label: "Plant Profiles", href: "/category/plant-profiles" },
  { label: "Botanical Oils", href: "/category/botanical-oils" },
  { label: "Floral Waters", href: "/category/floral-waters" },
  { label: "Everyday Rituals", href: "/category/everyday-rituals" },
  { label: "Guides", href: "/category/guides" },
  { label: "Safety", href: "/category/safety" },
  { label: "Books", href: "/category/books" },
] as const;

export const previewUtilityLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Editorial Policy", href: "/editorial-policy" },
] as const;

export const previewLegalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms", href: "/terms-of-service" },
  { label: "Disclaimer", href: "/disclaimer" },
] as const;

export const previewCategories: PreviewCategory[] = [
  "Plant Profiles",
  "Botanical Oils",
  "Floral Waters",
  "Everyday Rituals",
  "Guides",
  "Safety",
  "Books",
].map((title, index) => ({
  title,
  href: `/category/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  description: `${index + 3} preview guides`,
  image: botanicalImage(`category-${index}`, title),
}));

export const previewArticles: PreviewArticle[] = [
  "A Field Guide to Quiet Botanical Notes",
  "How to Build a Small Seasonal Plant Shelf",
  "Floral Water Routines for Warm Afternoons",
  "Choosing a Neutral Carrier for Daily Care",
  "A Safety Checklist for Concentrated Botanicals",
  "Reference Books for a Home Botanical Library",
  "Simple Ways to Record Plant Observations",
].map((title, index) => ({
  title,
  href: `/news/preview-${index + 1}`,
  excerpt:
    "A neutral preview article summary that demonstrates layout density, line length, metadata rhythm, and card behavior without using production content.",
  category: {
    label: previewCategories[index % previewCategories.length].title,
    href: previewCategories[index % previewCategories.length].href,
  },
  date: { label: `Jun ${12 - index}, 2026`, dateTime: `2026-06-${String(12 - index).padStart(2, "0")}` },
  readingTime: `${6 + index} min read`,
  author: previewBrand.author,
  image: botanicalImage(`article-${index}`, title),
  tags: [
    { label: "Reference", href: "/tag/reference" },
    { label: "Seasonal", href: "/tag/seasonal" },
  ],
}));

export const previewTags = [
  { label: "Reference", href: "/tag/reference" },
  { label: "Safety", href: "/tag/safety" },
  { label: "Routine", href: "/tag/routine" },
  { label: "Ingredients", href: "/tag/ingredients" },
] as const;

export function botanicalImage(seed: string, label: string) {
  const hue = hash(seed);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="hsl(${hue} 28% 84%)"/><path d="M220 650 C340 410 520 340 820 150" fill="none" stroke="hsl(${(hue + 80) % 360} 35% 30%)" stroke-width="18" stroke-linecap="round"/><circle cx="790" cy="190" r="82" fill="hsl(${(hue + 34) % 360} 42% 55%)" opacity=".72"/><circle cx="540" cy="350" r="62" fill="hsl(${(hue + 120) % 360} 34% 48%)" opacity=".64"/><circle cx="340" cy="560" r="74" fill="hsl(${(hue + 160) % 360} 30% 42%)" opacity=".58"/><text x="70" y="735" fill="hsl(${hue} 24% 18%)" font-family="Arial, sans-serif" font-size="42">${escapeText(label)}</text></svg>`;
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    alt: `${label} preview artwork`,
  };
}

function hash(value: string) {
  let next = 0;
  for (const char of value) next = (next * 33 + char.charCodeAt(0)) % 360;
  return next;
}

function escapeText(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
