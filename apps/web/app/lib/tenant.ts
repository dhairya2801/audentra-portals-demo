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
