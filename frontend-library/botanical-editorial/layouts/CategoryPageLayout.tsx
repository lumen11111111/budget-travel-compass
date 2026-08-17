import type React from "react";
import { CategoryHero } from "../sections/CategoryHero";
import type { CategoryHeroProps } from "../sections/CategoryHero";
import { GlobalPageShell } from "./GlobalPageShell";
import type { SearchPanelProps } from "./ArchivePageLayout";

export type CategoryPageLayoutProps<TArticle> = {
  header: React.ReactNode;
  footer: React.ReactNode;
  hero: CategoryHeroProps;
  searchPanel?: SearchPanelProps;
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

export function CategoryPageLayout<TArticle>({
  header,
  footer,
  hero,
  searchPanel,
  articles,
  sidebar,
  pagination,
  renderArticleCard,
}: CategoryPageLayoutProps<TArticle>) {
  return (
    <GlobalPageShell header={header} footer={footer}>
      <CategoryHero {...hero} />
      {searchPanel ? <SearchPanel {...searchPanel} /> : null}

      <div className="container content-grid category-layout">
        <section className="category-results">
          {pagination}
          <div className="article-list">
            {articles.map((article, index) => renderArticleCard(article, { index, variant: "standard" }))}
          </div>
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
