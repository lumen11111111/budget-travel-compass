import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { getResolvedLegalConfig } from "@/lib/legal-settings";

export async function generateMetadata(): Promise<Metadata> {
  const { pages } = await getResolvedLegalConfig();
  return {
    title: pages.disclaimer.metadataTitle,
    description: pages.disclaimer.metadataDescription,
  };
}

export default async function DisclaimerPage() {
  const { pages } = await getResolvedLegalConfig();
  const page = pages.disclaimer;

  return (
    <LegalPage
      eyebrow={page.eyebrow}
      title={page.title}
      intro={page.intro}
      sections={page.sections}
    />
  );
}
