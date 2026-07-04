import { type ReactNode, useRef } from "react";
import { Card, EmptyState } from "@/components/ui-bits";
import { SmartPagination } from "@/components/SmartPagination";
import { useAdaptivePageSize } from "@/hooks/useAdaptivePageSize";

export interface SmartTableColumn<T> {
  key: string;
  header: ReactNode;
  className?: string;
  render: (row: T) => ReactNode;
}

/**
 * Reusable table wrapper: sticky header, sticky/canonical pagination footer,
 * adaptive row count by default. Two pagination modes:
 *
 * - "client": pass the FULL result set as `rows`; SmartTable slices locally
 *   by the adaptive page size. Use for lists fetched whole today (users,
 *   crons, ssh-keys, etc.) and for the multiselect-overflow fallback
 *   (limit:500 fetch, client-filtered, then client-paginated here).
 * - "server": pass the CURRENT PAGE only as `rows`, plus `totalItems` from
 *   the API's `total`. Wire `onPageSizeChange` into the query's `limit` (and
 *   add `limit` to the query key) so adaptive size actually changes what's
 *   fetched.
 */
export function SmartTable<T>({
  columns,
  rows,
  rowKey,
  mode,
  page,
  onPageChange,
  totalItems,
  onPageSizeChange,
  isLoading = false,
  error = null,
  empty,
  rowClassName,
  onRowClick,
}: {
  columns: SmartTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  mode: "client" | "server";
  page: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  onPageSizeChange?: (n: number) => void;
  isLoading?: boolean;
  error?: string | null;
  empty?: ReactNode;
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const pageSize = useAdaptivePageSize({ bodyRef });

  if (onPageSizeChange) onPageSizeChange(pageSize);

  const visibleRows =
    mode === "client" ? rows.slice((page - 1) * pageSize, page * pageSize) : rows;
  const total = mode === "client" ? rows.length : totalItems;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card className="overflow-hidden flex flex-col">
      <div
        ref={bodyRef}
        className="overflow-y-auto"
        style={{ height: "calc(100vh - 320px)" }}
      >
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-surface border-b border-border">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-2.5 th-label ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleRows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`${onRowClick ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""} ${rowClassName?.(row) ?? ""}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-2.5 ${c.className ?? ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {!isLoading && !error && visibleRows.length === 0 && (
              <tr>
                <td colSpan={columns.length}>
                  {empty ?? <EmptyState title="No records" description="Nothing to show." />}
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title="Failed to load" description={error} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <SmartPagination
        currentPage={page}
        pageSize={pageSize}
        totalItems={total}
        totalPages={totalPages}
        onPageChange={onPageChange}
        isLoading={isLoading}
      />
    </Card>
  );
}
