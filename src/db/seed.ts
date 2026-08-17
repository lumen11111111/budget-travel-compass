import { articles, categories, homepageBlocks, siteSettings, tags } from "@/db/seed-data";

console.log(
  JSON.stringify(
    {
      categories,
      tags,
      articles: articles.map(({ bodyHtml: _bodyHtml, ...article }) => article),
      homepageBlocks,
      siteSettings,
    },
    null,
    2,
  ),
);

