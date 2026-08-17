import { siteConfig } from "@/config/site.config";

export interface SiteIdentitySettings {
  siteName: string;
  siteDescription: string;
  tagline: string;
  defaultSeoTitle: string;
  defaultSeoDescription: string;
  contactEmail: string;
  supportEmail: string;
  legalEmail: string;
  teamName: string;
  editorialTeamName: string;
  operatorName: string;
  operatorCountry: string;
  legalStatus: string;
  defaultAuthor: string;
}

export const defaultSiteIdentitySettings: SiteIdentitySettings = {
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

export function mergeSiteIdentitySettings(value: unknown): SiteIdentitySettings {
  if (!value || typeof value !== "object") return defaultSiteIdentitySettings;
  const record = value as Partial<Record<keyof SiteIdentitySettings, unknown>>;

  return {
    siteName: stringValue(record.siteName, defaultSiteIdentitySettings.siteName),
    siteDescription: stringValue(record.siteDescription, defaultSiteIdentitySettings.siteDescription),
    tagline: stringValue(record.tagline, defaultSiteIdentitySettings.tagline),
    defaultSeoTitle: stringValue(record.defaultSeoTitle, defaultSiteIdentitySettings.defaultSeoTitle),
    defaultSeoDescription: stringValue(record.defaultSeoDescription, defaultSiteIdentitySettings.defaultSeoDescription),
    contactEmail: stringValue(record.contactEmail, defaultSiteIdentitySettings.contactEmail),
    supportEmail: stringValue(record.supportEmail, defaultSiteIdentitySettings.supportEmail),
    legalEmail: stringValue(record.legalEmail, defaultSiteIdentitySettings.legalEmail),
    teamName: stringValue(record.teamName, defaultSiteIdentitySettings.teamName),
    editorialTeamName: stringValue(record.editorialTeamName, defaultSiteIdentitySettings.editorialTeamName),
    operatorName: stringValue(record.operatorName, defaultSiteIdentitySettings.operatorName),
    operatorCountry: stringValue(record.operatorCountry, defaultSiteIdentitySettings.operatorCountry),
    legalStatus: stringValue(record.legalStatus, defaultSiteIdentitySettings.legalStatus),
    defaultAuthor: stringValue(record.defaultAuthor, defaultSiteIdentitySettings.defaultAuthor),
  };
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
