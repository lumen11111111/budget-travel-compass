import { AdminHeader, AdminShell } from "@/components/admin/admin-shell";
import { ArticleForm } from "@/components/admin/article-form";
import { createArticleAction } from "@/app/admin/articles/actions";
import { getArticleFormErrorMessage } from "@/app/admin/articles/form-errors";
import { siteConfig } from "@/config/site.config";
import { listCategories, listTags } from "@/db/repositories/content";
import { requireAdmin } from "@/lib/admin-guard";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewArticlePage({ searchParams }: PageProps) {
  await requireAdmin("/admin/articles/new");
  const { error } = await searchParams;
  const errorMessage = getArticleFormErrorMessage(error);
  const [categories, tags] = await Promise.all([listCategories(), listTags()]);

  return (
    <AdminShell>
      <AdminHeader title="New article" description={`Create a draft or publish a ${siteConfig.content.articleTypeLabel}.`} />
      <section className="admin-panel">
        <ArticleForm action={createArticleAction} categories={categories} errorMessage={errorMessage} tags={tags} />
      </section>
    </AdminShell>
  );
}
