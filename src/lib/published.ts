export function isPublishedStatus(status: string | null | undefined) {
  return status === "published";
}

export function publishedArticleWhere<T extends { status: string | null | undefined }>(article: T) {
  return isPublishedStatus(article.status);
}
