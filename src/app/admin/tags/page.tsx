import { AdminHeader, AdminShell } from "@/components/admin/admin-shell";
import { createTagAction, deleteTagAction, updateTagAction } from "@/app/admin/tags/actions";
import { listAdminTags } from "@/db/repositories/content";
import { requireAdmin } from "@/lib/admin-guard";

export default async function AdminTagsPage() {
  await requireAdmin("/admin/tags");
  const tags = await listAdminTags();

  return (
    <AdminShell>
      <AdminHeader title="Tags" description="Manage article filters, search labels, popular tags, and editorial topic grouping." />
      <section className="admin-panel">
        <h2 className="admin-section-title">New tag</h2>
        <form action={createTagAction} className="inline-admin-form">
          <input name="name" placeholder="Tag name" required />
          <input name="slug" placeholder="tag-slug" />
          <input name="description" placeholder="Description" />
          <input name="sortOrder" type="number" min={0} defaultValue={tags.length + 1} />
          <label>
            <input name="enabled" type="checkbox" defaultChecked /> Enabled
          </label>
          <button className="button" type="submit">
            Add tag
          </button>
        </form>
      </section>
      <section className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Slug</th>
              <th>Description</th>
              <th>Order</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id}>
                <td colSpan={6}>
                  <form action={updateTagAction} className="table-edit-form">
                    <input name="id" type="hidden" value={tag.id} />
                    <input name="name" defaultValue={tag.name} aria-label={`${tag.name} name`} required />
                    <input name="slug" defaultValue={tag.slug} aria-label={`${tag.name} slug`} required />
                    <input name="description" defaultValue={tag.description} aria-label={`${tag.name} description`} />
                    <input name="sortOrder" type="number" min={0} defaultValue={tag.sortOrder} aria-label={`${tag.name} order`} />
                    <label>
                      <input name="enabled" type="checkbox" defaultChecked={tag.enabled} /> Enabled
                    </label>
                    <button className="button button-compact" type="submit">
                      Save
                    </button>
                  </form>
                  <form action={deleteTagAction} className="delete-inline-form">
                    <input name="id" type="hidden" value={tag.id} />
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
