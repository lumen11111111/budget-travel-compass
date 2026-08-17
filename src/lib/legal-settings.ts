import { legalConfig } from "@/config/legal.config";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { defaultSiteIdentitySettings, type SiteIdentitySettings } from "@/lib/site-identity";

type ReplacementPair = readonly [string, string];

function replaceText(value: string, replacements: ReplacementPair[]) {
  return replacements.reduce((text, [from, to]) => text.split(from).join(to), value);
}

function replaceValue<T>(value: T, replacements: ReplacementPair[]): T {
  if (typeof value === "string") return replaceText(value, replacements) as T;
  if (Array.isArray(value)) return value.map((item) => replaceValue(item, replacements)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceValue(item, replacements)])) as T;
  }
  return value;
}

export function resolveLegalConfig(identity: SiteIdentitySettings) {
  const replacements: ReplacementPair[] = [
    [defaultSiteIdentitySettings.contactEmail, identity.contactEmail],
    [defaultSiteIdentitySettings.operatorName, identity.operatorName],
    [defaultSiteIdentitySettings.operatorCountry, identity.operatorCountry],
    [defaultSiteIdentitySettings.legalStatus, identity.legalStatus],
    [defaultSiteIdentitySettings.siteName, identity.siteName],
  ];

  const pages = replaceValue(legalConfig.pages, replacements);
  const legalEmailReplacements: ReplacementPair[] = [[identity.contactEmail, identity.legalEmail]];

  return {
    identity: {
      siteName: identity.siteName,
      contactEmail: identity.contactEmail,
      supportEmail: identity.supportEmail,
      legalEmail: identity.legalEmail,
      teamName: identity.teamName,
      editorialTeamName: identity.editorialTeamName,
      operatorName: identity.operatorName,
      operatorCountry: identity.operatorCountry,
      legalStatus: identity.legalStatus,
    },
    pages: {
      ...pages,
      privacy: replaceValue(pages.privacy, legalEmailReplacements),
      terms: replaceValue(pages.terms, legalEmailReplacements),
      cookie: replaceValue(pages.cookie, legalEmailReplacements),
      editorial: replaceValue(pages.editorial, legalEmailReplacements),
      affiliate: replaceValue(pages.affiliate, legalEmailReplacements),
      dmca: replaceValue(pages.dmca, legalEmailReplacements),
      disclaimer: replaceValue(pages.disclaimer, legalEmailReplacements),
    },
  };
}

export async function getResolvedLegalConfig() {
  return resolveLegalConfig(await getSiteIdentitySettings());
}
