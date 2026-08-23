"use client";

import type { TenantBootstrap } from "@vv/contracts";
import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiClientError, getTenantBootstrap } from "../lib/api-client";
import {
  neutralTenant,
  tenantConfigFromBootstrap,
  tenantCopy,
  type TenantConfig,
} from "../lib/tenant";

type TenantLoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: TenantBootstrap; error: null }
  | { status: "error"; data: null; error: string };

interface TenantRuntime {
  tenant: TenantConfig;
  status: TenantLoadState["status"];
  error: string | null;
  href: (value: string) => string;
  copy: (value: string) => string;
  reload: () => void;
}

const TenantContext = createContext<TenantRuntime | null>(null);

function tenantErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.status === 404) {
    return "This institution portal is not available.";
  }
  if (error instanceof ApiClientError) return error.message;
  return "We couldn’t load this institution’s portal configuration.";
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const isUnscopedLanding = pathname === "/";
  const bypassesTenantBootstrap = isUnscopedLanding || pathname.startsWith("/dev/");
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState<TenantLoadState>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    if (bypassesTenantBootstrap) return;
    const controller = new AbortController();
    void getTenantBootstrap(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ status: "ready", data, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            data: null,
            error: tenantErrorMessage(error),
          });
        }
      });
    return () => controller.abort();
  }, [bypassesTenantBootstrap, requestVersion]);

  const tenant = useMemo(
    () =>
      state.status === "ready"
        ? tenantConfigFromBootstrap(state.data)
        : neutralTenant("default"),
    [state],
  );
  const reload = useCallback(() => {
    setState({ status: "loading", data: null, error: null });
    setRequestVersion((current) => current + 1);
  }, []);
  const runtime = useMemo<TenantRuntime>(
    () => ({
      tenant,
      status: bypassesTenantBootstrap
        ? "ready"
        : state.status,
      error: bypassesTenantBootstrap
        ? null
        : state.error,
      href: (value) => value,
      copy: (value) => tenantCopy(value, tenant),
      reload,
    }),
    [bypassesTenantBootstrap, reload, state.error, state.status, tenant],
  );

  useEffect(() => {
    document.documentElement.dataset.tenant = tenant.slug;
    document.documentElement.lang = tenant.localization.locale.split("-")[0] || "en";
    document.documentElement.style.setProperty("--tenant-primary", tenant.branding.primaryColor);
    document.documentElement.style.setProperty("--tenant-secondary", tenant.branding.secondaryColor);
    document.documentElement.style.setProperty("--tenant-accent", tenant.branding.accentColor);
    document.documentElement.style.setProperty("--forest", tenant.branding.primaryColor);
    document.documentElement.style.setProperty("--forest-deep", tenant.branding.primaryColor);
    document.documentElement.style.setProperty("--gold", tenant.branding.accentColor);

    const faviconSelector = 'link[rel="icon"][data-tenant-icon]';
    if (tenant.branding.faviconUrl) {
      let favicon = document.querySelector<HTMLLinkElement>(faviconSelector);
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        favicon.dataset.tenantIcon = "true";
        document.head.appendChild(favicon);
      }
      favicon.href = tenant.branding.faviconUrl;
    } else {
      document.querySelector<HTMLLinkElement>(faviconSelector)?.remove();
    }
  }, [tenant]);

  return (
    <TenantContext.Provider value={runtime}>
      {runtime.status !== "ready" ? (
        <main className="load-state">
          <div
            className={`resource-state tenant-bootstrap-state tenant-bootstrap-state--${runtime.status}`}
            role={runtime.status === "error" ? "alert" : "status"}
            aria-busy={runtime.status === "loading"}
            aria-live="polite"
          >
            <span className={runtime.status === "loading" ? "loader" : "state-symbol"} aria-hidden="true">
              {runtime.status === "error" ? "!" : null}
            </span>
            <h1>
              {runtime.status === "loading"
                ? "Loading your institution portal"
                : "We couldn’t open this institution portal"}
            </h1>
            <p>
              {runtime.status === "loading"
                ? "Fetching the current institution configuration…"
                : runtime.error}
            </p>
            {runtime.status === "error" ? (
              <button className="button button--primary" type="button" onClick={runtime.reload}>
                Try again
              </button>
            ) : null}
          </div>
        </main>
      ) : (
        children
      )}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const runtime = useContext(TenantContext);
  if (!runtime) throw new Error("useTenant must be used inside TenantProvider");
  return runtime;
}
