"use client";

import type { StaffMorningBrewExternalContext as ExternalContext } from "@vv/contracts";
import { useEffect, useRef, useState } from "react";
import { StaffWebSourceList } from "../../components/staff-web-sources";
import { useTenant } from "../../components/tenant-provider";
import {
  getStaffMorningBrewExternalContext,
  triggerStaffMorningBrewExternalContext,
} from "../../lib/api-client";

const POLL_INTERVAL_MS = 1_500;

function isPolling(context: ExternalContext): boolean {
  return context.status === "pending" || context.status === "running";
}

function contextProblem(context: ExternalContext | null): string | null {
  if (!context || !["failed", "unavailable"].includes(context.status)) return null;
  return (
    context.errorMessage ??
    (context.status === "unavailable"
      ? "External reporting is not available for this Morning Brew."
      : "External reporting could not be refreshed just now.")
  );
}

function transportProblem(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "External reporting could not be reached just now.";
}

function timestampLabel(
  value: string | null,
  locale: string,
  timeZone: string,
): string | null {
  if (!value) return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.valueOf())) return null;
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZone,
    timeZoneName: "short",
  }).format(timestamp);
}

/**
 * A compact read-only rail over the platform's asynchronous news context.
 * The platform owns the query, the provider call, and every refresh decision;
 * the browser only queues a refresh and reads canonical state.
 */
export function MorningBrewExternalContext() {
  const tenantRuntime = useTenant();
  const [context, setContext] = useState<ExternalContext | null>(null);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [refreshRequested, setRefreshRequested] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // React development mode intentionally restarts mount effects. Preserve
    // the one automatic request per Morning Brew visit while allowing every
    // staff-initiated refresh version to start its own async cycle.
    if (refreshVersion === 0 && started.current) return;
    started.current = true;

    const controller = new AbortController();
    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const readCanonicalContext = async (): Promise<void> => {
      try {
        const next = await getStaffMorningBrewExternalContext(controller.signal);
        if (!active) return;
        setContext(next);
        setTransportError(null);

        // Poll only while the platform has accepted but not completed the
        // asynchronous refresh. Ready, failed, unavailable, and idle are
        // terminal reads for this mounted Morning Brew edition.
        if (isPolling(next)) {
          pollTimer = setTimeout(() => {
            void readCanonicalContext();
          }, POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setTransportError(transportProblem(error));
      }
    };

    const triggerAndRead = async (): Promise<void> => {
      if (refreshVersion > 0) setTransportError(null);
      try {
        // The endpoint deliberately accepts no browser-defined query or key.
        await triggerStaffMorningBrewExternalContext(controller.signal);
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setTransportError(transportProblem(error));
        }
      }

      if (active && !controller.signal.aborted) {
        await readCanonicalContext();
      }
    };

    void triggerAndRead().finally(() => {
      if (active) setRefreshRequested(false);
    });

    return () => {
      active = false;
      controller.abort();
      if (pollTimer !== null) clearTimeout(pollTimer);
    };
  }, [refreshVersion]);

  const processing = context ? isPolling(context) : transportError === null;
  const isRefreshing = processing || refreshRequested;
  const visibleStatus = context?.status ?? (transportError ? "failed" : "loading");
  const problem = transportError ?? contextProblem(context);
  const hasResults = Boolean(context?.results.length);
  const searchedAt = timestampLabel(
    context?.searchedAt ?? null,
    tenantRuntime.tenant.localization.locale,
    tenantRuntime.tenant.localization.timeZone,
  );

  const requestRefresh = () => {
    if (isRefreshing) return;
    setRefreshRequested(true);
    setRefreshVersion((current) => current + 1);
  };

  return (
    <section
      className="brew-news-rail"
      aria-labelledby="brew-news-rail-title"
      aria-busy={isRefreshing}
      data-external-context-status={visibleStatus}
    >
      <header className="brew-news-rail__head">
        <div>
          <p className="brew-eyebrow">Higher Ed News</p>
          <h2 id="brew-news-rail-title">Curated for you</h2>
        </div>
        <div className="brew-news-rail__actions">
          {searchedAt ? (
            <time dateTime={context?.searchedAt ?? undefined}>Updated {searchedAt}</time>
          ) : null}
          <button
            className="brew-news-rail__refresh"
            type="button"
            onClick={requestRefresh}
            disabled={isRefreshing}
            aria-label="Refresh Higher Ed News"
          >
            <span aria-hidden="true">↻</span> {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      {hasResults && context ? (
        <StaffWebSourceList
          results={context.results}
          idPrefix="morning-brew-external-context"
          variant="rail"
          ariaLabel="Curated higher education news"
        />
      ) : null}

      {isRefreshing ? (
        <p className="brew-news-rail__status" role="status">
          {context?.stale || context?.status === "ready"
            ? "Refreshing external reporting while the latest available stories remain here."
            : "Gathering current higher education reporting for this edition…"}
        </p>
      ) : null}

      {context?.status === "idle" ? (
        <p className="brew-news-rail__status">
          External reporting is being prepared for this edition.
        </p>
      ) : null}

      {problem ? (
        <div className="brew-news-rail__problem" role="alert">
          <strong>External reporting is unavailable</strong>
          <p>{problem}</p>
          {context?.retryAfter ? <small>A later refresh is already scheduled.</small> : null}
        </div>
      ) : null}

      {!processing && !problem && !hasResults && context?.status === "ready" ? (
        <div className="brew-news-rail__empty" role="status">
          <strong>No current stories matched this edition.</strong>
          <p>The rest of your Morning Brew is unchanged.</p>
        </div>
      ) : null}

      {hasResults ? (
        <p className="brew-news-rail__note">
          External reporting may be incomplete or inaccurate. Open and verify a source before
          using it in a student decision.
        </p>
      ) : null}
    </section>
  );
}
