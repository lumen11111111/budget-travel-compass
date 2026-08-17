"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateHomepageBlock, type HomepageBlockInput } from "@/db/repositories/admin-content";
import { requireAdmin } from "@/lib/admin-guard";

const homepageBlockSchema = z.object({
  title: z.string().trim().min(2),
  enabled: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
  displayCount: z.coerce.number().int().min(1).max(24),
});

function parseHomepageBlockForm(formData: FormData): HomepageBlockInput {
  return homepageBlockSchema.parse({
    title: formData.get("title"),
    enabled: formData.get("enabled") === "on",
    sortOrder: formData.get("sortOrder") ?? 0,
    displayCount: formData.get("displayCount") ?? 1,
  });
}

export async function updateHomepageBlockAction(formData: FormData) {
  await requireAdmin("/admin/homepage");
  const id = Number(formData.get("id"));
  await updateHomepageBlock(id, parseHomepageBlockForm(formData));
  revalidatePath("/");
  revalidatePath("/admin/homepage");
}
