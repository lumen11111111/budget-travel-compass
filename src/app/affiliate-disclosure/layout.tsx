import type { ReactNode } from "react";

import { staticPageMetadata } from "@/lib/static-page-metadata";

export const metadata = staticPageMetadata("/affiliate-disclosure");

export default function AffiliateDisclosureLayout({ children }: { children: ReactNode }) {
  return children;
}
