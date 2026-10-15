import type { StudentRequirementDetail } from "@vv/contracts";

// These four seeded entries represent the same Ada transcript demonstration.
// Keep the established updated-transcript upload route and its canonical ID.
// This is a checklist projection only: submissions, history and dependencies
// remain in the platform. Do not collapse unrelated custom transcript tasks.
const transcriptEntries = [
  "ada_updated_transcript",
  "ada_demo_transcript",
  "camila_enr_190",
  "official_transcript",
];

export function visibleEnrollmentRequirements<T extends { code: string }>(items: T[]): T[] {
  const primary = transcriptEntries.slice(0, 2).find(code => items.some(item => item.code === code));
  if (!primary) return items;
  return items.filter(item => !transcriptEntries.includes(item.code) || item.code === primary);
}

// Approved My Enrollment wording from Audentra Finalized Interface Copy.
// Only presentation fields change; routing, versions and input contracts do not.
const finalizedCopy: Record<string, { title: string; description: string }> = {
  immunization_record: {
    title: "Submit your immunization documents",
    description: "Provide records or accepted documents that support your immunization status.",
  },
  identity_document: {
    title: "Submit your identity documentation",
    description: "Upload an accepted form of identification for review.",
  },
  financial_aid_verification: {
    title: "Complete your financial aid verification steps",
    description: "Upload the documents requested for financial aid verification.",
  },
  camila_fin_154: {
    title: "Provide proof of funds",
    description: "Upload accepted documents to verify your household income.",
  },
};

export function enrollmentPresentation(item: StudentRequirementDetail): StudentRequirementDetail {
  if (transcriptEntries.includes(item.code)) {
    const reviewing = item.status === "submitted" || item.status === "under_review";
    return {
      ...item,
      title: reviewing ? "Your final transcript is under review" : "Submit your final transcript",
      description: reviewing
        ? "We’re reviewing your transcript for transfer credit and course planning."
        : "Provide your final transcript for enrollment review.",
    };
  }
  const copy = finalizedCopy[item.code];
  return copy ? { ...item, ...copy } : item;
}
