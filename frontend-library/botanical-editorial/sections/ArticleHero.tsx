import type React from "react";
import Image from "next/image";
import Link from "next/link";
import type { ThemeImage, ThemeLink } from "../media/media-types";

export type ArticleHeroProps = {
  title: React.ReactNode;
  summary?: React.ReactNode;
  category?: ThemeLink;
  image?: ThemeImage;
  meta?: readonly React.ReactNode[];
  tags?: readonly ThemeLink[];
};

export function ArticleHero({ title, summary, category, image, meta = [], tags = [] }: ArticleHeroProps) {
  return (
    <header className="article-hero">
      <div className="article-hero-content">
        {category ? (
          <Link className="eyebrow" href={category.href}>
            {category.label}
          </Link>
        ) : null}
        <h1 className="article-title">{title}</h1>
        {summary ? <p className="article-summary">{summary}</p> : null}
        {meta.length > 0 ? (
          <div className="article-hero-meta article-meta">
            {meta.map((item, index) => (
              <span key={index}>{item}</span>
            ))}
          </div>
        ) : null}
        {tags.length > 0 ? (
          <div className="tag-row article-tags">
            {tags.map((tag) => (
              <Link className="tag" href={tag.href} key={tag.href}>
                {tag.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      {image ? (
        <div className="article-cover-frame article-cover">
          <Image className="cover" src={image.src} alt={image.alt} width={1280} height={820} priority />
        </div>
      ) : null}
    </header>
  );
}
