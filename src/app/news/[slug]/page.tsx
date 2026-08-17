import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleDetail } from "@/components/public/article-detail";
import { getArticleBySlug, getRelatedArticles } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { buildSeoMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [article, identity] = await Promise.all([getArticleBySlug(slug), getSiteIdentitySettings()]);

  if (!article) {
    return {
      title: "News story not found",
    };
  }

  return {
    ...(await buildSeoMetadata({
      title: article.seoTitle ?? article.title,
      description: article.seoDescription ?? article.summary,
      path: `/news/${article.slug}`,
      image: article.coverUrl,
      article: {
        authors: [identity.defaultAuthor],
        publishedTime: article.publishedAt,
        modifiedTime: article.updatedAt,
      },
    })),
  };
}

export default async function ArticleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const [related, identity] = await Promise.all([getRelatedArticles(article, 3), getSiteIdentitySettings()]);
  return <ArticleDetail article={article} defaultAuthor={identity.defaultAuthor} related={related} publicationAwareInternalLinks />;
}
