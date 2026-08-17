import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { AdminHeader, AdminShell } from "@/components/admin/admin-shell";
import { deleteArticleAction, setFeaturedArticlePinAction, updateArticleOrderAction } from "@/app/admin/articles/actions";
import { siteConfig } from "@/config/site.config";
import { listCategories, listFilteredAdminArticles } from "@/db/repositories/content";
import type { ArticleStatus } from "@/db/seed-data";
import { articles as seedArticles } from "@/db/seed-data";
import { formatDate, formatViews } from "@/lib/format";
import { requireAdmin } from "@/lib/admin-guard";

const seedIds = new Set(seedArticles.map((article) => article.id));

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
  }>;
}

function toStatus(value?: string): ArticleStatus | "all" {
  return value === "draft" || value === "published" || value === "archived" ? value : "all";
}

export default async function AdminArticlesPage({ searchParams }: PageProps) {
  await requireAdmin("/admin/articles");
  const params = await searchParams;
  const status = toStatus(params.status);
  const category = params.category ?? "all";
  const q = params.q ?? "";
  const [articles, categories] = await Promise.all([
    listFilteredAdminArticles({ q, status, category }),
    listCategories(),
  ]);

  return (
    <AdminShell>
      <AdminHeader
        title="Articles"
        description={`Create, edit, draft, publish, and archive ${siteConfig.name} news articles.`}
        action={
          <Link className="button" href="/admin/articles/new">
            New article
          </Link>
        }
      />
      <section className="admin-panel admin-filters">
        <form>
          <label className="field">
            <span>Search</span>
            <input name="q" defaultValue={q} placeholder="Search title, slug, category, or tag" />
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={status}>
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            <select name="category" defaultValue={category}>
              <option value="all">All categories</option>
              {categories.map((item) => (
                <option value={item.slug} key={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="filter-actions">
            <button className="button" type="submit">
              Apply
            </button>
            <Link className="button button-secondary-dark" href="/admin/articles">
              Reset
            </Link>
          </div>
        </form>
      </section>
      <section className="admin-panel">
        <p className="table-summary">{articles.length} article{articles.length === 1 ? "" : "s"} found.</p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Featured Pin</th>
              <th>Order</th>
              <th>Reads</th>
              <th>Published</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => {
              const isSeed = seedIds.has(article.id);

              return (
                <tr key={article.id}>
                  <td>
                    <strong>{article.title}</strong>
                    <span className="table-muted">{isSeed ? "Seed sample" : article.slug}</span>
                  </td>
                  <td>{article.category.name}</td>
                  <td>
                    <span className={`status-pill status-${article.status}`}>{article.status}</span>
                  </td>
                  <td>
                    <form action={setFeaturedArticlePinAction} className="order-form">
                      <input name="id" type="hidden" value={article.id} />
                      <input name="pinned" type="hidden" value={article.isPinned ? "0" : "1"} />
                      <button disabled={article.status !== "published"} type="submit">
                        {article.isPinned ? "Unpin" : "Pin"}
                      </button>
                    </form>
                    {article.isPinned ? <span className="table-muted">Current featured</span> : null}
                  </td>
                  <td>
                    <form action={updateArticleOrderAction} className="order-form">
                      <input name="id" type="hidden" value={article.id} />
                      <input name="sortOrder" type="number" min={0} defaultValue={article.sortOrder} aria-label={`Sort order for ${article.title}`} />
                      <button type="submit">Save</button>
                    </form>
                  </td>
                  <td>{formatViews(article.viewCount)}</td>
                  <td>{formatDate(article.publishedAt)}</td>
                  <td>
                    <div className="table-actions">
                      {article.status === "draft" ? (
                        <Link href={`/admin/articles/${article.id}/preview`} aria-label={`Preview ${article.title}`}>
                          <Eye size={16} aria-hidden="true" />
                        </Link>
                      ) : null}
                      {!isSeed ? (
                        <Link href={`/admin/articles/${article.id}/edit`} aria-label={`Edit ${article.title}`}>
                          <Pencil size={16} aria-hidden="true" />
                        </Link>
                      ) : null}
                      <form action={deleteArticleAction}>
                        <input name="id" type="hidden" value={article.id} />
                        <button type="submit" aria-label={`Delete ${article.title}`}>
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </form>
                      {isSeed ? (
                        <span className="table-muted">Seed sample</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
