import type { StudentRequirementDetail, StudentRequirementSummary } from "@vv/contracts";

/**
 * The kind a requirement wears in the portal — the tinted tile every task row,
 * drawer header and award row draws (`.task-type-icon.<kind>` in the design
 * stylesheet), and the duotone glyph inside it.
 *
 * Reads only what the platform already says about a requirement; nothing here
 * invents a category the backend does not hold.
 */
export type RequirementKind =
  | "external"
  | "upload"
  | "profile"
  | "housing"
  | "meeting"
  | "review"
  | "identity"
  | "preferences"
  | "decision";

const KIND_ICONS: Record<RequirementKind, string> = {
  external: "external",
  upload: "upload",
  profile: "profile",
  housing: "home",
  meeting: "calendar",
  review: "file",
  identity: "shield",
  preferences: "bell",
  decision: "pen",
};

type RequirementLike = StudentRequirementSummary &
  Partial<Pick<StudentRequirementDetail, "submissionType" | "interactionType" | "documentCategory">>;

export function requirementKind(item: RequirementLike): RequirementKind {
  const code = item.code ?? "";
  if (code.includes("housing")) return "housing";
  if (code.includes("identity") || item.documentCategory === "identity") return "identity";
  if (code.includes("profile")) return "profile";
  if (code.includes("orientation") || item.submissionType === "appointment") return "meeting";
  if (item.interactionType === "ferpa" || item.interactionType === "signature") return "decision";
  if (item.submissionType === "document") return "upload";
  if (item.submissionType === "payment") return "external";
  if (item.interactionType === "single_select" || item.interactionType === "multiple_select") {
    return "preferences";
  }
  if (item.interactionType === "approval" || item.interactionType === "information") return "review";
  return "review";
}

export function kindIcon(kind: RequirementKind): string {
  return KIND_ICONS[kind] ?? "file";
}
