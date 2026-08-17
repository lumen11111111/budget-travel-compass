"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveSiteIdentitySettings } from "@/db/repositories/site-settings";
import { mergeSiteIdentitySettings } from "@/lib/site-identity";
import { requireAdmin } from "@/lib/admin-guard";

export async function updateSiteIdentityAction(formData: FormData) {
  await requireAdmin("/admin/settings");

  const settings = mergeSiteIdentitySettings({
    siteName: formData.get("siteName"),
    siteDescription: formData.get("siteDescription"),
    tagline: formData.get("tagline"),
    defaultSeoTitle: formData.get("defaultSeoTitle"),
    defaultSeoDescription: formData.get("defaultSeoDescription"),
    contactEmail: formData.get("contactEmail"),
    supportEmail: formData.get("supportEmail"),
    legalEmail: formData.get("legalEmail"),
    teamName: formData.get("teamName"),
    editorialTeamName: formData.get("editorialTeamName"),
    operatorName: formData.get("operatorName"),
    operatorCountry: formData.get("operatorCountry"),
    legalStatus: formData.get("legalStatus"),
    defaultAuthor: formData.get("defaultAuthor"),
  });

  await saveSiteIdentitySettings(settings);

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}
