"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createArticle,
  deleteArticle,
  setFeaturedArticlePin,
  updateArticle,
  updateArticleOrder,
  type ArticleInput,
} from "@/db/repositories/admin-content";
import { listAdminArticles } from "@/db/repositories/content";
import { requireAdmin } from "@/lib/admin-guard";
import { preserveImportedArticleHtml, sanitizeArticleHtml } from "@/lib/article-html";
import type { ArticleFormErrorCode } from "./form-errors";

const articleSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters."),
  slug: z.string().trim().min(3, "Slug must be at least 3 characters."),
  summary: z.string().trim().min(10, "Summary must be at least 10 characters."),
  bodyHtml: z.string().trim().min(10, "Article body must be at least 10 characters."),
  coverUrl: z.string().trim(),
  categorySlug: z.string().trim().min(1, "Select a category."),
  tagSlugs: z.array(z.string()),
  status: z.enum(["draft", "published", "archived"]),
  isFeatured: z.boolean(),
  isPinned: z.boolean(),
  publishedAt: z.string().optional(),
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toBodyHtml(value: string) {
  if (/<[a-z][\s\S]*>/i.test(value)) {
    return value;
  }

  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function todayDateOnlyIso() {
  return `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function parseDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date.toISOString();
}

function parsePublishDate(value: FormDataEntryValue | null, status: ArticleInput["status"]): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return status === "published" ? todayDateOnlyIso() : "";

  return parseDateOnly(raw);
}

type ArticleFormParseResult =
  | {
      input: ArticleInput;
      success: true;
    }
  | {
      error: ArticleFormErrorCode;
      success: false;
    };

function toArticleFormErrorCode(issue: z.ZodIssue): ArticleFormErrorCode {
  const field = issue.path[0];

  if (field === "title") return "title-min";
  if (field === "slug") return "slug-min";
  if (field === "summary") return "summary-min";
  if (field === "bodyHtml") return "body-min";
  if (field === "categorySlug") return "category-required";

  return "invalid";
}

function parseArticleForm(formData: FormData, forcedStatus?: ArticleInput["status"]): ArticleFormParseResult {
  const status = forcedStatus ?? (formData.get("intent") === "publish" ? "published" : "draft");
  const rawSlug = String(formData.get("slug") || formData.get("title") || "");
  const publishedAt = parsePublishDate(formData.get("publishedAt"), status);
  const submittedBodyHtml = String(formData.get("bodyHtml") || formData.get("body") || "");
  const originalBodyHtml = String(formData.get("originalBodyHtml") || "");
  const bodyHtml = shouldPreserveOriginalBodyHtml(status, submittedBodyHtml, originalBodyHtml)
    ? preserveImportedArticleHtml(submittedBodyHtml, originalBodyHtml)
    : sanitizeArticleHtml(submittedBodyHtml);
  if (publishedAt === null) {
    return {
      error: "date-invalid",
      success: false,
    };
  }

  const parsed = articleSchema.safeParse({
    title: formData.get("title"),
    slug: slugify(rawSlug),
    summary: formData.get("summary"),
    bodyHtml,
    coverUrl: formData.get("coverUrl") ?? "",
    categorySlug: formData.get("categorySlug"),
    tagSlugs: formData.getAll("tagSlugs").map(String),
    status,
    isFeatured: formData.get("isFeatured") === "on",
    isPinned: status === "published" && formData.get("isPinned") === "on",
    publishedAt,
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0] ? toArticleFormErrorCode(parsed.error.issues[0]) : "invalid",
      success: false,
    };
  }

  return {
    input: {
      ...parsed.data,
      bodyHtml: sanitizeArticleHtml(toBodyHtml(parsed.data.bodyHtml)),
    },
    success: true,
  };
}

function shouldPreserveOriginalBodyHtml(status: ArticleInput["status"], submittedBodyHtml: string, originalBodyHtml: string) {
  if (!originalBodyHtml) return false;

  const importedOnlyTags = ["table", "thead", "tbody", "tr", "th", "td", "figure", "figcaption"];
  return importedOnlyTags.some((tag) => originalBodyHtml.includes(`<${tag}`) && !submittedBodyHtml.includes(`<${tag}`));
}

async function isSlugUsed(slug: string, currentId?: number) {
  const existing = (await listAdminArticles()).find((article) => article.slug === slug && article.id !== currentId);
  return Boolean(existing);
}

function revalidateContent() {
  revalidatePath("/");
  revalidatePath("/news");
  revalidatePath("/news/[slug]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/articles");
}

export async function createArticleAction(formData: FormData) {
  await requireAdmin("/admin/articles/new");
  const parsed = parseArticleForm(formData);
  if (!parsed.success) {
    redirect(`/admin/articles/new?error=${parsed.error}`);
  }

  if (await isSlugUsed(parsed.input.slug)) {
    redirect("/admin/articles/new?error=duplicate-slug");
  }

  const article = await createArticle(parsed.input);
  revalidateContent();
  redirect(`/admin/articles/${article.id}/edit?saved=1`);
}

export async function updateArticleAction(id: number, formData: FormData) {
  await requireAdmin(`/admin/articles/${id}/edit`);
  const parsed = parseArticleForm(formData);
  if (!parsed.success) {
    redirect(`/admin/articles/${id}/edit?error=${parsed.error}`);
  }

  if (await isSlugUsed(parsed.input.slug, id)) {
    redirect(`/admin/articles/${id}/edit?error=duplicate-slug`);
  }

  await updateArticle(id, parsed.input);
  revalidateContent();
  redirect(`/admin/articles/${id}/edit?saved=1`);
}

export async function deleteArticleAction(formData: FormData) {
  await requireAdmin("/admin/articles");
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) {
    await deleteArticle(id);
  }

  revalidateContent();
  redirect("/admin/articles");
}

export async function updateArticleOrderAction(formData: FormData) {
  await requireAdmin("/admin/articles");
  const id = Number(formData.get("id"));
  const sortOrder = Number(formData.get("sortOrder"));

  if (Number.isFinite(id) && Number.isFinite(sortOrder)) {
    await updateArticleOrder(id, sortOrder);
  }

  revalidateContent();
  revalidatePath("/admin/articles");
}

export async function setFeaturedArticlePinAction(formData: FormData) {
  await requireAdmin("/admin/articles");
  const id = Number(formData.get("id"));
  const pinned = formData.get("pinned") === "1";

  if (Number.isFinite(id)) {
    await setFeaturedArticlePin(id, pinned);
  }

  revalidateContent();
  revalidatePath("/admin/articles");
  redirect("/admin/articles");
}
