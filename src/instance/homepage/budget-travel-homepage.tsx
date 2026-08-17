import Image from "next/image";
import Link from "next/link";
import {
  Backpack,
  Compass,
  Map,
  Mountain,
  Plane,
  WalletCards,
} from "lucide-react";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { budgetTravelArtwork } from "@/instance/brand-assets";
import type { SiteIdentitySettings } from "@/lib/site-identity";
import { journeyStripAssets, type HomepageStory } from "./preview-data";

type BudgetTravelHomepageProps = {
  identity: SiteIdentitySettings;
  stories: HomepageStory[];
};

const routeNodes = [
  { label: "Inspiration", slug: "inspiration", icon: Mountain, tone: "teal" },
  { label: "Trip Planning", slug: "trip-planning", icon: Map, tone: "orange" },
  { label: "Flights & Stays", slug: "flights-stays", icon: Plane, tone: "blue" },
  { label: "Budget Tips", slug: "budget-tips", icon: WalletCards, tone: "gold" },
  { label: "Packing & Gear", slug: "packing-gear", icon: Backpack, tone: "green" },
  { label: "Travel Styles", slug: "travel-styles", icon: Compass, tone: "slate" },
] as const;

const smartTips = [
  { label: "Set a real budget", detail: "and stick to it.", artwork: budgetTravelArtwork.utilityIcons.budget },
  { label: "Book early", detail: "travel cheaper.", artwork: budgetTravelArtwork.utilityIcons.calendar },
  { label: "Stay flexible", detail: "save more.", artwork: budgetTravelArtwork.utilityIcons.flexible },
  { label: "Pack light", detail: "travel far.", artwork: budgetTravelArtwork.utilityIcons.packing },
  { label: "Experience more", detail: "spend less.", artwork: budgetTravelArtwork.utilityIcons.experience },
] as const;

export function BudgetTravelHomepage({ identity, stories }: BudgetTravelHomepageProps) {
  const featured = stories.slice(0, 3);
  const latest = stories.slice(3, 7);

  return (
    <main className="btc-home">
      <SiteHeader />
      <section className="btc-hero" aria-labelledby="btc-hero-title">
        <div className="btc-journey-strips" aria-hidden="true">
          {journeyStripAssets.map((src, index) => (
            <div className={`btc-journey-strip btc-strip-${index + 1}`} key={src} tabIndex={-1}>
              <Image
                src={src}
                alt=""
                fill
                priority={index < 3}
                unoptimized
              />
            </div>
          ))}
        </div>
        <div className="btc-hero-copy">
          <Image className="btc-hero-watermark" src={budgetTravelArtwork.heroCompass} alt="" width={1254} height={1254} unoptimized aria-hidden="true" />
          <p className="btc-eyebrow">Practical guides for<br />affordable independent travel</p>
          <h1 id="btc-hero-title">
            <span>Travel further.</span>
            <span className="visually-hidden">Spend smarter.</span>
          </h1>
          <Image
            className="btc-spend-wordmark"
            src="/brand/budget-travel-compass/brand/spend-smarter-wordmark.png"
            alt=""
            aria-hidden="true"
            width={2109}
            height={343}
            priority
            unoptimized
          />
          <span className="btc-route-stroke" aria-hidden="true" />
          <p className="btc-hero-description">
            Practical guides for affordable independent travel. Plan smarter trips, find cheaper flights and stays, pack better,
            and travel with confidence.
          </p>
          <Link className="btc-primary-cta" href="/category/trip-planning">
            Start planning <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <div className="btc-content-shell">
        <section className="btc-route-section" aria-labelledby="btc-route-title">
          <h2 id="btc-route-title">Explore your route</h2>
          <div className="btc-route-map">
            {routeNodes.map(({ label, slug, icon: Icon, tone }) => (
              <Link className={`btc-route-node btc-route-${tone}`} href={`/category/${slug}`} key={slug}>
                <span className="btc-route-icon"><Icon size={25} strokeWidth={1.7} aria-hidden="true" /></span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="btc-section" aria-labelledby="btc-featured-title">
          <SectionHeading id="btc-featured-title" title="Featured journeys" href="/news" linkLabel="View all featured" />
          <div className="btc-featured-grid">
            {featured.map((story, index) => (
              <StoryOverlay story={story} key={story.number} featured={index === 0} />
            ))}
          </div>
        </section>

        <section className="btc-section" aria-labelledby="btc-latest-title">
          <SectionHeading id="btc-latest-title" title="Latest guides" href="/news" linkLabel="View all articles" />
          <div className="btc-journal-feed">
            {latest.slice(0, 3).map((story, index) => <JournalStory story={story} index={index} key={story.number} />)}
            <TravelNote />
            {latest.slice(3).map((story, index) => <JournalStory story={story} index={index + 3} key={story.number} />)}
          </div>
        </section>

        <section className="btc-smart-strip" aria-labelledby="btc-smart-title">
          <div className="btc-smart-heading">
            <Image src={budgetTravelArtwork.paperPlaneRoute} alt="" width={2103} height={748} unoptimized aria-hidden="true" />
            <h2 id="btc-smart-title"><span>Plan smart,</span><span>travel easy</span></h2>
          </div>
          <div className="btc-smart-tips">
            {smartTips.map(({ label, detail, artwork }) => (
              <div className="btc-smart-tip" key={label}>
                <Image className="btc-smart-artwork" src={artwork} alt="" width={220} height={220} aria-hidden="true" />
                <p><strong>{label}</strong><span>{detail}</span></p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="btc-newsletter" aria-labelledby="btc-newsletter-title">
        <Image
          src="/brand/budget-travel-compass/newsletter-mountain-lake.webp"
          alt="Traveler looking across a mountain lake"
          fill
          sizes="100vw"
        />
        <div className="btc-newsletter-overlay" />
        <div className="btc-newsletter-inner">
          <div>
            <h2 id="btc-newsletter-title">More adventures.<br />Better travel.</h2>
            <p>Get practical travel tips and guides straight to your inbox.</p>
          </div>
          <form className="btc-newsletter-form" aria-label="Newsletter preview" onSubmit={undefined}>
            <label className="visually-hidden" htmlFor="btc-newsletter-email">Email address</label>
            <input id="btc-newsletter-email" type="email" placeholder="Your email address" disabled />
            <button type="button" disabled aria-describedby="btc-newsletter-status">Join the journey</button>
          </form>
          <p className="visually-hidden" id="btc-newsletter-status">Newsletter signup is coming soon.</p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function SectionHeading({ id, title, href, linkLabel }: { id: string; title: string; href: string; linkLabel: string }) {
  return (
    <div className="btc-section-heading">
      <h2 id={id}>{title}</h2>
      <Link href={href}>{linkLabel} <span aria-hidden="true">→</span></Link>
    </div>
  );
}

function StoryOverlay({ story, featured }: { story: HomepageStory; featured: boolean }) {
  return (
    <Link className={featured ? "btc-featured-card is-primary" : "btc-featured-card"} href={story.href}>
      <Image src={story.image} alt={story.alt} fill sizes={featured ? "(max-width: 760px) 100vw, 58vw" : "(max-width: 760px) 34vw, 38vw"} unoptimized />
      <span className="btc-photo-shade" />
      <div className="btc-featured-copy">
        <span className="btc-story-number">{story.number}</span>
        <span className="btc-story-meta">{story.category}</span>
        <h3>{story.title}</h3>
        <span className="btc-read-time">◷ {story.readTime}</span>
      </div>
    </Link>
  );
}

function JournalStory({ story, index }: { story: HomepageStory; index: number }) {
  return (
    <article className={`btc-journal-story btc-journal-tone-${index % 4}`}>
      <Link className="btc-journal-image" href={story.href}>
        <Image src={story.image} alt={story.alt} fill sizes="(max-width: 760px) 100vw, 34vw" />
      </Link>
      <div className="btc-journal-copy">
        <span className="btc-journal-number">{story.number}</span>
        <p className="btc-journal-meta">{story.category} <span>•</span> {story.readTime}</p>
        <h3><Link href={story.href}>{story.title}</Link></h3>
        <p>{story.excerpt}</p>
        <Link className="btc-read-link" href={story.href}>Read guide <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}

function TravelNote() {
  return (
    <section className="btc-travel-note-layout" aria-labelledby="btc-note-title">
      <aside className="btc-travel-note-paper">
        <Image className="btc-note-tape" src={budgetTravelArtwork.paperTape} alt="" width={720} height={170} aria-hidden="true" />
        <Image className="btc-note-seal" src={budgetTravelArtwork.travelNoteSeal} alt="" width={417} height={420} aria-hidden="true" />
        <div className="btc-note-copy">
          <h3 id="btc-note-title">The Budget Travel Note</h3>
          <p>A good trip isn&apos;t about spending the least. It&apos;s about spending on what matters.</p>
        </div>
        <div className="btc-note-postal" aria-hidden="true">
          <Image className="btc-note-postcard-stamp" src={budgetTravelArtwork.postcardStamp} alt="" width={420} height={416} />
          <Image className="btc-note-waves" src={budgetTravelArtwork.postmarkWaves} alt="" width={620} height={209} />
        </div>
      </aside>
      <figure className="btc-travel-note-photo">
        <Image className="btc-photo-tape" src={budgetTravelArtwork.paperTape} alt="" width={720} height={170} aria-hidden="true" />
        <div className="btc-travel-note-photo-frame">
          <Image
            src="/brand/budget-travel-compass/featured-solo-mountain-v2.webp"
            alt="Solo traveler overlooking a mountain valley"
            fill
            sizes="(max-width: 760px) 82vw, 36vw"
          />
        </div>
      </figure>
    </section>
  );
}
