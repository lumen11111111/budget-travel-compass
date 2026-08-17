import React from "react";

export type FeaturedGridProps<TItem> = {
  items: readonly TItem[];
  renderCard: (
    item: TItem,
    context: {
      index: number;
      variant: "feature" | "compact";
      priorityImage: boolean;
    },
  ) => React.ReactNode;
  emptyState?: React.ReactNode;
  maxItems?: number;
  className?: string;
  secondaryClassName?: string;
};

export function FeaturedGrid<TItem>({
  items,
  renderCard,
  emptyState = null,
  maxItems = 3,
  className = "featured-grid",
  secondaryClassName = "featured-secondary-stack",
}: FeaturedGridProps<TItem>) {
  const visibleItems = items.slice(0, maxItems);
  const [feature, ...secondary] = visibleItems;

  if (!feature) {
    return emptyState;
  }

  return (
    <div className={className}>
      {renderCard(feature, {
        index: 0,
        variant: "feature",
        priorityImage: true,
      })}

      {secondary.length > 0 ? (
        <div className={secondaryClassName}>
          {secondary.map((item, secondaryIndex) => (
            <React.Fragment key={secondaryIndex}>
              {renderCard(item, {
                index: secondaryIndex + 1,
                variant: "compact",
                priorityImage: false,
              })}
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}
