import type { ArticleView } from "@/db/repositories/content";
import { ArticleCard } from "@/components/public/article-card";
import { GuidesEmptyState } from "@/components/public/inner-page";

type ArticleCardTitleLevel = "h2" | "h3";

export function ArticleList({
  articles,
  defaultAuthor,
  emptyText = "No matching stories are available yet.",
  titleLevel = "h2",
}: {
  articles: ArticleView[];
  defaultAuthor?: string;
  emptyText?: string;
  titleLevel?: ArticleCardTitleLevel;
}) {
  if (articles.length === 0) {
    return emptyText.toLowerCase().includes("found") ? <GuidesEmptyState search /> : <GuidesEmptyState />;
  }

  return (
    <div className="article-list">
      {articles.map((article) => (
        <ArticleCard article={article} defaultAuthor={defaultAuthor} key={article.id} titleLevel={titleLevel} />
      ))}
    </div>
  );
}
