import Link from "next/link";
import { AdminHeader, AdminShell } from "@/components/admin/admin-shell";
import { siteConfig } from "@/config/site.config";
import { listAdminArticles, listCategories, listHomepageBlocks, listTags } from "@/db/repositories/content";
import { requireAdmin } from "@/lib/admin-guard";

export default async function AdminDashboardPage() {
  await requireAdmin("/admin");
  const [articles, categories, tags, homepageBlocks] = await Promise.all([
    listAdminArticles(),
    listCategories(),
    listTags(),
    listHomepageBlocks(),
  ]);
  const published = articles.filter((article) => article.status === "published").length;
  const drafts = articles.filter((article) => article.status === "draft").length;

  return (
    <AdminShell>
      <AdminHeader
        title="Content dashboard"
        description={`Manage ${siteConfig.name} articles, categories, tags, and homepage content.`}
        action={
          <Link className="button" href="/admin/articles/new">
            New article
          </Link>
        }
      />
      <div className="admin-grid">
        <section className="admin-panel">
          <span className="eyebrow">Articles</span>
          <h2>{articles.length}</h2>
          <p>Total articles, including seed samples and local drafts.</p>
        </section>
        <section className="admin-panel">
          <span className="eyebrow">Published</span>
          <h2>{published}</h2>
          <p>Visible on the public site.</p>
        </section>
        <section className="admin-panel">
          <span className="eyebrow">Drafts</span>
          <h2>{drafts}</h2>
          <p>Saved in admin and hidden from public pages.</p>
        </section>
      </div>
      <div className="admin-grid" style={{ marginTop: 14 }}>
        <section className="admin-panel">
          <span className="eyebrow">Categories</span>
          <h2>{categories.length}</h2>
          <p>Navigation and article grouping.</p>
        </section>
        <section className="admin-panel">
          <span className="eyebrow">Tags</span>
          <h2>{tags.length}</h2>
          <p>Used for discovery, search, and related reading.</p>
        </section>
        <section className="admin-panel">
          <span className="eyebrow">Blocks</span>
          <h2>{homepageBlocks.length}</h2>
          <p>Homepage modules are still template-controlled.</p>
        </section>
      </div>
    </AdminShell>
  );
}
