/**
 * Where a student lands after signing in.
 *
 * The platform names `/dashboard` as the initial route for a student whose
 * onboarding is done, and the portal honours it: the student home is the
 * dashboard. Every other route the platform names (onboarding, a parent
 * context) is honoured as given.
 */
export function studentLandingRoute(initialRoute: string) {
  return initialRoute;
}
