import type { StudentProfile } from "@vv/contracts";

/** A new account can start onboarding before it exists in the university import.
 * Profile enrichment is optional here; authentication, network, and unexpected
 * failures must still surface. Never manufacture a profile or a write version.
 */
export async function loadOnboardingProfile(
  readProfile: () => Promise<StudentProfile>,
): Promise<StudentProfile | null> {
  try {
    return await readProfile();
  } catch (error) {
    if (
      error !== null && typeof error === "object" &&
      "status" in error && error.status === 404 &&
      "code" in error && error.code === "UNIVERSITY_STUDENT_NOT_FOUND"
    ) {
      return null;
    }
    throw error;
  }
}
