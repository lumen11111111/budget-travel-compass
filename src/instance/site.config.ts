export const siteConfig = {
  name: "Budget Travel Compass",
  domain: "example.com",
  url: "https://example.com",
  tagline: "Practical Guides for Affordable Independent Travel",
  description:
    "Practical budget travel guides for young independent travelers. Plan affordable trips, find cheaper flights and stays, pack smarter, and travel with confidence.",
  defaultSeoTitle: "Budget Travel Compass | Affordable Trip Planning Guides",
  defaultSeoDescription:
    "Practical budget travel guides for young independent travelers. Plan affordable trips, find cheaper flights and stays, pack smarter, and travel with confidence.",
  contactEmail: "budgettravelcompass@gmail.com",
  supportEmail: "budgettravelcompass@gmail.com",
  legalEmail: "budgettravelcompass@gmail.com",
  teamName: "Budget Travel Compass",
  editorialTeamName: "Budget Travel Compass Editorial",
  operator: {
    name: "Budget Travel Compass",
    country: "",
    legalStatus: "Independent Editorial Website",
  },
  brand: {
    logoPrefix: "Budget Travel",
    logoSuffix: "Compass",
    byline: "Budget Travel Compass Editorial",
    copyrightYear: 2026,
  },
  content: {
    articleTypeLabel: "travel guide",
    searchPlaceholder: "Search travel guides, topics, or tags",
    searchEmptyText: "No matching travel guides found. Try another search.",
  },
  social: {
    defaultShareTitle: "Budget Travel Compass | Affordable Trip Planning Guides",
    defaultShareDescription:
      "Practical budget travel guides for young independent travelers. Plan affordable trips, find cheaper flights and stays, pack smarter, and travel with confidence.",
    twitterCard: "summary",
  },
  runtime: {
    allowProductionFallback: false,
  },
  navigation: {
    primary: [
      { href: "/category/inspiration", label: "Inspiration" },
      { href: "/category/trip-planning", label: "Trip Planning" },
      { href: "/category/flights-stays", label: "Flights & Stays" },
      { href: "/category/budget-tips", label: "Budget Tips" },
      { href: "/category/packing-gear", label: "Packing & Gear" },
      { href: "/category/travel-styles", label: "Travel Styles" },
    ],
    footerSite: [
      { href: "/", label: "Home" },
      { href: "/about", label: "About Us" },
      { href: "/contact", label: "Contact Us" },
      { href: "/search", label: "Search" },
    ],
    legal: [
      { href: "/privacy-policy", label: "Privacy Policy" },
      { href: "/terms-of-service", label: "Terms of Service" },
      { href: "/cookie-policy", label: "Cookie Policy" },
      { href: "/editorial-policy", label: "Editorial Policy" },
      { href: "/affiliate-disclosure", label: "Affiliate Disclosure" },
      { href: "/dmca-copyright", label: "DMCA / Copyright" },
      { href: "/disclaimer", label: "Disclaimer" },
    ],
  },
} as const;

export type SiteConfig = typeof siteConfig;
