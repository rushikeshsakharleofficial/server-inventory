type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  var __lovableEvents: LovableEvents | undefined;
}

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (globalThis.window === undefined) return;
  globalThis.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: globalThis.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}
