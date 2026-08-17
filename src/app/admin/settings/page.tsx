import { AdminHeader, AdminShell } from "@/components/admin/admin-shell";
import { updateSiteIdentityAction } from "@/app/admin/settings/actions";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { requireAdmin } from "@/lib/admin-guard";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin("/admin/settings");
  const [settings, params] = await Promise.all([getSiteIdentitySettings(), searchParams]);

  return (
    <AdminShell>
      <AdminHeader title="Site Settings" description="Maintain site identity, contact emails, default SEO metadata, and legal operator details." />
      <section className="admin-panel">
        {params.saved ? <p className="admin-note">Settings saved.</p> : null}
        <form action={updateSiteIdentityAction} className="form-grid">
          <label className="field">
            <span>Site Name</span>
            <input name="siteName" defaultValue={settings.siteName} required />
          </label>
          <label className="field">
            <span>Tagline</span>
            <input name="tagline" defaultValue={settings.tagline} required />
          </label>
          <label className="field">
            <span>Site Description</span>
            <textarea name="siteDescription" rows={3} defaultValue={settings.siteDescription} required />
          </label>
          <label className="field">
            <span>Default SEO Title</span>
            <input name="defaultSeoTitle" defaultValue={settings.defaultSeoTitle} required />
          </label>
          <label className="field">
            <span>Default SEO Description</span>
            <textarea name="defaultSeoDescription" rows={3} defaultValue={settings.defaultSeoDescription} required />
          </label>
          <label className="field">
            <span>Contact Email</span>
            <input name="contactEmail" type="email" defaultValue={settings.contactEmail} required />
          </label>
          <label className="field">
            <span>Support Email</span>
            <input name="supportEmail" type="email" defaultValue={settings.supportEmail} required />
          </label>
          <label className="field">
            <span>Legal Email</span>
            <input name="legalEmail" type="email" defaultValue={settings.legalEmail} required />
          </label>
          <label className="field">
            <span>Team Name</span>
            <input name="teamName" defaultValue={settings.teamName} required />
          </label>
          <label className="field">
            <span>Editorial Team Name</span>
            <input name="editorialTeamName" defaultValue={settings.editorialTeamName} required />
          </label>
          <label className="field">
            <span>Operator Name</span>
            <input name="operatorName" defaultValue={settings.operatorName} required />
          </label>
          <label className="field">
            <span>Operator Country</span>
            <input name="operatorCountry" defaultValue={settings.operatorCountry} required />
          </label>
          <label className="field">
            <span>Legal Status</span>
            <input name="legalStatus" defaultValue={settings.legalStatus} required />
          </label>
          <label className="field">
            <span>Default Author</span>
            <input name="defaultAuthor" defaultValue={settings.defaultAuthor} required />
          </label>
          <button className="button" type="submit">
            Save Settings
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
