import type React from "react";
import Image from "next/image";
import type { ThemeImage } from "../media/media-types";

export type CategoryHeroProps = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  countLabel?: React.ReactNode;
  image?: ThemeImage;
};

export function CategoryHero({ eyebrow, title, description, countLabel, image }: CategoryHeroProps) {
  return (
    <section className="category-hero">
      <div className="container category-hero-inner">
        <div className="category-hero-copy">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
          {countLabel ? <em>{countLabel}</em> : null}
        </div>
        {image ? (
          <div className="category-hero-media">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority
              unoptimized={image.src.startsWith("/media/") || image.src.startsWith("data:")}
              sizes="(max-width: 900px) 100vw, 46vw"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
