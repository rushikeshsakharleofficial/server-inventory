import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export function brandingUrl(slot: "logo" | "favicon"): string {
  return `${API_BASE}/api/branding/${slot}`;
}

/** HEAD-checks whether a custom branding asset was uploaded; null while checking. */
function useBrandingAsset(slot: "logo" | "favicon"): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(brandingUrl(slot), { method: "HEAD" }).then((r) => {
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
