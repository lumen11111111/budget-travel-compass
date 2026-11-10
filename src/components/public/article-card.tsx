import Image from "next/image";
import { PublicLink as Link } from "@/components/public/public-link";
import { siteConfig } from "@/config/site.config";
import type { ArticleView } from "@/db/repositories/content";
import { formatDate, formatViews } from "@/lib/format";

type ArticleCardTitleLevel = "h2" | "h3";

export interface ArticleCardData {
  id: number;
  title: string;
  slug: string;
  summary: string;
  coverUrl: string;
  publishedAt: string;
  readingTimeMinutes: number;
  viewCount: number;
  category: { name: string; slug: string };
  tags: Array<{ name: string; slug: string }>;
}

export function ArticleCard({
  article,
  defaultAuthor = siteConfig.brand.byline,
  titleLevel = "h2",
}: {
  article: ArticleCardData | ArticleView;
  defaultAuthor?: string;
  titleLevel?: ArticleCardTitleLevel;
}) {
  const coverTone = article.tags[0]?.slug ?? article.category.slug;
  const TitleTag = titleLevel;

  return (
    <article className="article-card">
      <Link className="article-thumb" href={`/guides/${article.slug}`} aria-label={article.title}>
        {article.coverUrl ? (
          <Image src={article.coverUrl} alt="" width={420} height={280} unoptimized />
        ) : (
          <span className={`cover-art cover-art-${coverTone}`} aria-hidden="true" />
        )}
        <span>{article.category.name}</span>
      </Link>
      <div className="article-card-body">
        <Link href={`/guides/${article.slug}`}>
          <TitleTag>{article.title}</TitleTag>
        </Link>
        <div className="meta">
          <span>{defaultAuthor}</span>
          <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
          <span>{article.readingTimeMinutes} min read</span>
          <span>{formatViews(article.viewCount)}</span>
        </div>
        <p>{article.summary}</p>
      </div>
    </article>
  );
}
