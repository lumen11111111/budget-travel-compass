import { AdminHeader, AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin-guard";

export default async function AdminMediaPage() {
  await requireAdmin("/admin/media");

  return (
    <AdminShell>
      <AdminHeader title="Media Library" description="Reserved for Cloudflare R2 uploads, image selection, URL copying, and unused asset cleanup." />
      <section className="empty-state">
        <h2>No uploaded media yet</h2>
        <p>The current frontend uses seeded cover visuals. Once R2 is connected, uploaded covers and article images will appear here.</p>
      </section>
    </AdminShell>
  );
}
