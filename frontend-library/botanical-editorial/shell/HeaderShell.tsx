"use client";

import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { useState, type ReactNode } from "react";

export type HeaderShellProps = {
  logo: {
    prefix?: ReactNode;
    suffix: ReactNode;
    href?: string;
  };
  primaryNavigation: readonly { label: ReactNode; href: string }[];
  utilityLinks?: readonly { label: ReactNode; href: string }[];
  searchHref?: string;
  searchLabel?: ReactNode;
};

export function HeaderShell({
  logo,
  primaryNavigation,
  searchHref = "/search",
  searchLabel = "Search",
}: HeaderShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const logoText = `${logo.prefix ?? ""}${logo.suffix}`;

  return (
    <header className="site-header botanical-site-header">
      <Link className="site-logo botanical-site-logo" href={logo.href ?? "/"} aria-label={`${logoText} home`}>
        {logo.prefix ? <span>{logo.prefix}</span> : null}
        {logo.suffix}
      </Link>
      <nav className="nav-links botanical-desktop-nav" aria-label="Primary navigation">
        {primaryNavigation.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
        <Link className="botanical-search-icon" href={searchHref} aria-label={String(searchLabel)}>
          <Search size={18} aria-hidden="true" />
        </Link>
      </nav>
      <div className="botanical-mobile-actions">
        <Link className="botanical-icon-link" href={searchHref} aria-label={String(searchLabel)}>
          <Search size={21} aria-hidden="true" />
        </Link>
        <button
          className="botanical-menu-button"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="botanical-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>
      <div className={menuOpen ? "botanical-mobile-menu is-open" : "botanical-mobile-menu"} id="botanical-mobile-menu">
        <nav aria-label="Mobile primary navigation">
          {primaryNavigation.map((item) => (
            <Link href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
