/**
 * The developer affordance for opening a chosen demo student's portal.
 *
 * The demo campus holds a few thousand students with real, differing state.
 * Testing the product against it means signing in as a *particular* one, which
 * is what this panel exists for — and which is not something a student portal
 * should ever offer in production.
 *
 * Nothing here is a security control. The platform disables
 * `/v1/auth/demo/sign-in-as` outside development and preview, verifies the
 * signed cookie it issues, and resolves the student inside the authenticated
 * tenant. This module only decides whether to draw the box.
 */

/** Same shape as the Edward Lab gate, deliberately: one pattern per repo. */
export function demoStudentLoginEnabled(env: {
  NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED?: string;
  NODE_ENV?: string;
}): boolean {
  const flag = env.NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return env.NODE_ENV === "development";
}

/** Accepted student references: an institution reference or a UUID. */
const referencePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * Validates the typed reference before spending a round trip on it.
 *
 * The message names what the field wants rather than what the user did wrong;
 * "SYN-000042" is a far more useful hint than "invalid format".
 */
export function validateStudentReference(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Enter a student ID, such as SYN-000042.";
  if (value.length > 64) return "A student ID is at most 64 characters.";
  if (!referencePattern.test(value)) {
    return "Use the institution reference (SYN-000042) or the student’s UUID.";
  }
  return null;
}

export function normalizeStudentReference(raw: string): string {
  return raw.trim();
}
