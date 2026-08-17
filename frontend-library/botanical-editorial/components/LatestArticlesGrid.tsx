import React from "react";

export type LatestArticlesGridProps<TItem> = {
  items: readonly TItem[];
  renderCard: (
    item: TItem,
    context: {
      index: number;
    },
  ) => React.ReactNode;
  getItemKey?: (item: TItem, index: number) => React.Key;
  emptyState?: React.ReactNode;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  className?: string;
};

export function LatestArticlesGrid<TItem>({
  items,
  renderCard,
  getItemKey,
  emptyState = null,
  className = "latest-articles-grid",
}: LatestArticlesGridProps<TItem>) {
  if (items.length === 0) {
    return emptyState;
  }

  return (
    <div className={className}>
      {items.map((item, index) => {
        const key = getItemKey ? getItemKey(item, index) : index;

        return <React.Fragment key={key}>{renderCard(item, { index })}</React.Fragment>;
      })}
    </div>
  );
}
