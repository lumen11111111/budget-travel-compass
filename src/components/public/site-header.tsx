"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { siteConfig } from "@/config/site.config";
import { budgetTravelArtwork } from "@/instance/brand-assets";
import { siteThemeConfig } from "@/instance/theme.config";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="btc-site-header">
      <Link className="btc-site-logo" href="/" aria-label={`${siteConfig.name} home`}>
        <Image className="btc-brand-mark" src={budgetTravelArtwork.heroCompass} alt="" width={715} height={720} aria-hidden="true" priority />
        <span>Budget<br />Travel Compass</span>
      </Link>
      <nav className="btc-desktop-nav" aria-label="Primary navigation">
        {siteConfig.navigation.primary.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
        <Link className="btc-header-search" href="/search" aria-label={`Search ${siteConfig.name}`}>
          <Search size={21} aria-hidden="true" />
        </Link>
      </nav>
      <div className="btc-mobile-actions">
        <Link className="btc-mobile-icon" href="/search" aria-label={`Search ${siteConfig.name}`}>
          <Search size={21} aria-hidden="true" />
        </Link>
        <button
          className="btc-menu-button"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="btc-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>
      <div
        aria-hidden={!menuOpen}
        className={menuOpen ? "btc-mobile-menu is-open" : "btc-mobile-menu"}
        id="btc-mobile-menu"
        inert={!menuOpen}
      >
        <nav aria-label="Mobile primary navigation">
          {siteConfig.navigation.primary.map((item) => (
            <Link href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          <span className="btc-mobile-menu-divider" />
          <Link href="/about" onClick={() => setMenuOpen(false)}>About Us</Link>
          <Link href="/contact" onClick={() => setMenuOpen(false)}>Contact</Link>
        </nav>
      </div>
    </header>
  );
}

export function SearchPanel({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/search" className={siteThemeConfig.name === "botanical-editorial" ? "search-panel botanical-search-panel" : "search-panel"}>
      <Search color="var(--muted)" size={20} aria-hidden="true" />
      <label className="visually-hidden" htmlFor="site-search-input">
        Search
      </label>
      <input
        id="site-search-input"
        name="q"
        defaultValue={defaultValue}
        placeholder={siteConfig.content.searchPlaceholder}
      />
      <button className="button" type="submit">
        <Search size={17} aria-hidden="true" />
        Search
      </button>
    </form>
  );
}
