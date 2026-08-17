import Link from "next/link";

export function articleCountLabel(count: number) {
  return `${count} ${count === 1 ? "article" : "articles"}`;
}

function pageHref(basePath: string, page: number) {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}

function visiblePages(currentPage: number, totalPages: number) {
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages].filter((page) => page >= 1 && page <= totalPages).toSorted((a, b) => a - b);
}

export function Pagination({
  basePath,
  currentPage,
  totalPages,
}: {
  basePath: string;
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const pages = visiblePages(currentPage, totalPages);
  let previousPage = 0;

  return (
    <nav className="pagination" aria-label="Pagination">
      {currentPage > 1 ? (
        <Link href={pageHref(basePath, currentPage - 1)}>Previous</Link>
      ) : null}
      {pages.map((page) => {
        const needsEllipsis = previousPage > 0 && page - previousPage > 1;
        previousPage = page;

        return (
          <span className="pagination-group" key={page}>
            {needsEllipsis ? <span className="pagination-ellipsis">...</span> : null}
            {page === currentPage ? (
              <span className="pagination-current" aria-current="page">
                {page}
              </span>
            ) : (
              <Link href={pageHref(basePath, page)}>{page}</Link>
            )}
          </span>
        );
      })}
      {currentPage < totalPages ? (
        <Link href={pageHref(basePath, currentPage + 1)}>Next</Link>
      ) : null}
    </nav>
  );
}

export function PaginationSummary({
  currentPage,
  pageSize,
  totalItems,
}: {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}) {
  if (totalItems === 0) {
    return <p className="pagination-summary">Showing 0 of 0 articles</p>;
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <p className="pagination-summary">
      Showing {start}&ndash;{end} of {articleCountLabel(totalItems)}
    </p>
  );
}
