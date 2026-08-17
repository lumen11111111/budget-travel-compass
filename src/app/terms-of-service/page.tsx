import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { getResolvedLegalConfig } from "@/lib/legal-settings";

export async function generateMetadata(): Promise<Metadata> {
  const { pages } = await getResolvedLegalConfig();
  return {
    title: pages.terms.metadataTitle,
    description: pages.terms.metadataDescription,
  };
}

export default async function TermsOfServicePage() {
  const { pages } = await getResolvedLegalConfig();
  const page = pages.terms;

  return (
    <LegalPage
      eyebrow={page.eyebrow}
      title={page.title}
      intro={page.intro}
      sections={page.sections}
    />
  );
}
