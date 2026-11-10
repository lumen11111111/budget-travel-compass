import type { ReactNode } from "react";

import { staticPageMetadata } from "@/lib/static-page-metadata";

export const metadata = staticPageMetadata("/cookie-policy");

export default function CookiePolicyLayout({ children }: { children: ReactNode }) {
  return children;
}
