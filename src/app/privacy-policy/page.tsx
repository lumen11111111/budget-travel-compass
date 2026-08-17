import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { getResolvedLegalConfig } from "@/lib/legal-settings";

export async function generateMetadata(): Promise<Metadata> {
  const { pages } = await getResolvedLegalConfig();
  return {
    title: pages.privacy.metadataTitle,
    description: pages.privacy.metadataDescription,
  };
}

export default async function PrivacyPolicyPage() {
  const { pages } = await getResolvedLegalConfig();
  const page = pages.privacy;

  return (
    <LegalPage
      eyebrow={page.eyebrow}
      title={page.title}
      intro={page.intro}
      sections={page.sections}
    />
  );
}
