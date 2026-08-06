export type SafePortalDestination = {
  href: string;
  external: boolean;
};

function safeInternalPath(value: string) {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/%5c/i.test(value) &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

export function safePortalDestination(
  value: unknown,
  fallback = "/dashboard",
): SafePortalDestination {
  const fallbackHref = safeInternalPath(fallback) ? fallback : "/dashboard";
  if (typeof value !== "string") {
    return { href: fallbackHref, external: false };
  }
  const candidate = value.trim();
  if (safeInternalPath(candidate)) {
    return { href: candidate, external: false };
  }
  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password
    ) {
      return { href: parsed.href, external: true };
    }
  } catch {
    // Invalid and unsafe destinations fall through to the tenant-local fallback.
  }
  return { href: fallbackHref, external: false };
}
