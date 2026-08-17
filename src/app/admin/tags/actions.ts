"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createTag, deleteTag, updateTag, type TagInput } from "@/db/repositories/admin-content";
import { listAdminArticles, listAdminTags } from "@/db/repositories/content";
import { requireAdmin } from "@/lib/admin-guard";

const tagSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  description: z.string().trim(),
  sortOrder: z.coerce.number().int().min(0),
  enabled: z.boolean(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function parseTagForm(formData: FormData): TagInput {
  const rawSlug = String(formData.get("slug") || formData.get("name") || "");
  return tagSchema.parse({
    name: formData.get("name"),
    slug: slugify(rawSlug),
    description: formData.get("description") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
    enabled: formData.get("enabled") === "on",
  });
}

async function assertUniqueSlug(slug: string, currentId?: number) {
  const existing = (await listAdminTags()).find((tag) => tag.slug === slug && tag.id !== currentId);
  if (existing) {
    throw new Error(`Tag slug "${slug}" is already used.`);
  }
}

function revalidateTags() {
  revalidatePath("/");
  revalidatePath("/admin/tags");
  revalidatePath("/admin/articles");
}

export async function createTagAction(formData: FormData) {
  await requireAdmin("/admin/tags");
  const input = parseTagForm(formData);
  await assertUniqueSlug(input.slug);
  await createTag(input);
  revalidateTags();
}

export async function updateTagAction(formData: FormData) {
  await requireAdmin("/admin/tags");
  const id = Number(formData.get("id"));
  const input = parseTagForm(formData);
  await assertUniqueSlug(input.slug, id);
  await updateTag(id, input);
  revalidateTags();
}

export async function deleteTagAction(formData: FormData) {
  await requireAdmin("/admin/tags");
  const id = Number(formData.get("id"));
  const isUsed = (await listAdminArticles()).some((article) => article.tagIds.includes(id));
  if (isUsed) {
    throw new Error("This tag is used by articles and cannot be deleted.");
  }
  await deleteTag(id);
  revalidateTags();
}
