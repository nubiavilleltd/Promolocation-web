import React from "react";
import { useTablePagination } from "../hooks/use-table-pagination";
import Pagination from "./Pagination";

function getColumnValue(column, item, index) {
  if (typeof column.render === "function") {
    return column.render(item, index);
  }

  if (typeof column.accessor === "function") {
    return column.accessor(item, index);
  }

  if (typeof column.accessor === "string") {
    return item?.[column.accessor];
  }

  return null;
}

export default function DataTable({
  columns,
  dependencies = [],
  emptyMessage = "No records found.",
  error,
  errorMessage,
  footerContent,
  footerClassName = "card-footer",
  getRowKey,
  isError = false,
  isLoading = false,
  alwaysShowPagination = false,
  items = [],
  loadingMessage = "Loading...",
  pageSize,
  rowProps,
  tableClassName = "data-table",
  tableId,
  wrapperClassName = "table-outer-border",
}) {
  const {
    currentPage,
    pageSize: resolvedPageSize,
    paginatedItems,
    setCurrentPage,
    totalPages,
  } = useTablePagination(items, dependencies, pageSize);
  const colSpan = columns.length || 1;
  const statusMessage = errorMessage || error?.message || "Unable to load records.";

  return (
    <>
      <div className={wrapperClassName}>
        <table id={tableId} className={tableClassName}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key || column.header}
                  className={column.headerClassName}
                  scope="col"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colSpan}>
                  <div className="empty-state">{loadingMessage}</div>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={colSpan}>
                  <div className="empty-state">{statusMessage}</div>
                </td>
              </tr>
            ) : paginatedItems.length ? (
              paginatedItems.map((item, index) => {
                const absoluteIndex = currentPage * resolvedPageSize + index;
                const extraRowProps =
                  typeof rowProps === "function"
                    ? rowProps(item, absoluteIndex)
                    : rowProps || {};

                return (
                  <tr
                    key={
                      getRowKey
                        ? getRowKey(item, absoluteIndex)
                        : item?.id ?? absoluteIndex
                    }
                    {...extraRowProps}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key || column.header}
                        className={
                          typeof column.cellClassName === "function"
                            ? column.cellClassName(item, absoluteIndex)
                            : column.cellClassName
                        }
                      >
                        {getColumnValue(column, item, absoluteIndex)}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={colSpan}>
                  <div className="empty-state">{emptyMessage}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={footerClassName}>
        {typeof footerContent === "function"
          ? footerContent({
              currentPage,
              pageSize: resolvedPageSize,
              paginatedItems,
              totalPages,
            })
          : footerContent}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          showSinglePage={alwaysShowPagination}
        />
      </div>
    </>
  );
}
