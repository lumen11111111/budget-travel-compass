import type React from "react";

export type CategoryShowcaseSectionProps<TCategory> = {
  title: React.ReactNode;
  deck?: React.ReactNode;
  categories: readonly TCategory[];
  renderCategoryCard: (
    category: TCategory,
    context: {
      index: number;
      layout: "portrait" | "landscape";
    },
  ) => React.ReactNode;
};

export function CategoryShowcaseSection<TCategory>({
  title,
  deck,
  categories,
  renderCategoryCard,
}: CategoryShowcaseSectionProps<TCategory>) {
  return (
    <section className="category-showcase">
      <SectionHeading title={title} deck={deck} />
      <div className="home-category-grid">
        {categories.map((category, index) =>
          renderCategoryCard(category, {
            index,
            layout: index < 4 ? "portrait" : "landscape",
          }),
        )}
      </div>
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
