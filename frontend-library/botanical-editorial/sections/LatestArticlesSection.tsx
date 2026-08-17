import type React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type LatestArticlesSectionProps<TArticle> = {
  id?: string;
  title: React.ReactNode;
  deck?: React.ReactNode;
  href?: string;
  linkLabel?: React.ReactNode;
  articles: readonly TArticle[];
  renderArticleCard: (
    article: TArticle,
    context: {
      index: number;
      variant: "feature" | "standard" | "compact";
      priorityImage: boolean;
    },
  ) => React.ReactNode;
};

export function LatestArticlesSection<TArticle>({
  id,
  title,
  deck,
  href,
  linkLabel,
  articles,
  renderArticleCard,
}: LatestArticlesSectionProps<TArticle>) {
  return (
    <section className="home-editorial-section latest-articles-section" id={id}>
      <div className="home-section-heading">
        <div>
          <h2>{title}</h2>
          {deck ? <span>{deck}</span> : null}
        </div>
        {href && linkLabel ? (
          <Link href={href}>
            {linkLabel}
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <div className="latest-articles-grid">
        {articles.map((article, index) =>
          renderArticleCard(article, {
            index,
            variant: "standard",
            priorityImage: false,
          }),
        )}
      </div>
    </section>
  );
}
