import Image from "next/image";
import Link from "next/link";
import { ArticleList } from "@/components/public/article-list";
import { SiteFooter } from "@/components/public/site-footer";
import { SearchPanel, SiteHeader } from "@/components/public/site-header";
import type { ArticleView } from "@/db/repositories/content";
import { formatDate, formatViews } from "@/lib/format";
import { formatReadingTime } from "@/lib/reading-time";
import { listArticleHeadings, normalizeArticleBodyHtml } from "@/lib/article-body";
import { buildArticleJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo";

interface ArticleDetailProps {
  article: ArticleView;
  defaultAuthor: string;
  related: ArticleView[];
  structuredData?: boolean;
}

export async function ArticleDetail({ article, defaultAuthor, related, structuredData = true }: ArticleDetailProps) {
  const coverTone = article.tags[0]?.slug ?? article.category.slug;
  const readingTime = formatReadingTime(article.bodyHtml);
  const articleBodyHtml = normalizeArticleBodyHtml(article.bodyHtml);
  const articleHeadings = listArticleHeadings(articleBodyHtml);
  const articleJsonLd = structuredData ? await buildArticleJsonLd(article) : null;
  const breadcrumbJsonLd = structuredData ? buildBreadcrumbJsonLd(article) : null;

  return (
    <main className="site-shell article-detail-shell">
      <SiteHeader />
      <SearchPanel />
      <div className="container">
        <nav className="article-breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href={`/category/${article.category.slug}`}>{article.category.name}</Link>
            </li>
            <li aria-current="page">{article.title}</li>
          </ol>
        </nav>
        <article className="article-page">
          <header className="article-hero">
            <div className="article-hero-content">
              <span className="eyebrow">{article.category.name}</span>
              <h1>{article.title}</h1>
              <p>{article.summary}</p>
              <div className="meta">
                <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
                <span>{readingTime}</span>
                <Link href={`/category/${article.category.slug}`}>{article.category.name}</Link>
                <span>{formatViews(article.viewCount)}</span>
              </div>
              <div className="tag-row">
                {article.tags.map((tag) => (
                  <Link className="tag" href={`/tag/${tag.slug}`} key={tag.slug}>
                    {tag.name}
                  </Link>
                ))}
              </div>
            </div>
            {article.coverUrl ? (
              <Image className="cover" src={article.coverUrl} alt={article.title} width={720} height={520} sizes="(max-width: 920px) 100vw, 46vw" />
            ) : (
              <span className={`cover cover-art cover-art-${coverTone}`} aria-hidden="true" />
            )}
          </header>
          {articleJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} /> : null}
          {breadcrumbJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} /> : null}
          <div className="btc-article-reading-layout">
            <div className="article-body" dangerouslySetInnerHTML={{ __html: articleBodyHtml }} />
            {articleHeadings.length ? (
              <aside className="btc-article-toc">
                <div className="btc-article-toc-desktop">
                  <span>In this guide</span>
                  <nav>
                    {articleHeadings.map((item) => (
                      <a className={item.level === 3 ? "is-subsection" : undefined} href={`#${item.id}`} key={item.id}>
                        {item.text}
                      </a>
                    ))}
                  </nav>
                </div>
                <details className="btc-article-toc-mobile">
                  <summary>In this guide</summary>
                  <nav>
                    {articleHeadings.map((item) => (
                      <a className={item.level === 3 ? "is-subsection" : undefined} href={`#${item.id}`} key={item.id}>
                        {item.text}
                      </a>
                    ))}
                  </nav>
                </details>
              </aside>
            ) : null}
          </div>
        </article>

        {related.length > 0 ? (
          <section className="related-articles">
            <div className="section-title">
              <h2>Related Guides</h2>
              <span>Continue exploring this route</span>
            </div>
            <ArticleList articles={related} defaultAuthor={defaultAuthor} titleLevel="h3" />
          </section>
        ) : null}
      </div>
      <SiteFooter />
    </main>
  );
}
