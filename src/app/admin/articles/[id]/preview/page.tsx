import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleDetail } from "@/components/public/article-detail";
import { getAdminDraftArticleById, getRelatedArticles } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { requireAdmin } from "@/lib/admin-guard";

export const metadata: Metadata = {
  title: "Draft Preview",
  alternates: null,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminArticlePreviewPage({ params }: PageProps) {
  const { id: idRaw } = await params;
  const previewPath = `/admin/articles/${idRaw}/preview`;
  await requireAdmin(previewPath);

  const id = Number(idRaw);
  if (!Number.isInteger(id) || id < 1) notFound();

  const article = await getAdminDraftArticleById(id);
  if (!article) notFound();

  const [related, identity] = await Promise.all([getRelatedArticles(article, 3), getSiteIdentitySettings()]);
  return <ArticleDetail article={article} defaultAuthor={identity.defaultAuthor} related={related} structuredData={false} />;
}
