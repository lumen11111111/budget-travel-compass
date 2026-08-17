import type React from "react";
import { GlobalPageShell } from "./GlobalPageShell";
import type { SearchPanelProps } from "./ArchivePageLayout";

export type SearchPageLayoutProps<TArticle> = {
  header: React.ReactNode;
  footer: React.ReactNode;
  searchPanel?: SearchPanelProps;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  resultCountLabel?: React.ReactNode;
  articles: readonly TArticle[];
  sidebar?: React.ReactNode;
  pagination?: React.ReactNode;
  emptyState?: React.ReactNode;
  renderArticleCard: (
    article: TArticle,
    context: {
      index: number;
      variant: "standard" | "compact";
    },
  ) => React.ReactNode;
};

export function SearchPageLayout<TArticle>({
  header,
  footer,
  searchPanel,
  title,
  eyebrow,
  resultCountLabel,
  articles,
  sidebar,
  pagination,
  emptyState,
  renderArticleCard,
}: SearchPageLayoutProps<TArticle>) {
  return (
    <GlobalPageShell header={header} footer={footer}>
      {searchPanel ? <SearchPanel {...searchPanel} /> : null}

      <div className="container content-grid">
        <section>
          <div className="section-title" style={{ marginTop: 0 }}>
            <div>
              {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
              <h1>{title}</h1>
            </div>
            {resultCountLabel ? <span>{resultCountLabel}</span> : null}
          </div>
          {articles.length > 0 ? (
            <div className="article-list">
              {articles.map((article, index) => renderArticleCard(article, { index, variant: "standard" }))}
            </div>
          ) : (
            <div className="empty-state">{emptyState}</div>
          )}
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
