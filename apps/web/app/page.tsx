"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { PortalMark } from "./components/portal-ui";
import { useApiResource } from "./hooks/use-api-resource";
import { getStudentBootstrap } from "./lib/api-client";

export default function PortalEntry() {
  const loadBootstrap = useCallback(
    (signal: AbortSignal) => getStudentBootstrap(signal),
    [],
  );
  const bootstrap = useApiResource(loadBootstrap);

  useEffect(() => {
    if (bootstrap.data) {
      window.location.replace(bootstrap.data.initialRoute);
    } else if (
      bootstrap.status === "error" &&
      (bootstrap.errorStatus === 401 || bootstrap.errorStatus === 403)
    ) {
      window.location.replace("/sign-in");
    }
  }, [bootstrap]);

  if (bootstrap.status === "error") {
    if (bootstrap.errorStatus === 401 || bootstrap.errorStatus === 403) {
      return (
        <main className="load-state" aria-busy="true">
          <div className="load-state__card">
            <PortalMark />
            <p className="eyebrow">Aster University</p>
            <h1>Taking you to sign in</h1>
            <span className="loader" aria-hidden="true" />
          </div>
        </main>
      );
    }
    return (
      <main className="load-state">
        <div className="load-state__card" role="alert">
          <PortalMark />
          <p className="eyebrow">Aster University</p>
          <h1>We couldn’t open your portal</h1>
          <p>{bootstrap.error}</p>
          <button
            className="button button--primary"
            type="button"
            onClick={bootstrap.reload}
          >
            Try again
          </button>
          <Link className="text-link" href="/sign-in">
            Return to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="load-state" aria-busy="true" aria-live="polite">
      <div className="load-state__card">
        <PortalMark />
        <p className="eyebrow">Aster University</p>
        <h1>Opening your student portal</h1>
        <p>We’re finding the right place for you to continue.</p>
        <span className="loader" aria-hidden="true" />
      </div>
    </main>
  );
}
