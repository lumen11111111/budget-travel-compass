import type React from "react";
import { GlobalPageShell } from "./GlobalPageShell";

export type SearchPanelProps = {
  action: string;
  query?: string;
  placeholder?: React.ReactNode;
  buttonLabel?: React.ReactNode;
};

export type ArchivePageLayoutProps<TArticle> = {
  header: React.ReactNode;
  footer: React.ReactNode;
  searchPanel?: SearchPanelProps;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  articles: readonly TArticle[];
  sidebar?: React.ReactNode;
  pagination?: React.ReactNode;
  renderArticleCard: (
    article: TArticle,
    context: {
      index: number;
      variant: "standard" | "compact";
    },
  ) => React.ReactNode;
};

export function ArchivePageLayout<TArticle>({
  header,
  footer,
  searchPanel,
  title,
  eyebrow,
  articles,
  sidebar,
  pagination,
  renderArticleCard,
}: ArchivePageLayoutProps<TArticle>) {
  return (
    <GlobalPageShell header={header} footer={footer}>
      {searchPanel ? <SearchPanel {...searchPanel} /> : null}

      <div className="container content-grid">
        <section className="category-results">
          <div className="section-title" style={{ marginTop: 0 }}>
            <div>
              {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
              <h1>{title}</h1>
            </div>
          </div>
          <ArticleList articles={articles} renderArticleCard={renderArticleCard} />
          {pagination}
        </section>
        {sidebar}
      </div>
    </GlobalPageShell>
  );
}

function SearchPanel({ action, query = "", placeholder = "Search", buttonLabel = "Search" }: SearchPanelProps) {
  return (
    <form action={action} className="search-panel">
      <input name="q" defaultValue={query} placeholder={String(placeholder)} />
      <button className="button" type="submit">
        {buttonLabel}
      </button>
    </form>
  );
}

function ArticleList<TArticle>({
  articles,
  renderArticleCard,
}: {
  articles: readonly TArticle[];
  renderArticleCard: ArchivePageLayoutProps<TArticle>["renderArticleCard"];
}) {
  return (
    <div className="article-list">
      {articles.map((article, index) => renderArticleCard(article, { index, variant: "standard" }))}
    </div>
  );
}
