import Image from "next/image";
import Link from "next/link";
import { budgetTravelArtwork } from "@/instance/brand-assets";

export function InnerPageHero({
  eyebrow,
  title,
  intro,
  image,
  imageAlt,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  image?: string;
  imageAlt?: string;
  compact?: boolean;
}) {
  return (
    <header className={compact ? "btc-inner-hero is-compact" : "btc-inner-hero"}>
      <div className="btc-inner-hero-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {intro ? <p>{intro}</p> : null}
      </div>
      {image ? <Image src={image} alt={imageAlt ?? "Independent travel destination"} width={1586} height={992} sizes="(max-width: 760px) 100vw, 46vw" /> : (
        <Image className="btc-inner-hero-art" src={budgetTravelArtwork.heroCompass} alt="" width={715} height={720} aria-hidden="true" />
      )}
    </header>
  );
}

export function GuidesEmptyState({ search = false }: { search?: boolean }) {
  return (
    <section className="btc-guides-empty">
      <Image src={budgetTravelArtwork.travelNoteSeal} alt="" width={417} height={420} aria-hidden="true" />
      <span className="eyebrow">{search ? "No results" : "Coming soon"}</span>
      <h2>{search ? "No guides found for this route." : "Guides for this route are on the way."}</h2>
      <p>{search ? "Try another search or explore one of our travel topics." : "Explore another travel topic while we prepare this section."}</p>
      <Link className="button" href="/news">Explore travel guides</Link>
    </section>
  );
}
