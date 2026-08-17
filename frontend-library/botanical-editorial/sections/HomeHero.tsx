import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ThemeImage, ThemeLink } from "../media/media-types";

export type HomeHeroProps = {
  image: ThemeImage;
  label?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  cta?: ThemeLink;
  header?: React.ReactNode;
};

export function HomeHero({ image, label, title, subtitle, cta, header }: HomeHeroProps) {
  return (
    <section className="home-hero">
      <Image className="home-hero-image" src={image.src} alt={image.alt} fill priority sizes="100vw" />
      <span className="home-hero-shade" aria-hidden="true" />
      {header}
      <div className="home-hero-copy">
        {label ? <p>{label}</p> : null}
        <h1>{title}</h1>
        {subtitle ? <span>{subtitle}</span> : null}
        {cta ? (
          <Link className="button" href={cta.href}>
            {cta.label}
            <ChevronRight size={17} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
