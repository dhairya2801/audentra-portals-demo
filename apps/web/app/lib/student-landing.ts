/**
 * Where a student lands after signing in.
 *
 * The platform still names `/dashboard` as the initial route. The portal's
 * home is My Enrollment — the page that already answers "what now" — so the
 * dashboard slot resolves there; every other route the platform names
 * (onboarding, a parent context) is honoured as given.
 */
export function studentLandingRoute(initialRoute: string) {
  return initialRoute === "/dashboard" ? "/enrollment" : initialRoute;
}
