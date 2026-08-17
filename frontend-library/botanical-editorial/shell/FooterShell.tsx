"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

type LinkItem = { label: ReactNode; href: string };

export type FooterShellProps = {
  logo: {
    prefix?: ReactNode;
    suffix: ReactNode;
    href?: string;
  };
  description?: ReactNode;
  categoryLinks?: readonly LinkItem[];
  companyLinks?: readonly LinkItem[];
  legalLinks?: readonly LinkItem[];
  copyright?: ReactNode;
  legalIdentity?: readonly ReactNode[];
};

export function FooterShell({
  logo,
  description,
  categoryLinks = [],
  companyLinks = [],
  legalLinks = [],
  copyright,
  legalIdentity = [],
}: FooterShellProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const groups = [
    { title: "Topics", links: categoryLinks },
    { title: "Site", links: companyLinks },
    { title: "Legal", links: legalLinks },
  ].filter((group) => group.links.length > 0);

  return (
    <footer className="site-footer botanical-site-footer">
      <div className="botanical-footer-inner">
        <div className="botanical-footer-links">
          {groups.map((group) => (
            <section className={openGroup === group.title ? "botanical-footer-group is-open" : "botanical-footer-group"} key={group.title}>
              <button
                type="button"
                aria-expanded={openGroup === group.title}
                onClick={() => setOpenGroup((current) => (current === group.title ? null : group.title))}
              >
                {group.title}
              </button>
              <nav aria-label={`${group.title} footer links`}>
                {group.links.map((link) => (
                  <Link href={link.href} key={`${group.title}-${link.href}`}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </section>
          ))}
        </div>
        <section className="botanical-footer-brand" aria-label={String(logo.suffix)}>
          <h2>
            {logo.prefix}
            {logo.suffix}
          </h2>
          {description ? <p>{description}</p> : null}
        </section>
      </div>
      <div className="botanical-footer-bottom">
        <span>{copyright}</span>
        <div>
          {legalIdentity.map((item, index) => (
            <span key={index}>{item}</span>
          ))}
        </div>
      </div>
    </footer>
  );
}
