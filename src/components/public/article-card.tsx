import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site.config";
import type { ArticleView } from "@/db/repositories/content";
import { formatDate, formatViews } from "@/lib/format";
import { formatReadingTime } from "@/lib/reading-time";

type ArticleCardTitleLevel = "h2" | "h3";

export function ArticleCard({
  article,
  defaultAuthor = siteConfig.brand.byline,
  titleLevel = "h2",
}: {
  article: ArticleView;
  defaultAuthor?: string;
  titleLevel?: ArticleCardTitleLevel;
}) {
  const coverTone = article.tags[0]?.slug ?? article.category.slug;
  const TitleTag = titleLevel;

  return (
    <article className="article-card">
      <Link className="article-thumb" href={`/news/${article.slug}`} aria-label={article.title}>
        {article.coverUrl ? (
          <Image src={article.coverUrl} alt="" width={420} height={280} unoptimized />
        ) : (
          <span className={`cover-art cover-art-${coverTone}`} aria-hidden="true" />
        )}
        <span>{article.category.name}</span>
      </Link>
      <div className="article-card-body">
        <Link href={`/news/${article.slug}`}>
          <TitleTag>{article.title}</TitleTag>
        </Link>
        <div className="meta">
          <span>{defaultAuthor}</span>
          <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
          <span>{formatReadingTime(article.bodyHtml)}</span>
          <span>{formatViews(article.viewCount)}</span>
        </div>
        <p>{article.summary}</p>
      </div>
    </article>
  );
}
