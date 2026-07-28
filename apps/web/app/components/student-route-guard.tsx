"use client";

import { useCallback, useEffect } from "react";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentBootstrap } from "../lib/api-client";
import { ErrorState, LoadingState } from "./portal-ui";
import { useTenant } from "./tenant-provider";

export function StudentRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenantRuntime = useTenant();
  const loadBootstrap = useCallback(
    (signal: AbortSignal) => getStudentBootstrap(signal),
    [],
  );
  const bootstrap = useApiResource(loadBootstrap);
  const needsOnboarding =
    bootstrap.data?.onboarding.required &&
    bootstrap.data.onboarding.status !== "completed";
  const needsSignIn =
    bootstrap.status === "error" &&
    (bootstrap.errorStatus === 401 || bootstrap.errorStatus === 403);

  useEffect(() => {
    if (needsSignIn) {
      window.location.replace(tenantRuntime.href("/sign-in"));
    } else if (needsOnboarding) {
      window.location.replace(tenantRuntime.href("/onboarding"));
    }
  }, [needsOnboarding, needsSignIn, tenantRuntime]);

  if (
    bootstrap.status === "loading" ||
    needsSignIn ||
    needsOnboarding
  ) {
    return (
      <main className="load-state">
        <LoadingState label="Checking your portal access" />
      </main>
    );
  }

  if (bootstrap.status === "error") {
    return (
      <main className="load-state">
        <ErrorState message={bootstrap.error} onRetry={bootstrap.reload} />
      </main>
    );
  }

  return children;
}
