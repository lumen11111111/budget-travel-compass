export const PUBLIC_ARTICLE_LIST_SQL = `
  SELECT
    id,
    title,
    slug,
    summary,
    cover_url,
    category_id,
    status,
    is_featured,
    is_pinned,
    sort_order,
    view_count,
    published_at,
    updated_at,
    seo_title,
    seo_description,
    MAX(
      1,
      CAST(
        (
          LENGTH(TRIM(REPLACE(REPLACE(body_html, CHAR(10), ' '), CHAR(13), ' ')))
          - LENGTH(REPLACE(TRIM(REPLACE(REPLACE(body_html, CHAR(10), ' '), CHAR(13), ' ')), ' ', ''))
          + 200
        ) / 200 AS INTEGER
      )
    ) AS reading_time_minutes
  FROM articles
  WHERE lower(status) = 'published'
  ORDER BY sort_order ASC, published_at DESC, id ASC
`;

export const PUBLISHED_ARTICLE_DETAIL_SQL = `
  SELECT *
  FROM articles
  WHERE slug = ? AND lower(status) = 'published'
  LIMIT 1
`;
