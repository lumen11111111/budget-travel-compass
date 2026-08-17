import type React from "react";
import { GlobalPageShell } from "./GlobalPageShell";
import type { SearchPanelProps } from "./ArchivePageLayout";

export type ArticlePageLayoutProps<TArticle> = {
  header: React.ReactNode;
  footer: React.ReactNode;
  searchPanel?: SearchPanelProps;
  breadcrumb?: React.ReactNode;
  articleHero: React.ReactNode;
  articleBody: React.ReactNode;
  relatedArticles?: readonly TArticle[];
  renderRelatedArticleCard: (
    article: TArticle,
    context: {
      index: number;
      variant: "standard" | "compact";
    },
  ) => React.ReactNode;
};

export function ArticlePageLayout<TArticle>({
  header,
  footer,
  searchPanel,
  breadcrumb,
  articleHero,
  articleBody,
  relatedArticles,
  renderRelatedArticleCard,
}: ArticlePageLayoutProps<TArticle>) {
  return (
    <GlobalPageShell header={header} footer={footer}>
      {searchPanel ? <SearchPanel {...searchPanel} /> : null}

      <div className="container">
        {breadcrumb}
        <article className="article-page">
          {articleHero}
          {articleBody}
        </article>

        {relatedArticles && relatedArticles.length > 0 ? (
          <section className="related-articles">
            <div className="article-list">
              {relatedArticles.map((article, index) =>
                renderRelatedArticleCard(article, {
                  index,
                  variant: "standard",
                }),
              )}
            </div>
          </section>
        ) : null}
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
