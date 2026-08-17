import { AdminHeader, AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin-guard";

export default async function AdminWorksPage() {
  await requireAdmin("/admin/works");

  return (
    <AdminShell>
      <AdminHeader title="Works Library" description="A lightweight reserved library for linking future articles to original novel titles." />
      <section className="empty-state">
        <h2>No works added yet</h2>
        <p>This will not block the news site launch. Later, original titles can be added here with author, synopsis, and tags before public work pages are opened.</p>
      </section>
    </AdminShell>
  );
}
