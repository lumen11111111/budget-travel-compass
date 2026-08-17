import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { InnerPageHero } from "@/components/public/inner-page";
import { getResolvedLegalConfig } from "@/lib/legal-settings";
import { budgetTravelPagePhotography } from "@/instance/brand-assets";

const guideLinks = [
  ["Inspiration", "/category/inspiration"],
  ["Trip Planning", "/category/trip-planning"],
  ["Flights & Stays", "/category/flights-stays"],
  ["Budget Tips", "/category/budget-tips"],
  ["Packing & Gear", "/category/packing-gear"],
  ["Travel Styles", "/category/travel-styles"],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const { pages } = await getResolvedLegalConfig();
  return {
    title: pages.about.metadataTitle,
    description: pages.about.metadataDescription,
  };
}

export default async function AboutPage() {
  const { pages } = await getResolvedLegalConfig();
  const page = pages.about;

  return <main className="site-shell">
    <SiteHeader />
    <InnerPageHero eyebrow={page.eyebrow} title={page.title} intro={page.intro} image={budgetTravelPagePhotography.about} imageAlt="Solo traveler overlooking a mountain valley" />
    <div className="container page-narrow btc-about-sections">
      {page.sections.map((section, index) => (
        <section key={section.title}>
          <span className="eyebrow">{String(index + 1).padStart(2, "0")}</span>
          <h2>{section.title}</h2>
          {"body" in section ? section.body?.map(paragraph => <p key={paragraph}>{paragraph}</p>) : null}
          {"items" in section ? <ul>{section.items?.map(item => <li key={item}>{item}</li>)}</ul> : null}
        </section>
      ))}
      <section className="btc-about-guides">
        <span className="eyebrow">Explore the guides</span>
        <h2>Choose the part of your journey you want to plan next.</h2>
        <div className="btc-about-guide-grid">
          {guideLinks.map(([label, href]) => <Link href={href} key={href}>{label}<span aria-hidden="true">→</span></Link>)}
        </div>
      </section>
    </div>
    <SiteFooter />
  </main>;
}
