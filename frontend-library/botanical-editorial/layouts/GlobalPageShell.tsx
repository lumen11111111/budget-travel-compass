import type React from "react";

export type GlobalPageShellProps = {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
};

export function GlobalPageShell({ header, footer, children }: GlobalPageShellProps) {
  return (
    <main className="site-shell">
      {header}
      {children}
      {footer}
    </main>
  );
}
