"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, createAdminSessionValue, getAdminAuthConfig, getAdminCookieMaxAge } from "@/lib/admin-session";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  const { adminPassword, sessionSecret } = await getAdminAuthConfig();

  if (password !== adminPassword) {
    redirect("/admin/login?error=1");
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_SESSION_COOKIE, await createAdminSessionValue(sessionSecret), {
      httpOnly: true,
      maxAge: getAdminCookieMaxAge(),
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } catch {
    redirect("/admin/login?error=session");
  }

  redirect(next.startsWith("/admin") && next !== "/admin/login" ? next : "/admin");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
