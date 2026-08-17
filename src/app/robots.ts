import type { MetadataRoute } from "next";
import { canonicalUrl, getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/"],
    },
    sitemap: canonicalUrl("/sitemap.xml"),
    host: getSiteUrl().toString(),
  };
}
