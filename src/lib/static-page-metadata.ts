import type { Metadata } from "next";

import { canonicalUrl } from "@/lib/seo";

export function staticPageMetadata(pathname: string): Metadata {
  return {
    alternates: {
      canonical: canonicalUrl(pathname),
    },
  };
}
