"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react";
import {
  tenantConfigs,
  tenantCopy,
  tenantHref,
  tenantSlugFromPathname,
  type TenantConfig,
} from "../lib/tenant";

interface TenantRuntime {
  tenant: TenantConfig;
  href: (value: string) => string;
  copy: (value: string) => string;
}

const defaultTenant = tenantConfigs.aster;
const TenantContext = createContext<TenantRuntime>({
  tenant: defaultTenant,
  href: (value) => tenantHref(value, defaultTenant.slug),
  copy: (value) => value,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const tenant = tenantConfigs[tenantSlugFromPathname(pathname)];
  const runtime = useMemo<TenantRuntime>(
    () => ({
      tenant,
      href: (value) => tenantHref(value, tenant.slug),
      copy: (value) => tenantCopy(value, tenant),
    }),
    [tenant],
  );

  useEffect(() => {
    document.documentElement.dataset.tenant = tenant.slug;
    document.documentElement.style.setProperty("--tenant-mark", `"${tenant.mark}"`);
    if (tenant.slug === "harvard") {
      document.title = document.title
        .replaceAll("Aster University", tenant.name)
        .replaceAll("Aster", tenant.shortName);
    }
  }, [tenant]);

  return (
    <TenantContext.Provider value={runtime}>{children}</TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
