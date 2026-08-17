import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { getResolvedLegalConfig } from "@/lib/legal-settings";

export async function generateMetadata(): Promise<Metadata> {
  const { pages } = await getResolvedLegalConfig();
  return {
    title: pages.dmca.metadataTitle,
    description: pages.dmca.metadataDescription,
  };
}

export default async function DmcaCopyrightPage() {
  const { pages } = await getResolvedLegalConfig();
  const page = pages.dmca;

  return (
    <LegalPage
      eyebrow={page.eyebrow}
      title={page.title}
      intro={page.intro}
      sections={page.sections}
    />
  );
}
