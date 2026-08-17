"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export type FooterLink = {
  label: string;
  href: string;
};

export type FooterAccordionSectionProps = {
  title: string;
  links: readonly FooterLink[];
  defaultOpen?: boolean;
};

export function FooterAccordionSection({ title, links, defaultOpen = true }: FooterAccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="footer-column">
      <button
        className="footer-accordion-trigger"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {title}
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open ? (
        <div className="footer-links">
          {links.map((link) => (
            <Link href={link.href} key={`${link.href}-${link.label}`}>
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
