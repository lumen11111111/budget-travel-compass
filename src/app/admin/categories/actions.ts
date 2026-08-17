"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCategory, deleteCategory, updateCategory, type CategoryInput } from "@/db/repositories/admin-content";
import { listAdminArticles, listAdminCategories } from "@/db/repositories/content";
import { requireAdmin } from "@/lib/admin-guard";

const categorySchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  description: z.string().trim(),
  sortOrder: z.coerce.number().int().min(0),
  enabled: z.boolean(),
  seoTitle: z.string().trim(),
  seoDescription: z.string().trim(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function parseCategoryForm(formData: FormData): CategoryInput {
  const rawSlug = String(formData.get("slug") || formData.get("name") || "");
  const parsed = categorySchema.parse({
    name: formData.get("name"),
    slug: slugify(rawSlug),
    description: formData.get("description") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
    enabled: formData.get("enabled") === "on",
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
  });

  return {
    ...parsed,
    seoTitle: parsed.seoTitle || undefined,
    seoDescription: parsed.seoDescription || undefined,
  };
}

async function assertUniqueSlug(slug: string, currentId?: number) {
  const existing = (await listAdminCategories()).find((category) => category.slug === slug && category.id !== currentId);
  if (existing) {
    throw new Error(`Category slug "${slug}" is already used.`);
  }
}

function revalidateCategories() {
  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/articles");
}

export async function createCategoryAction(formData: FormData) {
  await requireAdmin("/admin/categories");
  const input = parseCategoryForm(formData);
  await assertUniqueSlug(input.slug);
  await createCategory(input);
  revalidateCategories();
}

export async function updateCategoryAction(formData: FormData) {
  await requireAdmin("/admin/categories");
  const id = Number(formData.get("id"));
  const input = parseCategoryForm(formData);
  await assertUniqueSlug(input.slug, id);
  await updateCategory(id, input);
  revalidateCategories();
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin("/admin/categories");
  const id = Number(formData.get("id"));
  const isUsed = (await listAdminArticles()).some((article) => article.categoryId === id);
  if (isUsed) {
    throw new Error("This category is used by articles and cannot be deleted.");
  }
  await deleteCategory(id);
  revalidateCategories();
}
