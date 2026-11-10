import type { ReactNode } from "react";

import { staticPageMetadata } from "@/lib/static-page-metadata";

export const metadata = staticPageMetadata("/about");

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
