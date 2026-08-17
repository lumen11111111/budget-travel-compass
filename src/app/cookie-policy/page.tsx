import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { getResolvedLegalConfig } from "@/lib/legal-settings";

export async function generateMetadata(): Promise<Metadata> {
  const { pages } = await getResolvedLegalConfig();
  return {
    title: pages.cookie.metadataTitle,
    description: pages.cookie.metadataDescription,
  };
}

export default async function CookiePolicyPage() {
  const { pages } = await getResolvedLegalConfig();
  const page = pages.cookie;

  return (
    <LegalPage
      eyebrow={page.eyebrow}
      title={page.title}
      intro={page.intro}
      sections={page.sections}
    />
  );
}
