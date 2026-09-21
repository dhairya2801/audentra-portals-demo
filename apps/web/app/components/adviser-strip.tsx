"use client";

import { useCallback } from "react";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentAdvising } from "../lib/api-client";
import { TenantLink as Link } from "./tenant-link";

/**
 * The student's academic adviser, in the dashboard's summary strip — the
 * standing relationship the platform records, next to program, term and
 * campus. When the adviser is away or gone, that is said here rather than a
 * name printed as if nothing were wrong.
 */
export function AdviserStrip() {
  const advising = useApiResource(useCallback((signal: AbortSignal) => getStudentAdvising(signal), []), {
    refreshOnAmbient: false,
  });
  if (advising.status !== "ready" || !advising.data) return null;
  const primary = advising.data.primaryAdviser;
  const gap = advising.data.gaps[0] ?? null;
  return (
    <div>
      <span>Academic adviser</span>
      {primary ? (
        <strong className="adviser-strip">
          <span className="adviser-strip__avatar" aria-hidden="true">
            {primary.staff.name.split(" ").map((part) => part.slice(0, 1)).join("").slice(0, 2)}
          </span>
          <span>
            <Link href="/appointments">{primary.staff.name}</Link>
            <small>{gap ? gap.message : primary.staff.title ?? "Academic adviser"}</small>
          </span>
        </strong>
      ) : (
        <strong>
          Not assigned yet
          <small>{gap?.message ?? ""}</small>
        </strong>
      )}
    </div>
  );
}
