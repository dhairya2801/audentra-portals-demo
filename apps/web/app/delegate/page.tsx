"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PortalMark } from "../components/portal-ui";
import { useTenant } from "../components/tenant-provider";
import { exchangeFerpaDelegateLink } from "../lib/api-client";
import { parentPortalHref } from "../lib/parent-portal-routes";

function fragmentToken() {
  const fragment = window.location.hash.replace(/^#/, "");
  if (!fragment) return null;
  const query = fragment.startsWith("/delegate?")
    ? fragment.slice(fragment.indexOf("?") + 1)
    : fragment;
  return new URLSearchParams(query).get("token");
}

export default function DelegateExchangePage() {
  const tenantRuntime = useTenant();
  const { tenant } = tenantRuntime;
  const token = useRef<string | null>(null);
  const started = useRef(false);
  const [canRetry, setCanRetry] = useState(false);
  const [state, setState] = useState<
    | { status: "opening"; message: string }
    | { status: "error"; message: string }
  >({ status: "opening", message: "Verifying your secure access link." });

  const exchange = useCallback(async () => {
    const currentToken = token.current;
    if (!currentToken) {
      setCanRetry(false);
      setState({
        status: "error",
        message: "This secure access link is missing its token. Ask the student to create or rotate the link again.",
      });
      return;
    }
    setState({ status: "opening", message: "Verifying your secure access link." });
    try {
      const session = await exchangeFerpaDelegateLink(currentToken);
      token.current = null;
      // Keep the one-time URL available while verification is in flight. If a
      // temporary network failure occurs, a browser refresh can still retry
      // the same link; clear it only after the server accepts it.
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
      setCanRetry(false);
      if (session.delegate.scopes.length === 0) {
        setState({
          status: "error",
          message: "The student has not granted any portal pages to this link.",
        });
        return;
      }
      window.location.replace(tenantRuntime.href(parentPortalHref(session.initialRoute)));
    } catch (caught) {
      setState({
        status: "error",
        message: caught instanceof Error
          ? caught.message
          : "This access link could not be verified. It may have been revoked or rotated.",
      });
    }
  }, [tenantRuntime]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    token.current = fragmentToken();
    setCanRetry(token.current !== null);
    void exchange();
  }, [exchange]);

  return (
    <main className="load-state">
      <div className="load-state__card" role={state.status === "error" ? "alert" : undefined}>
        <PortalMark />
        <p className="eyebrow">{tenant.shortName} trusted access</p>
        <h1>{state.status === "opening" ? "Opening delegated access" : "This link could not open"}</h1>
        <p>{state.message}</p>
        {state.status === "opening" ? <span className="loader" aria-hidden="true" /> : (
          <div className="form-actions">
            <button className="button button--primary" type="button" onClick={() => void exchange()} disabled={!canRetry}>Try link again</button>
            <a className="button button--secondary" href={tenantRuntime.href("/help")}>Contact student support</a>
          </div>
        )}
      </div>
    </main>
  );
}
