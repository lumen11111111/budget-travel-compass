import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import Link from "next/link";

export interface LegalSection {
  title: string;
  body?: readonly string[];
  items?: readonly string[];
}

const legalNavigation = [
  ["Privacy Policy", "/privacy-policy"], ["Terms of Service", "/terms-of-service"], ["Cookie Policy", "/cookie-policy"],
  ["Editorial Policy", "/editorial-policy"], ["Affiliate Disclosure", "/affiliate-disclosure"], ["Disclaimer", "/disclaimer"],
  ["DMCA / Copyright", "/dmca-copyright"],
] as const;

function renderInlineText(text: string) {
  const pattern = /(https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g;
  const parts = text.split(pattern);

  return parts.map((part) => {
    if (/^https?:\/\//.test(part)) {
      return <a href={part} key={part} rel="noreferrer" target="_blank">{part}</a>;
    }

    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(part)) {
      return <a href={`mailto:${part}`} key={part}>{part}</a>;
    }

    return part;
  });
}

export function LegalPage({
  eyebrow,
  intro,
  sections,
  title,
}: {
  eyebrow: string;
  intro: string;
  sections: readonly LegalSection[];
  title: string;
}) {
  return (
    <main className="site-shell">
      <SiteHeader />
      <div className="container page-narrow legal-page-shell">
        <nav className="btc-legal-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span><span>Legal</span><span aria-hidden="true">/</span><span>{eyebrow}</span>
        </nav>
        <section className="panel newspaper-panel editorial-page legal-document">
          <header className="legal-document-header">
            <span className="eyebrow">Legal</span>
            <h1>{title}</h1>
            <p>{intro}</p>
          </header>
          <nav className="btc-legal-navigation btc-legal-navigation-desktop" aria-label="Legal pages">
            <span>Legal pages</span>
            {legalNavigation.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
          </nav>
          <details className="btc-legal-navigation btc-legal-navigation-mobile">
            <summary>Legal pages</summary>
            <nav aria-label="Legal pages">{legalNavigation.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</nav>
          </details>
          {sections.map((section) => (
            <section className="legal-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.body?.map((paragraph) => <p key={paragraph}>{renderInlineText(paragraph)}</p>)}
              {section.items ? <ul>{section.items.map((item) => <li key={item}>{renderInlineText(item)}</li>)}</ul> : null}
            </section>
          ))}
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
