import type { Metadata } from "next";
import type { ArticleView } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { toMetadataDate } from "@/lib/content-dates";
import { getAbsoluteUrl, getCanonicalSiteUrl, getMediaPublicUrl, normalizeSiteUrl, resolveCanonicalSiteUrl } from "@/lib/site-url";

export { getAbsoluteUrl, getCanonicalSiteUrl, getMediaPublicUrl, normalizeSiteUrl, resolveCanonicalSiteUrl };

export function getSiteUrl() {
  return getCanonicalSiteUrl();
}

export function absoluteUrl(value: string) {
  return getAbsoluteUrl(value);
}

export function canonicalUrl(path: string) {
  return getAbsoluteUrl(path);
}


export function paginatedPath(basePath: string, page: number) {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}

export function paginationMetadata(basePath: string, currentPage: number, totalPages: number) {
  return {
    ...(currentPage > 1 ? { "pagination-prev": canonicalUrl(paginatedPath(basePath, currentPage - 1)) } : {}),
    ...(currentPage < totalPages ? { "pagination-next": canonicalUrl(paginatedPath(basePath, currentPage + 1)) } : {}),
  };
}

interface SeoMetadataOptions {
  title: string;
  description?: string;
  path: string;
  image?: string;
  article?: {
    authors?: string[];
    modifiedTime?: string;
    publishedTime: string;
  };
}

export async function buildSeoMetadata({ article, description, image, path, title }: SeoMetadataOptions): Promise<Metadata> {
  const settings = await getSiteIdentitySettings();
  const url = canonicalUrl(path);
  const imageUrl = image ? absoluteUrl(image) : undefined;
  const resolvedDescription = description || settings.defaultSeoDescription;
  const images = imageUrl ? [{ url: imageUrl }] : undefined;

  return {
    title,
    description: resolvedDescription,
    alternates: {
      canonical: url,
    },
    openGraph: article
      ? {
          title,
          description: resolvedDescription,
          url,
          siteName: settings.siteName,
          type: "article",
          publishedTime: toMetadataDate(article.publishedTime) ?? article.publishedTime,
          modifiedTime: toMetadataDate(article.modifiedTime),
          authors: article.authors ?? [settings.defaultAuthor],
          images,
        }
      : {
          title,
          description: resolvedDescription,
          url,
          siteName: settings.siteName,
          type: "website",
          images,
        },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description: resolvedDescription,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export async function buildArticleJsonLd(article: ArticleView) {
  const settings = await getSiteIdentitySettings();
  const articleUrl = canonicalUrl(`/news/${article.slug}`);
  const imageUrl = article.coverUrl ? absoluteUrl(article.coverUrl) : undefined;
  const dateModified = toMetadataDate(article.updatedAt, article.publishedAt);

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.seoDescription ?? article.summary,
    datePublished: toMetadataDate(article.publishedAt) ?? article.publishedAt,
    ...(dateModified ? { dateModified } : {}),
    ...(imageUrl ? { image: [imageUrl] } : {}),
    author: [
      {
        "@type": "Organization",
        name: settings.operatorName,
        url: getSiteUrl().toString(),
      },
    ],
    publisher: {
      "@type": "Organization",
      name: settings.siteName,
      url: getSiteUrl().toString(),
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    articleSection: article.category.name,
    keywords: article.tags.map((tag) => tag.name).join(", "),
  };
}


export function buildBreadcrumbJsonLd(article: ArticleView) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: canonicalUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: article.category.name,
        item: canonicalUrl(`/category/${article.category.slug}`),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: canonicalUrl(`/news/${article.slug}`),
      },
    ],
  };
}
