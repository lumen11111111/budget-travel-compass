import Link from "next/link";
import { FileText, Folder, Home, ImageIcon, LayoutDashboard, Library, LogOut, Settings, Tags } from "lucide-react";
import { logoutAction } from "@/app/admin/login/actions";
import { siteConfig } from "@/config/site.config";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/articles", label: "Articles", icon: FileText },
  { href: "/admin/categories", label: "Categories", icon: Folder },
  { href: "/admin/tags", label: "Tags", icon: Tags },
  { href: "/admin/homepage", label: "Homepage", icon: Home },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/works", label: "Works Library", icon: Library },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin">
          <span className="brand-mark">
            {siteConfig.brand.logoPrefix[0]}
            {siteConfig.brand.logoSuffix[0]}
          </span>
          <span>{siteConfig.name} Admin</span>
        </Link>
        <nav aria-label="Admin navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link href={item.href} key={item.href}>
                <Icon size={17} aria-hidden="true" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="admin-logout">
          <button type="submit">
            <LogOut size={17} aria-hidden="true" />
            Sign out
          </button>
        </form>
      </aside>
      <section className="admin-main">{children}</section>
    </main>
  );
}

export function AdminHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="admin-header">
      <div>
        <span className="eyebrow">Admin</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
