import type React from "react";

export type FeaturedArticlesSectionProps<TArticle> = {
  title: React.ReactNode;
  deck?: React.ReactNode;
  articles: readonly TArticle[];
  renderArticleCard: (
    article: TArticle,
    context: {
      index: number;
      variant: "feature" | "standard" | "compact";
      priorityImage: boolean;
    },
  ) => React.ReactNode;
};

export function FeaturedArticlesSection<TArticle>({
  title,
  deck,
  articles,
  renderArticleCard,
}: FeaturedArticlesSectionProps<TArticle>) {
  const [feature, ...secondary] = articles;

  return (
    <section className="home-editorial-section featured-articles-section">
      <SectionHeading title={title} deck={deck} />
      {feature ? (
        <div className="featured-grid">
          {renderArticleCard(feature, {
            index: 0,
            variant: "feature",
            priorityImage: true,
          })}
          {secondary.length > 0 ? (
            <div className="featured-secondary-stack">
              {secondary.map((article, index) =>
                renderArticleCard(article, {
                  index: index + 1,
                  variant: "compact",
                  priorityImage: false,
                }),
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SectionHeading({ title, deck }: { title: React.ReactNode; deck?: React.ReactNode }) {
  return (
    <div className="home-section-heading">
      <div>
        <h2>{title}</h2>
      </div>
      {deck ? <span>{deck}</span> : null}
    </div>
  );
}
