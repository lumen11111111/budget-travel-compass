import React from "react";

export type ArticleListProps<TArticle> = {
  articles: readonly TArticle[];
  renderArticleCard: (
    article: TArticle,
    context: {
      index: number;
      variant: "standard" | "compact";
    },
  ) => React.ReactNode;
  emptyState?: React.ReactNode;
};

export function ArticleList<TArticle>({ articles, renderArticleCard, emptyState = null }: ArticleListProps<TArticle>) {
  if (articles.length === 0) {
    return emptyState ? <div className="article-list">{emptyState}</div> : null;
  }

  return (
    <div className="article-list">
      {articles.map((article, index) => (
        <React.Fragment key={index}>{renderArticleCard(article, { index, variant: "standard" })}</React.Fragment>
      ))}
    </div>
  );
}
