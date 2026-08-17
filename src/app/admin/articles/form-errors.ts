const articleFormErrorMessages = {
  "body-min": "Article body must be at least 10 characters.",
  "category-required": "Select a category.",
  "date-invalid": "Publish date must be a valid date.",
  "duplicate-slug": "Slug is already used by another article.",
  "slug-min": "Slug must be at least 3 characters.",
  "summary-min": "Summary must be at least 10 characters.",
  "title-min": "Title must be at least 3 characters.",
  invalid: "Please check the article fields and try again.",
} as const;

export type ArticleFormErrorCode = keyof typeof articleFormErrorMessages;

export function getArticleFormErrorMessage(error?: string) {
  if (!error) return null;
  return articleFormErrorMessages[error as ArticleFormErrorCode] ?? articleFormErrorMessages.invalid;
}
