import type React from "react";

export type RelatedArticlesSectionProps<TArticle> = {
  title: React.ReactNode;
  articles: readonly TArticle[];
  renderArticleCard: (
    article: TArticle,
    context: {
      index: number;
      variant: "standard" | "compact";
    },
  ) => React.ReactNode;
};

export function RelatedArticlesSection<TArticle>({
  title,
  articles,
  renderArticleCard,
}: RelatedArticlesSectionProps<TArticle>) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <section className="related-articles">
      <div className="section-title">
        <h2>{title}</h2>
      </div>
      <div className="article-list">
        {articles.map((article, index) =>
          renderArticleCard(article, {
            index,
            variant: "standard",
          }),
        )}
      </div>
    </section>
  );
}
