import Link from "next/link";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { siteConfig } from "@/config/site.config";
import { listCategories } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { budgetTravelArtwork } from "@/instance/brand-assets";

export async function SiteFooter() {
  const [categories, identity] = await Promise.all([listCategories(), getSiteIdentitySettings()]);
  const exploreLinks = categories.length ? categories.map(category => ({ href: `/category/${category.slug}`, label: category.name })) : siteConfig.navigation.primary;

  return (
    <footer className="btc-site-footer">
      <Image className="btc-footer-watermark" src={budgetTravelArtwork.footerCompass} alt="" width={1254} height={1254} unoptimized aria-hidden="true" />
      <div className="btc-footer-grid">
        <section className="btc-footer-brand">
          <Link className="btc-footer-logo" href="/" aria-label={`${identity.siteName} home`}>
            <Image className="btc-brand-mark" src={budgetTravelArtwork.heroCompass} alt="" width={715} height={720} aria-hidden="true" />
            <span>Budget<br />Travel Compass</span>
          </Link>
          <p>{identity.tagline}</p>
        </section>
        <details className="btc-footer-column btc-footer-disclosure">
          <summary>Explore <ChevronDown size={18} aria-hidden="true" /></summary>
          <nav aria-label="Explore">
            {exploreLinks.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
        <details className="btc-footer-column btc-footer-disclosure">
          <summary>About <ChevronDown size={18} aria-hidden="true" /></summary>
          <nav aria-label="About">
            <Link href="/about">About Us</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </details>
        <details className="btc-footer-column btc-footer-legal-links btc-footer-disclosure">
          <summary>Legal <ChevronDown size={18} aria-hidden="true" /></summary>
          <nav aria-label="Legal">
            {siteConfig.navigation.legal.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
      <div className="btc-footer-bottom">
        <span>© {siteConfig.brand.copyrightYear} {identity.siteName}. All rights reserved.</span>
        <span>{identity.legalStatus}</span>
      </div>
    </footer>
  );
}
