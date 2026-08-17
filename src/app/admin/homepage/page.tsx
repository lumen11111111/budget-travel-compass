import { AdminHeader, AdminShell } from "@/components/admin/admin-shell";
import { updateHomepageBlockAction } from "@/app/admin/homepage/actions";
import { listAdminHomepageBlocks } from "@/db/repositories/content";
import { requireAdmin } from "@/lib/admin-guard";

export default async function AdminHomepagePage() {
  await requireAdmin("/admin/homepage");
  const blocks = await listAdminHomepageBlocks();

  return (
    <AdminShell>
      <AdminHeader title="Homepage Layout" description="Control fixed homepage modules and display counts without rebuilding the design." />
      <section className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Module</th>
              <th>Type</th>
              <th>Display Count</th>
              <th>Order</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => (
              <tr key={block.id}>
                <td colSpan={5}>
                  <form action={updateHomepageBlockAction} className="table-edit-form homepage-block-form">
                    <input name="id" type="hidden" value={block.id} />
                    <input name="title" defaultValue={block.title} aria-label={`${block.title} title`} required />
                    <input value={block.blockType} aria-label={`${block.title} type`} readOnly />
                    <input
                      name="displayCount"
                      type="number"
                      min={1}
                      max={24}
                      defaultValue={block.displayCount}
                      aria-label={`${block.title} display count`}
                    />
                    <input name="sortOrder" type="number" min={0} defaultValue={block.sortOrder} aria-label={`${block.title} order`} />
                    <label>
                      <input name="enabled" type="checkbox" defaultChecked={block.enabled} /> Enabled
                    </label>
                    <button className="button button-compact" type="submit">
                      Save
                    </button>
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
