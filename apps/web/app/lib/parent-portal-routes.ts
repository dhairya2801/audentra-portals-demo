export const PARENT_PORTAL_PREFIX = "/parent";

function pathWithoutSearchOrHash(value: string) {
  const boundary = value.search(/[?#]/);
  return boundary === -1 ? value : value.slice(0, boundary);
}

/**
 * Parent URLs are intentionally contextual, not record-addressed. The parent
 * session still determines the student and the API still enforces FERPA
 * scopes; the prefix only makes the browser context explicit.
 */
export function isParentPortalPath(value: string) {
  const pathname = pathWithoutSearchOrHash(value);
  return (
    pathname === PARENT_PORTAL_PREFIX ||
    pathname.startsWith(`${PARENT_PORTAL_PREFIX}/`)
  );
}

function isParentPortalDestination(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname === "/enrollment" ||
    pathname.startsWith("/enrollment/requirements/") ||
    pathname === "/financials" ||
    pathname === "/classrooms" ||
    pathname === "/campus-life" ||
    pathname.startsWith("/campus-life/clubs/") ||
    pathname === "/messages" ||
    pathname === "/edward" ||
    pathname === "/documents" ||
    pathname === "/profile" ||
    pathname === "/appointments" ||
    pathname === "/payments" ||
    pathname === "/help"
  );
}

/**
 * Adds the parent namespace only to routes that have an explicit parent
 * alias. Student-only routes such as onboarding and FERPA administration are
 * deliberately never rewritten into the parent namespace.
 */
export function parentPortalHref(value: string) {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    isParentPortalPath(value)
  ) {
    return value;
  }

  return isParentPortalDestination(pathWithoutSearchOrHash(value))
    ? `${PARENT_PORTAL_PREFIX}${value}`
    : value;
}
