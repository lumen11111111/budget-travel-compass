import Link from "next/link";

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  getPageHref?: (page: number) => string;
  pageParamName?: string;
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
};

export type PaginationSummaryProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel?: string;
  itemLabelPlural?: string;
};

export function Pagination({
  currentPage,
  totalPages,
  getPageHref,
  pageParamName = "page",
  previousLabel = "Previous",
  nextLabel = "Next",
  className = "pagination",
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = getVisiblePages(currentPage, totalPages);
  const hrefForPage = (page: number) => getPageHref?.(page) ?? `?${pageParamName}=${page}`;

  return (
    <nav className={className} aria-label="Pagination">
      {currentPage > 1 ? <Link href={hrefForPage(currentPage - 1)}>{previousLabel}</Link> : null}

      {pages.map((page, index) =>
        page === "ellipsis" ? (
          <span className="pagination-ellipsis" key={`ellipsis-${index}`} aria-hidden="true">
            ...
          </span>
        ) : page === currentPage ? (
          <span className="pagination-current" key={page} aria-current="page">
            {page}
          </span>
        ) : (
          <Link href={hrefForPage(page)} key={page}>
            {page}
          </Link>
        ),
      )}

      {currentPage < totalPages ? <Link href={hrefForPage(currentPage + 1)}>{nextLabel}</Link> : null}
    </nav>
  );
}

export function PaginationSummary({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel = "item",
  itemLabelPlural = "items",
}: PaginationSummaryProps) {
  if (totalItems <= 0) {
    return <p className="pagination-summary">No {itemLabelPlural}</p>;
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const label = totalItems === 1 ? itemLabel : itemLabelPlural;

  return (
    <p className="pagination-summary">
      Showing {start}-{end} of {totalItems} {label}. Page {currentPage} of {totalPages}.
    </p>
  );
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const pages: Array<number | "ellipsis"> = [];

  for (let page = 1; page <= totalPages; page += 1) {
    const isEdge = page === 1 || page === totalPages;
    const isNearCurrent = Math.abs(page - currentPage) <= 1;

    if (isEdge || isNearCurrent) {
      pages.push(page);
      continue;
    }

    if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return pages;
}
