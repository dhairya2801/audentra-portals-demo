"use client";

import { useCallback } from "react";
import { useApiResource } from "../hooks/use-api-resource";
import { askEdward } from "../lib/api-client";
import { TenantLink as Link } from "./tenant-link";

const briefRequest =
  "Create a concise personalized dashboard brief. Mention the most important enrollment " +
  "priority and, when relevant, financial aid and academic course recommendations. Use at " +
  "most two short sentences and only facts from the current student record.";

export function DashboardEdwardBrief({
  projectionVersion,
}: {
  projectionVersion: number;
}) {
  const loadBrief = useCallback(
    (signal: AbortSignal) =>
      askEdward(
        {
          message: briefRequest,
          pageContext: `/dashboard?projection=${projectionVersion}`,
        },
        signal,
      ),
    [projectionVersion],
  );
  const brief = useApiResource(loadBrief);

  return (
    <section
      className="aster-insight-card"
      aria-busy={brief.status === "loading" || brief.isRefreshing}
      aria-label="Edward's enrollment brief"
    >
      <span className="edward-avatar" aria-hidden="true">
        E
      </span>
      <p className="eyebrow">Edward’s brief</p>
      {brief.status === "loading" ? (
        <div className="edward-brief-loading" role="status">
          <strong>Preparing your latest insights…</strong>
          <span className="edward-brief-loading__track" aria-hidden="true">
            <span />
          </span>
          <small>Edward is checking your current enrollment record.</small>
        </div>
      ) : brief.status === "error" ? (
        <div className="edward-brief-error" role="alert">
          <strong>Your brief is not ready yet.</strong>
          <p>{brief.error}</p>
          <button className="button button--secondary" type="button" onClick={brief.reload}>
            Retry brief
          </button>
        </div>
      ) : (
        <>
          <blockquote>“{brief.data.message}”</blockquote>
          {brief.isRefreshing ? (
            <small className="edward-brief-refreshing" role="status">
              Refreshing insights…
            </small>
          ) : brief.refreshError ? (
            <div className="edward-brief-refresh-error" role="alert">
              <span>The latest refresh was interrupted.</span>
              <button type="button" onClick={brief.refresh}>
                Retry
              </button>
            </div>
          ) : null}
          <Link href="/edward">
            Ask Edward about this <span>→</span>
          </Link>
        </>
      )}
    </section>
  );
}
