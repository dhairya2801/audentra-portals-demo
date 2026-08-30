import type { StaffWebSearchResult } from "@vv/contracts";

const SAFE_WEB_PROTOCOLS = new Set(["http:", "https:"]);
const SAFE_THUMBNAIL_PROTOCOLS = new Set(["https:"]);

/** Treat every provider URL as untrusted before it reaches an anchor. */
export function safeExternalWebUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return SAFE_WEB_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** External media gets a stricter HTTPS-only boundary to avoid mixed content. */
export function safeExternalThumbnailUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return SAFE_THUMBNAIL_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function webSourceLabel(result: StaffWebSearchResult): string {
  if (result.source?.trim()) return result.source.trim();
  const href = safeExternalWebUrl(result.url);
  return href ? new URL(href).hostname.replace(/^www\./, "") : "External source";
}

const webDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function webPublishedDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : webDateFormatter.format(date);
}
