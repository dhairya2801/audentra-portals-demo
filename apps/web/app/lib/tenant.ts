export const tenantSlugs = ["aster", "harvard"] as const;

export type TenantSlug = (typeof tenantSlugs)[number];

export interface TenantConfig {
  id: string;
  slug: TenantSlug;
  name: string;
  shortName: string;
  mark: string;
  foundedLabel: string;
  supportEmail: string;
  admissionsEmail: string;
  registrarEmail: string;
  portalLabel: string;
  welcomeQuote: string;
}

export const tenantConfigs: Record<TenantSlug, TenantConfig> = {
  aster: {
    id: "00000000-0000-7000-8000-000000000001",
    slug: "aster",
    name: "Aster University",
    shortName: "Aster",
    mark: "A",
    foundedLabel: "AU · 1891",
    supportEmail: "enrollment@aster.edu",
    admissionsEmail: "admissions@aster.edu",
    registrarEmail: "registrar@aster.edu",
    portalLabel: "Aster University student portal",
    welcomeQuote:
      "Every Aster journey begins with a single, thoughtful step.",
  },
  harvard: {
    id: "00000000-0000-7000-8000-000000000002",
    slug: "harvard",
    name: "Harvard University",
    shortName: "Harvard",
    mark: "H",
    foundedLabel: "HU · 1636",
    supportEmail: "studentservices@harvard.edu",
    admissionsEmail: "admissions@harvard.edu",
    registrarEmail: "registrar@harvard.edu",
    portalLabel: "Harvard University student portal",
    welcomeQuote:
      "Your Harvard journey starts with a clear path and the support to follow it.",
  },
};

const staticPathPrefixes = [
  "/_next/",
  "/api/",
  "/icon.",
  "/og.",
  "/media/",
  "/documents/onboarding/",
];

const tenantRouteAliases: Record<string, string> = {
  "/offer": "/onboarding",
};

export function isTenantSlug(value: string | null | undefined): value is TenantSlug {
  return tenantSlugs.includes(value as TenantSlug);
}

export function tenantSlugFromPathname(pathname: string): TenantSlug {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return isTenantSlug(firstSegment) ? firstSegment : "aster";
}

export function currentTenantSlug(): TenantSlug {
  return typeof window === "undefined"
    ? "aster"
    : tenantSlugFromPathname(window.location.pathname);
}

export function tenantHref(href: string, slug: TenantSlug): string {
  if (
    !href.startsWith("/") ||
    href.startsWith("//") ||
    staticPathPrefixes.some((prefix) => href.startsWith(prefix))
  ) {
    return href;
  }

  const [pathAndQuery, hash = ""] = href.split("#", 2);
  const [rawPathname, query = ""] = pathAndQuery.split("?", 2);
  const pathname = tenantRouteAliases[rawPathname] ?? rawPathname;
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (isTenantSlug(firstSegment)) return href;

  const tenantPath = pathname === "/" ? `/${slug}` : `/${slug}${pathname}`;
  return `${tenantPath}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

export function tenantCopy(value: string, tenant: TenantConfig): string {
  if (tenant.slug === "aster") return value;
  return value
    .replaceAll("Aster University", tenant.name)
    .replaceAll("Aster", tenant.shortName)
    .replaceAll("aster.edu", "harvard.edu");
}
