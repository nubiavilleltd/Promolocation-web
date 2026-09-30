import React from "react";
import { getVisiblePages } from "../utils/formatters";

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showSinglePage = false,
}) {
  if (totalPages <= 1 && !showSinglePage) {
    return null;
  }

  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <nav className="pagination-nav" aria-label="Table pagination">
      <button
        type="button"
        className="pagination-arrow"
        aria-label="Previous page"
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
      >
        &lt;
      </button>
      <div className="pagination-pages">
        {visiblePages.map((page, index) =>
          page === "..." ? (
            <span
              key={`ellipsis-${index}`}
              className="pagination-ellipsis"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              type="button"
              className={`pagination-button${page === currentPage ? " is-active" : ""}`}
              aria-current={page === currentPage ? "page" : undefined}
              onClick={() => onPageChange(page)}
            >
              {page + 1}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        className="pagination-arrow"
        aria-label="Next page"
        disabled={currentPage >= totalPages - 1}
        onClick={() => onPageChange(currentPage + 1)}
      >
        &gt;
      </button>
    </nav>
  );
}
