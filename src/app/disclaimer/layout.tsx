import type { ReactNode } from "react";

import { staticPageMetadata } from "@/lib/static-page-metadata";

export const metadata = staticPageMetadata("/disclaimer");

export default function DisclaimerLayout({ children }: { children: ReactNode }) {
  return children;
}
