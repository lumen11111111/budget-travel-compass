import type { ReactNode } from "react";

import { staticPageMetadata } from "@/lib/static-page-metadata";

export const metadata = staticPageMetadata("/terms-of-service");

export default function TermsOfServiceLayout({ children }: { children: ReactNode }) {
  return children;
}
