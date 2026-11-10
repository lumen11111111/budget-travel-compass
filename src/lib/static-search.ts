import type { ArticleView } from "@/db/repositories/content";
import type { ArticleCardData } from "@/components/public/article-card";

export interface StaticSearchArticle extends ArticleCardData {
  category: { name: string; slug: string };
  tags: Array<{ name: string; slug: string }>;
}

export function toStaticSearchArticle(article: ArticleView): StaticSearchArticle {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    coverUrl: article.coverUrl,
    publishedAt: article.publishedAt,
    readingTimeMinutes: article.readingTimeMinutes,
    viewCount: article.viewCount,
    category: { name: article.category.name, slug: article.category.slug },
    tags: article.tags.map((tag) => ({ name: tag.name, slug: tag.slug })),
  };
}

export function filterStaticSearchArticles(articles: StaticSearchArticle[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return articles;
  return articles.filter((article) =>
    [article.title, article.summary, article.category.name, ...article.tags.flatMap((tag) => [tag.name, tag.slug])]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}
