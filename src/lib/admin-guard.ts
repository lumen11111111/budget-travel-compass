import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, getAdminAuthConfig, verifyAdminSessionValue } from "@/lib/admin-session";

export async function isAdminSignedIn() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const { sessionSecret } = await getAdminAuthConfig();
  return verifyAdminSessionValue(session, sessionSecret);
}

export async function requireAdmin(nextPath: string) {
  if (await isAdminSignedIn()) return;
  redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
}
