import Link from "next/link";
import { LogIn } from "lucide-react";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site.config";
import { isAdminSignedIn } from "@/lib/admin-guard";
import { loginAction } from "./actions";

interface PageProps {
  searchParams: Promise<{ error?: string; next?: string }>;
}

function getLoginErrorMessage(error?: string) {
  if (error === "session") {
    return "The session cookie could not be created. Please try again.";
  }

  return error ? "The password is incorrect." : null;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { error, next = "/admin" } = await searchParams;
  const errorMessage = getLoginErrorMessage(error);
  if (await isAdminSignedIn()) {
    redirect("/admin");
  }

  return (
    <main className="site-shell">
      <div className="container" style={{ maxWidth: 520, paddingTop: 96 }}>
        <section className="admin-panel login-panel">
          <span className="eyebrow">Admin login</span>
          <h1>Sign in to {siteConfig.name}</h1>
          <p>Use the single administrator password from your environment variables.</p>
          {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
          <form action={loginAction} className="form-grid">
            <input name="next" type="hidden" value={next} />
            <label className="field">
              <span>Admin password</span>
              <input name="password" type="password" placeholder="Enter admin password" required />
            </label>
            <button className="button" type="submit">
              <LogIn size={17} aria-hidden="true" />
              Sign in
            </button>
          </form>
          <p>
            <Link href="/">Back to site</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
