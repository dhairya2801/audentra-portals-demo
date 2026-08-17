import type { TenantBootstrap, TenantContact } from "@vv/contracts";

export type TenantSlug = string;

export interface TenantConfig {
  id: string;
  slug: TenantSlug;
  name: string;
  legalName: string;
  shortName: string;
  mark: string;
  branding: TenantBootstrap["branding"];
  localization: TenantBootstrap["localization"];
  academicContext: TenantBootstrap["academicContext"];
  contacts: TenantBootstrap["contacts"];
  capabilities: TenantBootstrap["capabilities"];
  publicLinks: TenantBootstrap["publicLinks"];
  version: number;
  updatedAt: string | null;
}

const emptyContact: TenantContact = {
  label: "Student support",
  email: null,
  phone: null,
  hours: null,
  url: null,
};

function institutionMark(value: string) {
  const mark = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return mark || "I";
}

export function neutralTenant(slug: TenantSlug): TenantConfig {
  return {
    id: `unresolved:${slug}`,
    slug,
    name: "Your institution",
    legalName: "Your institution",
    shortName: "Your institution",
    mark: "I",
    branding: {
      logoUrl: "",
      logoAlt: "",
      logoDarkUrl: null,
      logoDarkAlt: null,
      faviconUrl: null,
      heroImageUrl: null,
      heroImageAlt: null,
      primaryColor: "#1f3b5b",
      secondaryColor: "#eff4f8",
      accentColor: "#c78a2c",
    },
    localization: {
      locale: "en-US",
      timeZone: "UTC",
      currencyCode: "USD",
      countryCode: "US",
    },
    academicContext: {
      academicYearLabel: "",
      currentTermLabel: "",
      defaultCampusName: null,
    },
    contacts: {
      support: emptyContact,
      admissions: null,
      financialAid: null,
    },
    capabilities: {},
    publicLinks: {},
    version: 0,
    updatedAt: null,
  };
}

export function tenantConfigFromBootstrap(
  bootstrap: TenantBootstrap,
): TenantConfig {
  return {
    id: bootstrap.tenantId,
    slug: bootstrap.slug,
    name: bootstrap.names.displayName,
    legalName: bootstrap.names.legalName,
    shortName: bootstrap.names.shortName,
    mark: institutionMark(bootstrap.names.shortName),
    branding: bootstrap.branding,
    localization: bootstrap.localization,
    academicContext: bootstrap.academicContext,
    contacts: bootstrap.contacts,
    capabilities: bootstrap.capabilities,
    publicLinks: bootstrap.publicLinks,
    version: bootstrap.version,
    updatedAt: bootstrap.updatedAt,
  };
}

const staticPathPrefixes = [
  "/_next/",
  "/api/",
  "/icon.",
  "/og.",
  "/media/",
  "/documents/onboarding/",
];

const portalRouteSegments = new Set([
  "appointments",
  "campus-life",
  "classrooms",
  "dashboard",
  // Developer-only surfaces (the Edward Lab). Reserved like every other
  // top-level route: without this, /dev/edward reads "dev" as a tenant slug
  // and the tenant bootstrap 404s before the page can render.
  "dev",
  "documents",
  "edward",
  "enrollment",
  "financials",
  "help",
  "messages",
  "onboarding",
  "offer",
  "payments",
  "profile",
  "sign-in",
  "staff",
  "v1",
  "health",
]);

const tenantRouteAliases: Record<string, string> = {
  "/offer": "/onboarding",
};

export function isTenantSlug(value: string | null | undefined): value is TenantSlug {
  return Boolean(
    value &&
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value) &&
      !portalRouteSegments.has(value),
  );
}

const configuredDefaultTenantSlug =
  process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG?.trim().toLowerCase();

export const defaultTenantSlug: TenantSlug | null = isTenantSlug(
  configuredDefaultTenantSlug,
)
  ? configuredDefaultTenantSlug
  : null;

export function tenantSlugFromPathname(pathname: string): TenantSlug | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment && isTenantSlug(firstSegment)
    ? firstSegment
    : defaultTenantSlug;
}

export function currentTenantSlug(): TenantSlug {
  const slug = typeof window === "undefined"
    ? defaultTenantSlug
    : tenantSlugFromPathname(window.location.pathname);
  if (!slug) {
    throw new Error(
      "A tenant-scoped route or NEXT_PUBLIC_DEFAULT_TENANT_SLUG is required for API requests.",
    );
  }
  return slug;
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
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];
  const secondSegment = segments[1];
  const alreadyTenantScoped =
    firstSegment === slug ||
    Boolean(
      firstSegment &&
        isTenantSlug(firstSegment) &&
        secondSegment &&
        portalRouteSegments.has(secondSegment),
    );
  if (alreadyTenantScoped) return href;

  const tenantPath = pathname === "/" ? `/${slug}` : `/${slug}${pathname}`;
  return `${tenantPath}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

export function tenantCopy(value: string, tenant: TenantConfig): string {
  return value
    .replaceAll("{institution}", tenant.shortName)
    .replaceAll("{institutionName}", tenant.name)
    .replaceAll("{academicYear}", tenant.academicContext.academicYearLabel)
    .replaceAll("{currentTerm}", tenant.academicContext.currentTermLabel);
}

export function formatTenantMoney(cents: number, tenant: TenantConfig) {
  return new Intl.NumberFormat(tenant.localization.locale, {
    style: "currency",
    currency: tenant.localization.currencyCode,
  }).format(cents / 100);
}

export function formatTenantDate(
  value: string | Date,
  tenant: TenantConfig,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(tenant.localization.locale, {
    ...options,
    timeZone: options.timeZone ?? tenant.localization.timeZone,
  }).format(value instanceof Date ? value : new Date(value));
}
