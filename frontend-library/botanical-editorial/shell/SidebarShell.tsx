import type React from "react";
import Link from "next/link";
import type { ThemeLink } from "../media/media-types";

export type SidebarEditorPick = {
  title: React.ReactNode;
  href: string;
  meta?: React.ReactNode;
};

export type SidebarShellProps = {
  tags: readonly ThemeLink[];
  editorPicks: readonly SidebarEditorPick[];
  labels: {
    popularTags: React.ReactNode;
    editorPicks: React.ReactNode;
  };
};

export function SidebarShell({ tags, editorPicks, labels }: SidebarShellProps) {
  return (
    <aside className="sidebar">
      <section className="panel newspaper-panel">
        <div className="section-title">
          <span className="section-heading-label">{labels.popularTags}</span>
        </div>
        <div className="tag-row">
          {tags.map((tag) => (
            <Link className="tag" href={tag.href} key={`${tag.href}-${String(tag.label)}`}>
              {tag.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="panel newspaper-panel">
        <div className="section-title">
          <span className="section-heading-label">{labels.editorPicks}</span>
        </div>
        <ol className="heat-list">
          {editorPicks.map((pick, index) => (
            <li key={`${pick.href}-${index}`}>
              <span className="rank">{String(index + 1).padStart(2, "0")}</span>
              <Link href={pick.href}>{pick.title}</Link>
              {pick.meta ? <small>{pick.meta}</small> : null}
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
