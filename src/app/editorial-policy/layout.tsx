import type { ReactNode } from "react";

import { staticPageMetadata } from "@/lib/static-page-metadata";

export const metadata = staticPageMetadata("/editorial-policy");

export default function EditorialPolicyLayout({ children }: { children: ReactNode }) {
  return children;
}
