import Link from "next/link";
import { homepageConfig } from "@/config/homepage.config";
import { listEditorPicks, listTags } from "@/db/repositories/content";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";

export async function Sidebar() {
  const [tags, picks, identity] = await Promise.all([listTags(), listEditorPicks(), getSiteIdentitySettings()]);

  if (tags.length === 0 && picks.length === 0) return null;

  return (
    <aside className="sidebar">
      <section className="panel newspaper-panel">
        <div className="section-title" style={{ marginTop: 0 }}>
          <p className="section-heading-label">Popular Tags</p>
        </div>
        <div className="tag-row">
          {tags.map((tag) => (
            <Link className="tag" href={`/tag/${tag.slug}`} key={tag.slug}>
              {tag.name}
            </Link>
          ))}
        </div>
      </section>
      <section className="panel newspaper-panel" style={{ marginTop: 14 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          <p className="section-heading-label">{homepageConfig.labels.popularRecommendations}</p>
        </div>
        <ol className="heat-list">
          {picks.map((article, index) => (
            <li key={article.id}>
              <span className="rank">{index + 1}</span>
              <div>
                <Link href={`/news/${article.slug}`}>{article.title}</Link>
                <span>{identity.defaultAuthor}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
