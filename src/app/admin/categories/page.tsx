import { AdminHeader, AdminShell } from "@/components/admin/admin-shell";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "@/app/admin/categories/actions";
import { listAdminCategories } from "@/db/repositories/content";
import { requireAdmin } from "@/lib/admin-guard";

export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");
  const categories = await listAdminCategories();

  return (
    <AdminShell>
      <AdminHeader title="Categories" description="Maintain editorial sections, ordering, and SEO fields for the news site." />
      <section className="admin-panel">
        <h2 className="admin-section-title">New category</h2>
        <form action={createCategoryAction} className="inline-admin-form">
          <input name="name" placeholder="Category name" required />
          <input name="slug" placeholder="category-slug" />
          <input name="description" placeholder="Description" />
          <input name="sortOrder" type="number" min={0} defaultValue={categories.length + 1} />
          <label>
            <input name="enabled" type="checkbox" defaultChecked /> Enabled
          </label>
          <input name="seoTitle" placeholder="SEO title" />
          <input name="seoDescription" placeholder="SEO description" />
          <button className="button" type="submit">
            Add category
          </button>
        </form>
      </section>
      <section className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Slug</th>
              <th>Description</th>
              <th>Order</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td colSpan={6}>
                  <form action={updateCategoryAction} className="table-edit-form">
                    <input name="id" type="hidden" value={category.id} />
                    <input name="name" defaultValue={category.name} aria-label={`${category.name} name`} required />
                    <input name="slug" defaultValue={category.slug} aria-label={`${category.name} slug`} required />
                    <input name="description" defaultValue={category.description} aria-label={`${category.name} description`} />
                    <input name="sortOrder" type="number" min={0} defaultValue={category.sortOrder} aria-label={`${category.name} order`} />
                    <label>
                      <input name="enabled" type="checkbox" defaultChecked={category.enabled} /> Enabled
                    </label>
                    <input name="seoTitle" defaultValue={category.seoTitle} placeholder="SEO title" aria-label={`${category.name} SEO title`} />
                    <input
                      name="seoDescription"
                      defaultValue={category.seoDescription}
                      placeholder="SEO description"
                      aria-label={`${category.name} SEO description`}
                    />
                    <button className="button button-compact" type="submit">
                      Save
                    </button>
                  </form>
                  <form action={deleteCategoryAction} className="delete-inline-form">
                    <input name="id" type="hidden" value={category.id} />
                    <button type="submit">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
