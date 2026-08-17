import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { getResolvedLegalConfig } from "@/lib/legal-settings";

export async function generateMetadata(): Promise<Metadata> {
  const { pages } = await getResolvedLegalConfig();
  return {
    title: pages.affiliate.metadataTitle,
    description: pages.affiliate.metadataDescription,
  };
}

export default async function AffiliateDisclosurePage() {
  const { pages } = await getResolvedLegalConfig();
  const page = pages.affiliate;

  return (
    <LegalPage
      eyebrow={page.eyebrow}
      title={page.title}
      intro={page.intro}
      sections={page.sections}
    />
  );
}
