import type { ReactNode } from "react";

import { staticPageMetadata } from "@/lib/static-page-metadata";

export const metadata = staticPageMetadata("/privacy-policy");

export default function PrivacyPolicyLayout({ children }: { children: ReactNode }) {
  return children;
}
