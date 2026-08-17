import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ThemeImage, ThemeLink } from "../media/media-types";

export type EditorialArticleCardProps = {
  title: ReactNode;
  href: string;
  excerpt?: ReactNode;
  image?: ThemeImage;
  category?: ThemeLink;
  date?: { label: string; dateTime?: string };
  readingTime?: string;
  author?: ReactNode;
  titleLevel?: "h2" | "h3";
  variant?: "standard" | "feature" | "compact";
  priorityImage?: boolean;
};

export function EditorialArticleCard({
  title,
  href,
  excerpt,
  image,
  category,
  date,
  readingTime,
  author,
  titleLevel = "h2",
  variant = "standard",
  priorityImage = false,
}: EditorialArticleCardProps) {
  const TitleTag = titleLevel;
  const mediaImage = image ? (
    <Image
      src={image.src}
      alt={image.alt}
      fill
      priority={priorityImage}
      unoptimized={image.src.startsWith("/media/") || image.src.startsWith("data:")}
      sizes={variant === "feature" ? "(max-width: 767px) 100vw, 62vw" : "(max-width: 767px) 38vw, 16vw"}
    />
  ) : null;

  if (variant === "feature") {
    return (
      <>
        {category ? (
          <Link className="botanical-pill" href={category.href}>
            {category.label}
          </Link>
        ) : null}
        <TitleTag className="botanical-featured-title">{title}</TitleTag>
        {excerpt ? <p>{excerpt}</p> : null}
        <div className="botanical-meta" aria-label="Article metadata">
          {date ? <DateLabel date={date} /> : null}
          {author ? <span>{author}</span> : null}
          {readingTime ? <span>{readingTime}</span> : null}
        </div>
        <Link className="botanical-outline-button botanical-featured-link" href={href}>
          Read Article
        </Link>
        <Link className="botanical-featured-image" href={href} aria-label={String(title)}>
          {mediaImage}
        </Link>
      </>
    );
  }

  return (
    <article className="botanical-article-card article-card">
      <Link className="botanical-article-image article-thumb" href={href} aria-label={String(title)}>
        {mediaImage}
      </Link>
      <div className="botanical-article-body article-card-body">
        {category ? (
          <Link className="botanical-pill article-category-label" href={category.href}>
            {category.label}
          </Link>
        ) : null}
        <TitleTag>
          <Link href={href}>{title}</Link>
        </TitleTag>
        {excerpt && variant === "standard" ? <p>{excerpt}</p> : null}
        <div className="botanical-article-meta meta">
          {date ? <DateLabel date={date} /> : null}
          {readingTime ? <span>{readingTime}</span> : null}
        </div>
      </div>
    </article>
  );
}

function DateLabel({ date }: { date: { label: string; dateTime?: string } }) {
  return date.dateTime ? <time dateTime={date.dateTime}>{date.label}</time> : <span>{date.label}</span>;
}
