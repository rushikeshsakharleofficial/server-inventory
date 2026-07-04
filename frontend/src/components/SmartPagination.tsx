import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

/** Compact page-number window with ellipsis, e.g. 1 … 4 5 [6] 7 8 … 235 */
function pageWindow(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

const btn =
  "min-w-7 h-7 px-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors";
const btnActive = "bg-primary border-primary text-primary-foreground font-semibold hover:bg-primary";

export function SmartPagination({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  isLoading = false,
  showJumpInput = true,
  showFirstLast = true,
}: Readonly<{
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  showJumpInput?: boolean;
  showFirstLast?: boolean;
}>) {
  const [jump, setJump] = useState("");
  const clampedTotalPages = Math.max(1, totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  function go(page: number) {
    const clamped = Math.min(clampedTotalPages, Math.max(1, page));
    if (clamped !== currentPage) onPageChange(clamped);
  }

  function submitJump() {
    const n = Number.parseInt(jump, 10);
    if (!Number.isNaN(n)) go(n);
    setJump("");
  }

  if (totalItems === 0) return null;

  return (
    <div className="px-4 py-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground whitespace-nowrap">
        Showing {start.toLocaleString()}–{end.toLocaleString()} of {totalItems.toLocaleString()} records
      </span>

      <div className="flex items-center gap-1">
        {showFirstLast && (
          <button
            className={`${btn} hidden sm:inline-flex items-center justify-center`}
            disabled={isLoading || currentPage === 1}
            onClick={() => go(1)}
            title="First page"
          >
            <ChevronsLeft className="size-3.5" />
          </button>
        )}
        <button
          className={`${btn} inline-flex items-center justify-center`}
          disabled={isLoading || currentPage === 1}
          onClick={() => go(currentPage - 1)}
          title="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        {/* Desktop/tablet: full page-number window. Mobile: "Page X of Y" */}
        <div className="hidden sm:flex items-center gap-1">
          {pageWindow(currentPage, clampedTotalPages).map((p, i) =>
            p === "ellipsis" ? (
              <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
            ) : (
              <button
                key={p}
                className={`${btn} ${p === currentPage ? btnActive : ""}`}
                disabled={isLoading}
                onClick={() => go(p)}
              >
                {p}
              </button>
            ),
          )}
        </div>
        <span className="sm:hidden px-1.5 text-muted-foreground whitespace-nowrap">
          Page {currentPage} of {clampedTotalPages}
        </span>

        <button
          className={`${btn} inline-flex items-center justify-center`}
          disabled={isLoading || currentPage === clampedTotalPages}
          onClick={() => go(currentPage + 1)}
          title="Next page"
        >
          <ChevronRight className="size-3.5" />
        </button>
        {showFirstLast && (
          <button
            className={`${btn} hidden sm:inline-flex items-center justify-center`}
            disabled={isLoading || currentPage === clampedTotalPages}
            onClick={() => go(clampedTotalPages)}
            title="Last page"
          >
            <ChevronsRight className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-muted-foreground hidden md:inline">Rows/page: Auto {pageSize}</span>
        {showJumpInput && (
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground hidden sm:inline">Go to</span>
            <input
              type="number"
              min={1}
              max={clampedTotalPages}
              value={jump}
              onChange={(e) => setJump(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitJump()}
              onBlur={() => jump && submitJump()}
              placeholder={String(currentPage)}
              className="w-12 px-1.5 py-1 border border-border rounded-md bg-background text-center focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </span>
        )}
      </div>
    </div>
  );
}
