import type { StudentRequirementDetail, StudentRewardSummary } from "@vv/contracts";

/** Presentation-only samples used when the service has not supplied reward data.
 * Never saved, awarded, or sent back to the platform. */
export const sampleRewards: StudentRewardSummary = {
  pointName: "Enrollment points", pointsPerUsd: 100, lifetimePoints: 1250, bookstoreCreditCents: 1250,
};
export function displayedTaskPoints(item: StudentRequirementDetail) {
  return item.reward?.points ?? (item.submissionType === "document" ? 150 : item.submissionType === "payment" ? 200 : 100);
}
