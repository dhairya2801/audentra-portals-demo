import type { StaffWebSearchResult } from "@vv/contracts";
import {
  safeExternalThumbnailUrl,
  safeExternalWebUrl,
  webPublishedDate,
  webSourceLabel,
} from "../lib/staff-web-search";

type StaffWebSourceListVariant = "stack" | "rail";

export function StaffWebSourceList({
  results,
  idPrefix,
  variant = "stack",
  ariaLabel = "External web sources",
}: {
  results: readonly StaffWebSearchResult[];
  idPrefix: string;
  variant?: StaffWebSourceListVariant;
  ariaLabel?: string;
}) {
  return (
    <ol
      className={`staff-web-sources${variant === "rail" ? " staff-web-sources--rail" : ""}`}
      aria-label={ariaLabel}
    >
      {results.map((result, index) => {
        const href = safeExternalWebUrl(result.url);
        const published = webPublishedDate(result.publishedAt);
        const title = result.title.trim() || "Untitled web result";
        const sourceLabel = webSourceLabel(result);
        const thumbnailUrl =
          variant === "rail" ? safeExternalThumbnailUrl(result.thumbnailUrl) : null;

        return (
          <li className="staff-web-source" key={`${idPrefix}-${index}-${result.url}`}>
            {variant === "rail" ? (
              <div className="staff-web-source__media" aria-hidden="true">
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- provider images use unbounded external hosts.
                  <img
                    className="staff-web-source__thumbnail"
                    src={thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="staff-web-source__thumbnail-fallback">
                    {sourceLabel.slice(0, 1).toUpperCase() || "W"}
                  </span>
                )}
              </div>
            ) : null}
            <div className={variant === "rail" ? "staff-web-source__body" : undefined}>
              <div className="staff-web-source__meta">
                <span>{result.kind === "news" ? "News" : "Web"}</span>
                <span>{sourceLabel}</span>
                {published ? <time dateTime={result.publishedAt ?? undefined}>{published}</time> : null}
              </div>
              <h4>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${title} (opens in a new tab)`}
                  >
                    {title}
                    <span aria-hidden="true"> ↗</span>
                  </a>
                ) : (
                  <span>{title}</span>
                )}
              </h4>
              {result.snippet.trim() ? <p>{result.snippet}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
