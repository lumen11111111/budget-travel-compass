import { notFound } from "next/navigation";
import { AdminHeader, AdminShell } from "@/components/admin/admin-shell";
import { ArticleForm } from "@/components/admin/article-form";
import { updateArticleAction } from "@/app/admin/articles/actions";
import { getArticleFormErrorMessage } from "@/app/admin/articles/form-errors";
import { listAdminArticles, listCategories, listTags } from "@/db/repositories/content";
import { articles as seedArticles } from "@/db/seed-data";
import { requireAdmin } from "@/lib/admin-guard";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}

const seedIds = new Set(seedArticles.map((article) => article.id));

export default async function EditArticlePage({ params, searchParams }: PageProps) {
  const { id: idRaw } = await params;
  await requireAdmin(`/admin/articles/${idRaw}/edit`);
  const { error, saved } = await searchParams;
  const errorMessage = getArticleFormErrorMessage(error);
  const id = Number(idRaw);
  const article = (await listAdminArticles()).find((item) => item.id === id);

  if (!article || seedIds.has(article.id)) {
    notFound();
  }

  const [categories, tags] = await Promise.all([listCategories(), listTags()]);
  const action = updateArticleAction.bind(null, article.id);

  return (
    <AdminShell>
      <AdminHeader title="Edit article" description="Update content, SEO, status, and homepage placement." />
      {saved && !errorMessage ? <div className="form-success">Article saved.</div> : null}
      <section className="admin-panel">
        <ArticleForm action={action} article={article} categories={categories} errorMessage={errorMessage} tags={tags} />
      </section>
    </AdminShell>
  );
}
