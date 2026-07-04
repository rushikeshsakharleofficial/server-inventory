import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export function brandingUrl(slot: "logo" | "favicon"): string {
  return `${API_BASE}/api/branding/${slot}`;
}

/** Checks whether a custom branding asset was uploaded; null while checking.
 * Uses GET not HEAD — FastAPI's @router.get() doesn't register a HEAD route,
 * so HEAD 405s. GET's response is small (logos/favicons cap at 2MB) and the
 * browser cache means the following <img src> reuses this same fetch. */
function useBrandingAsset(slot: "logo" | "favicon"): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(brandingUrl(slot)).then((r) => {
      if (!cancelled) setUrl(r.ok ? brandingUrl(slot) : null);
    });
    return () => { cancelled = true; };
  }, [slot]);
  return url;
}

export function useBrandingLogo(): string | null {
  return useBrandingAsset("logo");
}

export function useBrandingFavicon(): string | null {
  return useBrandingAsset("favicon");
}
