import type {
  CatalogCourse,
  CourseExemptionRecommendation,
  StudentAcademicPlanItem,
  StudentAcademics,
  TranscriptCredit,
} from "@vv/contracts";

/**
 * The reference's My Degree read model (`features/classrooms/data.js`,
 * `logic.js`), built from the production `StudentAcademics` payload.
 *
 * A requirement here is a plan category: the backend publishes the plan as
 * course rows tagged `major_core` / `math_science` / `general_education` /
 * `elective`, so those categories are the organising unit and the courses
 * under them are the rows. Credit approved is credit the backend already
 * counts (`completed` or `exempted`); an exemption recommendation is a
 * potential match and is never summed in — the same guardrail the reference
 * keeps in `requirementStatus`.
 */

export type CourseState = "approved" | "open" | "locked";
export type RequirementStatus = "satisfied" | "in-progress" | "not-started" | "pending";
export type CourseSituation = "counted" | "now" | "later" | "blocked";
export type Confidence = "likely" | "needs-review";

export interface DegreeCourse {
  code: string;
  title: string;
  credits: number;
  terms: string;
  state: CourseState;
  prerequisite: string | null;
  prerequisiteMet: boolean;
  /** How the backend counted it, when it did. */
  evidence: string | null;
  decidedOn: string | null;
  note: string | null;
  recommendedTerm: number;
  status: StudentAcademicPlanItem["status"];
  catalog: CatalogCourse;
}

export interface DegreeRequirement {
  id: string;
  group: string;
  name: string;
  summary: string;
  creditsRequired: number;
  creditsApproved: number;
  decidedOn: string | null;
  courses: DegreeCourse[];
}

export interface RequirementGroup {
  id: string;
  name: string;
  summary: string;
  requirements: DegreeRequirement[];
}

export interface CreditMatch {
  id: string;
  evidence: {
    document: string;
    source: string;
    detail: string;
    uploadedOn: string | null;
  };
  target: {
    requirementId: string;
    requirementName: string;
    courseCode: string;
    courseTitle: string;
    credits: number;
  };
  rule: { code: string; text: string };
  confidence: Confidence;
  confidenceNote: string;
  advice: string;
  status: CourseExemptionRecommendation["status"];
  ruleCode: string;
}

const CATEGORY_ORDER: StudentAcademicPlanItem["category"][] = [
  "general_education",
  "math_science",
  "major_core",
  "elective",
];

const CATEGORY_COPY: Record<
  StudentAcademicPlanItem["category"],
  { name: string; summary: string; group: "core" | "major" }
> = {
  general_education: {
    name: "General education",
    summary: "The courses every degree asks for.",
    group: "core",
  },
  math_science: {
    name: "Mathematics & science",
    summary: "The quantitative foundation your program is built on.",
    group: "core",
  },
  major_core: {
    name: "Major core",
    summary: "The sequence your program is built on.",
    group: "major",
  },
  elective: {
    name: "Electives",
    summary: "Courses your program lets you choose.",
    group: "major",
  },
};

const SOURCE_TYPE_DOCUMENT: Record<TranscriptCredit["sourceType"], string> = {
  ap: "AP score report",
  ib: "IB Diploma transcript",
  dual_enrollment: "Dual-enrollment transcript",
  transfer: "College transcript",
  transcript: "Transcript",
};

function courseState(item: StudentAcademicPlanItem): CourseState {
  if (item.status === "completed" || item.status === "exempted") return "approved";
  if (item.status === "blocked") return "locked";
  return "open";
}

function toDegreeCourse(item: StudentAcademicPlanItem): DegreeCourse {
  const state = courseState(item);
  const prerequisiteCodes = item.course.prerequisites.map((p) => p.courseCode);
  const missing = item.missingPrerequisiteCodes;
  const prerequisite =
    missing.length > 0
      ? missing.join(" and ")
      : prerequisiteCodes.length > 0
        ? prerequisiteCodes.join(" and ")
        : null;
  return {
    code: item.course.code,
    title: item.course.title,
    credits: item.course.credits,
    terms: item.course.availabilityLabel ?? `Term ${item.recommendedTerm}`,
    state,
    prerequisite,
    prerequisiteMet: state !== "locked" && prerequisiteCodes.length > 0 && missing.length === 0,
    evidence:
      item.status === "exempted"
        ? "Credit exempted by the Registrar"
        : item.status === "completed"
          ? "Completed"
          : null,
    decidedOn:
      item.status === "exempted" ? "Exempted" : item.status === "completed" ? "Completed" : null,
    note: null,
    recommendedTerm: item.recommendedTerm,
    status: item.status,
    catalog: item.course,
  };
}

export function buildRequirements(academics: StudentAcademics): DegreeRequirement[] {
  const requirements: DegreeRequirement[] = [];
  for (const category of CATEGORY_ORDER) {
    const items = academics.plan.filter((item) => item.category === category);
    if (items.length === 0) continue;
    const courses = items
      .slice()
      .sort((a, b) => a.recommendedTerm - b.recommendedTerm)
      .map(toDegreeCourse);
    const copy = CATEGORY_COPY[category];
    requirements.push({
      id: category.replaceAll("_", "-"),
      group: copy.group,
      name: copy.name,
      summary: copy.summary,
      creditsRequired: courses.reduce((sum, course) => sum + course.credits, 0),
      creditsApproved: courses
        .filter((course) => course.state === "approved")
        .reduce((sum, course) => sum + course.credits, 0),
      decidedOn: null,
      courses,
    });
  }
  return requirements;
}

export function groupRequirements(requirements: DegreeRequirement[]): RequirementGroup[] {
  const groups = [
    { id: "core", name: "Core curriculum", summary: "Every degree asks for these." },
    { id: "major", name: "Your major", summary: "The sequence your program is built on." },
  ];
  return groups
    .map((group) => ({
      ...group,
      requirements: requirements.filter((requirement) => requirement.group === group.id),
    }))
    .filter((group) => group.requirements.length > 0);
}

export function buildMatches(
  academics: StudentAcademics,
  requirements: DegreeRequirement[],
): CreditMatch[] {
  return academics.exemptionRecommendations.map((recommendation) => {
    const credit = academics.transcriptCredits.find(
      (item) => item.id === recommendation.transcriptCreditId,
    );
    const requirement = requirements.find((item) =>
      item.courses.some((course) => course.code === recommendation.targetCourseCode),
    );
    const target = requirement?.courses.find(
      (course) => course.code === recommendation.targetCourseCode,
    );
    const label = credit?.sourceCode ?? credit?.title ?? "Transcript credit";
    const detail = credit?.gradeOrScore ? `${label} · score ${credit.gradeOrScore}` : label;
    const confidence: Confidence =
      recommendation.status === "needs_review" || recommendation.confidence < 0.8
        ? "needs-review"
        : "likely";
    return {
      id: recommendation.id || recommendation.ruleCode,
      evidence: {
        document: credit ? SOURCE_TYPE_DOCUMENT[credit.sourceType] : "Transcript",
        source: credit?.institutionName ?? "Your records",
        detail,
        uploadedOn: null,
      },
      target: {
        requirementId: requirement?.id ?? "",
        requirementName: requirement?.name ?? "your program",
        courseCode: recommendation.targetCourseCode,
        courseTitle: recommendation.targetCourseTitle,
        credits: target?.credits ?? credit?.credits ?? 0,
      },
      rule: { code: recommendation.ruleCode, text: recommendation.rationale },
      confidence,
      confidenceNote: recommendation.requiresStaffReview
        ? `The rule matches at ${Math.round(recommendation.confidence * 100)}% confidence. A reviewer still has to sign it.`
        : `The rule matches at ${Math.round(recommendation.confidence * 100)}% confidence.`,
      advice: `Plan to register for ${recommendation.targetCourseCode} as if this match does not exist. Nothing changes until the Registrar records a decision.`,
      status: recommendation.status,
      ruleCode: recommendation.ruleCode,
    };
  });
}

/* ------------------------------------------------------------------ *
 * logic.js, ported.
 * ------------------------------------------------------------------ */

const STATUS_LABELS: Record<RequirementStatus, string> = {
  satisfied: "Satisfied",
  "in-progress": "In progress",
  "not-started": "Not started",
  pending: "Credits pending sync",
};

export function requirementStatus(requirement: DegreeRequirement): RequirementStatus {
  const { creditsApproved, creditsRequired } = requirement;
  if (creditsApproved == null) return "pending";
  if (creditsApproved <= 0) return "not-started";
  if (creditsApproved >= creditsRequired) return "satisfied";
  return "in-progress";
}

export function statusLabel(status: RequirementStatus) {
  return STATUS_LABELS[status] ?? STATUS_LABELS["not-started"];
}

export function statusIcon(status: RequirementStatus) {
  if (status === "satisfied") return "check";
  if (status === "in-progress") return "half";
  if (status === "pending") return "clock";
  return "circle";
}

export function creditTotals(requirements: DegreeRequirement[]) {
  return requirements.reduce(
    (totals, requirement) => {
      const status = requirementStatus(requirement);
      return {
        approved: totals.approved + (requirement.creditsApproved ?? 0),
        met: totals.met + (status === "satisfied" ? 1 : 0),
        pending: totals.pending + (status === "pending" ? 1 : 0),
        total: totals.total + 1,
      };
    },
    { approved: 0, met: 0, pending: 0, total: 0 },
  );
}

export function electiveRemaining(requirements: DegreeRequirement[], creditsToGraduate: number) {
  const required = requirements.reduce((sum, requirement) => sum + requirement.creditsRequired, 0);
  return Math.max(0, creditsToGraduate - required);
}

export function creditsUnderReview(matches: CreditMatch[] | null) {
  return (matches ?? []).reduce((sum, match) => sum + match.target.credits, 0);
}

export function matchesFor(matches: CreditMatch[] | null, requirementId: string) {
  return (matches ?? []).filter((match) => match.target.requirementId === requirementId);
}

export function matchTargeting(matches: CreditMatch[] | null, courseCode: string) {
  return (matches ?? []).find((match) => match.target.courseCode === courseCode) ?? null;
}

export function confidenceLabel(confidence: Confidence) {
  return confidence === "likely" ? "Likely" : "Needs review";
}

export function confidenceIcon(confidence: Confidence) {
  return confidence === "likely" ? "gauge" : "magnify";
}

export function defaultOpenRequirements(requirements: DegreeRequirement[]) {
  return requirements
    .filter((requirement) => requirementStatus(requirement) === "in-progress")
    .map((requirement) => requirement.id);
}

export const COURSE_GROUPS: { id: CourseSituation; label: string }[] = [
  { id: "counted", label: "Counted" },
  { id: "now", label: "You can take this term" },
  { id: "later", label: "Later terms" },
  { id: "blocked", label: "Blocked for now" },
];

/**
 * Offered this term when the catalog's availability names the tenant's current
 * term ("Fall" in "Fall and Spring"); with no current term published, every
 * open course counts as takeable now, which is what the backend's `eligible`
 * already says.
 */
export function offeredThisTerm(course: DegreeCourse, currentTerm: string) {
  const term = currentTerm.trim().split(/\s+/)[0]?.toLowerCase();
  if (!term) return true;
  return course.terms.toLowerCase().includes(term);
}

export function courseSituation(course: DegreeCourse, currentTerm: string): CourseSituation {
  if (course.state === "approved") return "counted";
  if (course.state === "locked") return "blocked";
  return offeredThisTerm(course, currentTerm) ? "now" : "later";
}

export function groupCourses(requirement: DegreeRequirement, currentTerm: string) {
  return COURSE_GROUPS.map((group) => ({
    ...group,
    courses: requirement.courses.filter(
      (course) => courseSituation(course, currentTerm) === group.id,
    ),
  })).filter((group) => group.courses.length > 0);
}

export function takeableCourses(requirement: DegreeRequirement, currentTerm: string) {
  return requirement.courses.filter((course) => courseSituation(course, currentTerm) === "now");
}

export function plannable(course: DegreeCourse, currentTerm: string) {
  const situation = courseSituation(course, currentTerm);
  return situation === "now" || situation === "later";
}

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six"];

export function remainingLine(requirement: DegreeRequirement) {
  const status = requirementStatus(requirement);
  if (status === "satisfied" || status === "pending") return null;
  const gap = requirement.creditsRequired - (requirement.creditsApproved ?? 0);
  const eligible = requirement.courses.filter((course) => course.state !== "approved");
  const values = new Set(eligible.map((course) => course.credits));
  if (values.size === 1) {
    const per = [...values][0];
    const count = Math.ceil(gap / per);
    const word = WORDS[count] ?? String(count);
    return `${word} more ${count === 1 ? "course finishes" : "courses finish"} this.`;
  }
  return `${gap} more credits finish this.`;
}

export function countsToward(course: DegreeCourse, requirement: DegreeRequirement) {
  if (course.state === "approved") {
    return { kind: "counted", text: `Counts toward ${requirement.name}.` };
  }
  if (requirement.id === "elective") {
    return { kind: "single", text: `Counts toward ${requirement.name}.` };
  }
  return { kind: "single", text: `Counts toward ${requirement.name}. Not elective credit.` };
}

function listCodes(codes: string[]) {
  if (codes.length <= 1) return codes.join("");
  return `${codes.slice(0, -1).join(", ")} and ${codes[codes.length - 1]}`;
}

export function matchEffect(match: CreditMatch, requirements: DegreeRequirement[]) {
  const requirement = requirements.find((item) => item.id === match.target.requirementId);
  if (!requirement || requirement.creditsApproved == null) return null;
  const from = requirement.creditsApproved;
  const to = from + match.target.credits;
  const unlocks: string[] = [];
  const target = requirement.courses.find((course) => course.code === match.target.courseCode);
  if (target?.state === "locked") unlocks.push(target.code);
  requirements.forEach((item) =>
    item.courses.forEach((course) => {
      if (
        course.state === "locked" &&
        course.prerequisite?.split(" and ").includes(match.target.courseCode)
      ) {
        unlocks.push(course.code);
      }
    }),
  );
  return {
    requirementName: requirement.name,
    from,
    to,
    required: requirement.creditsRequired,
    unlocks,
  };
}

export function effectLine(effect: ReturnType<typeof matchEffect>) {
  if (!effect) return null;
  const { requirementName, from, to, required, unlocks } = effect;
  const tail =
    unlocks.length > 0
      ? `, and ${listCodes(unlocks)} ${unlocks.length === 1 ? "stops" : "stop"} being locked`
      : "";
  return `If approved, ${requirementName} goes from ${from} of ${required} to ${to} of ${required} credits${tail}.`;
}

export type Band =
  | { kind: "matches"; label: string; action: string }
  | { kind: "takeable"; requirementId: string; label: string; action: string };

export function bandFor({
  matches,
  requirements,
  currentTerm,
}: {
  matches: CreditMatch[] | null;
  requirements: DegreeRequirement[];
  currentTerm: string;
}): Band | null {
  if (matches && matches.length > 0) {
    const count = matches.length;
    return {
      kind: "matches",
      label: `${count} potential ${count === 1 ? "match is" : "matches are"} with the Registrar`,
      action: "See what’s waiting",
    };
  }
  const candidates = requirements
    .map((requirement, index) => ({ requirement, index, status: requirementStatus(requirement) }))
    .filter(
      ({ requirement, status }) =>
        status !== "satisfied" && takeableCourses(requirement, currentTerm).length > 0,
    )
    .sort((a, b) => {
      const rank = (status: RequirementStatus) => (status === "in-progress" ? 0 : 1);
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
      const gap = (item: { requirement: DegreeRequirement }) =>
        item.requirement.creditsRequired - (item.requirement.creditsApproved ?? 0);
      if (gap(a) !== gap(b)) return gap(a) - gap(b);
      return a.index - b.index;
    });
  const nearest = candidates[0]?.requirement;
  if (nearest) {
    return {
      kind: "takeable",
      requirementId: nearest.id,
      label: `${nearest.name} has courses open this term`,
      action: "See what you can take",
    };
  }
  return null;
}

export function courseSlug(code: string) {
  return code.toLowerCase().replace(/\s+/g, "-");
}

/** What produces a match, for the student who has none. */
export const MATCH_SOURCES = [
  "A transcript from another college or university",
  "AP, IB or A-level examination results",
  "A placement exam result",
];
