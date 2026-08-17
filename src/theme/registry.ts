import type { ThemeRegistry } from "./types";
import { siteThemeDefinition } from "@/instance/theme.definition";

const builtInThemeRegistry: ThemeRegistry = {
  homerio: {
    name: "Homerio",
    displayName: "Homerio",
    description: "Home and living editorial magazine theme.",
    version: "homerio-theme-v1",
    package: "@contentforge/theme-homerio",
    type: "frontend-theme",
    libraryPath: "frontend-library/homerio",
    capabilities: [
      "home-living",
      "article-cards",
      "category-cards",
      "homepage-layouts",
      "pagination",
      "theme-tokens",
      "component-styles",
    ],
  },
  mocktailmuse: {
    name: "MocktailMuse",
    displayName: "MocktailMuse",
    description: "Alcohol-free drink editorial theme for recipes, guides, and lifestyle content.",
    version: "mocktailmuse-theme-v1",
    package: "@contentforge/theme-mocktailmuse",
    type: "frontend-theme",
    libraryPath: "frontend-library/mocktailmuse",
    capabilities: [
      "alcohol-free-drink-editorial",
      "homepage-layouts",
      "article-layouts",
      "category-layouts",
      "search-layouts",
      "static-page-layouts",
      "theme-tokens",
      "component-styles",
      "theme-assets",
      "theme-preview",
    ],
  },
  "botanical-editorial": {
    name: "BotanicalEditorial",
    displayName: "Botanical Editorial",
    description:
      "Complete premium botanical editorial website theme for education, lifestyle, ingredient, wellness, and reference content sites.",
    version: "botanical-editorial-theme-v1",
    package: "@contentforge/theme-botanical-editorial",
    type: "frontend-theme",
    libraryPath: "frontend-library/botanical-editorial",
    capabilities: [
      "botanical-editorial",
      "full-site-layouts",
      "homepage-layouts",
      "article-layouts",
      "category-layouts",
      "search-layouts",
      "static-page-layouts",
      "contact-layouts",
      "legal-layouts",
      "not-found-layouts",
      "mobile-header",
      "footer-accordion",
      "theme-tokens",
      "component-styles",
      "theme-preview",
    ],
  },
  "wellness-editorial": {
    name: "WellnessEditorial",
    displayName: "Wellness Editorial",
    description:
      "A complete calm health and wellness editorial theme for educational lifestyle, wellbeing, nutrition, sleep, mental wellness, movement, and reference content websites.",
    version: "wellness-editorial-theme-v1",
    package: "@contentforge/theme-wellness-editorial",
    type: "frontend-theme",
    libraryPath: "frontend-library/wellness-editorial",
    capabilities: [
      "wellness-editorial",
      "full-site-layouts",
      "homepage-layouts",
      "article-layouts",
      "category-layouts",
      "search-layouts",
      "static-page-layouts",
      "contact-layouts",
      "legal-layouts",
      "not-found-layouts",
      "mobile-header",
      "footer-accordion",
      "theme-tokens",
      "component-styles",
      "theme-preview",
    ],
  },
  // Future themes:
  // recipe
  // magazine
  // minimal
};

export const themeRegistry: ThemeRegistry = siteThemeDefinition
  ? {
      ...builtInThemeRegistry,
      [siteThemeDefinition.libraryPath.replace(/^frontend-library\//, "") || siteThemeDefinition.package]: siteThemeDefinition,
    }
  : builtInThemeRegistry;

export type RegisteredThemeName = keyof typeof themeRegistry;
