import React from "react";

export type HomeCategoryGridProps<TItem> = {
  items: readonly TItem[];
  renderCard: (
    item: TItem,
    context: {
      index: number;
      layout: "portrait" | "landscape";
    },
  ) => React.ReactNode;
  getItemKey?: (item: TItem, index: number) => React.Key;
  getLayout?: (item: TItem, index: number) => "portrait" | "landscape";
  emptyState?: React.ReactNode;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  className?: string;
};

export function HomeCategoryGrid<TItem>({
  items,
  renderCard,
  getItemKey,
  getLayout = (_item, index) => (index < 4 ? "portrait" : "landscape"),
  emptyState = null,
  className = "home-category-grid",
}: HomeCategoryGridProps<TItem>) {
  if (items.length === 0) {
    return emptyState;
  }

  return (
    <div className={className}>
      {items.map((item, index) => {
        const layout = getLayout(item, index);
        const key = getItemKey ? getItemKey(item, index) : index;

        return <React.Fragment key={key}>{renderCard(item, { index, layout })}</React.Fragment>;
      })}
    </div>
  );
}
