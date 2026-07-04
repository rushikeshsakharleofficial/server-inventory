import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * Derives a page size from the available height of a scrollable table body.
 *
 * SSR-safe: always returns `initial` until after mount, so server-rendered
 * markup and the first client paint match exactly (adapting immediately
 * would jump the row count and trigger a hydration mismatch, same class of
 * bug as useCurrentUser earlier in this app).
 *
 * Recalculates on ResizeObserver (covers window resize, sidebar collapse,
 * filter-area growth — anything that changes the body element's box) via a
 * single requestAnimationFrame-batched callback so rapid resize events don't
 * thrash layout. Only calls setState when the clamped value actually changes.
 */
export function useAdaptivePageSize(opts: {
  bodyRef: RefObject<HTMLElement | null>;
  rowHeight?: number;
  min?: number;
  max?: number;
  initial?: number;
}): number {
  const { bodyRef, rowHeight = 41, min = 10, max = 100, initial = 25 } = opts;
  const [pageSize, setPageSize] = useState(initial);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    function applyRecalc() {
      rafRef.current = null;
      const height = bodyRef.current?.clientHeight ?? 0;
      const rows = Math.floor(height / rowHeight);
      const clamped = Math.min(max, Math.max(min, rows || min));
      setPageSize((prev) => (prev === clamped ? prev : clamped));
    }

    function recalc() {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(applyRecalc);
    }

    recalc();
    const observer = new ResizeObserver(recalc);
    observer.observe(el);
    window.addEventListener("resize", recalc);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recalc);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyRef.current, rowHeight, min, max]);

  return pageSize;
}
