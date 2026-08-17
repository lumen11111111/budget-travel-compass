import type React from "react";
import { GlobalPageShell } from "./GlobalPageShell";

export type StaticPageLayoutProps = {
  header: React.ReactNode;
  footer: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  intro?: React.ReactNode;
  sections: readonly {
    title?: React.ReactNode;
    body?: readonly React.ReactNode[];
    items?: readonly React.ReactNode[];
  }[];
};

export function StaticPageLayout({ header, footer, eyebrow, title, intro, sections }: StaticPageLayoutProps) {
  return (
    <GlobalPageShell header={header} footer={footer}>
      <div className="container page-narrow legal-page-shell">
        <section className="panel newspaper-panel editorial-page legal-document">
          <header className="legal-document-header">
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            <h1>{title}</h1>
            {intro ? <p>{intro}</p> : null}
          </header>
          {sections.map((section, index) => (
            <section className="legal-section" key={index}>
              {section.title ? <h2>{section.title}</h2> : null}
              {section.body?.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>{paragraph}</p>
              ))}
              {section.items ? (
                <ul>
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </section>
      </div>
    </GlobalPageShell>
  );
}
