import type { ReactNode } from "react";

import { staticPageMetadata } from "@/lib/static-page-metadata";

export const metadata = staticPageMetadata("/contact");

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
