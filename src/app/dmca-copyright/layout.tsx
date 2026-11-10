import type { ReactNode } from "react";

import { staticPageMetadata } from "@/lib/static-page-metadata";

export const metadata = staticPageMetadata("/dmca-copyright");

export default function DmcaCopyrightLayout({ children }: { children: ReactNode }) {
  return children;
}
