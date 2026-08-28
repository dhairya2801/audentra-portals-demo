import type {
  BrewDeadline,
  BrewInsight,
  BrewKpi,
  BrewPriority,
  BrewRequest,
  BrewTopicId,
} from "./types";

/**
 * The demo corpus.
 *
 * Morning Brew reads this instead of `GET /v1/staff/morning-brew`. Every figure
 * below is invented, and the surface says so in its colophon rather than
 * claiming a canonical read — a page of fabricated numbers under the sentence
 * "every figure is a count of canonical records" would be the one dishonest
 * thing this product could ship.
 *
 * The numbers are invented but not arbitrary. They describe one plausible
 * institution at one plausible moment, and they agree with each other: the
 * funnel narrows monotonically, yield is deposits over admits, housing
 * assignments never exceed deposits, and every insight's cohort is a real
 * subset of the roster it is stated against. A demo whose numbers contradict
 * each other teaches the audience to stop reading them.
 *
 * To put the live read back, restore `getStaffMorningBrew` and the contract
 * mappers in `data.ts` from the commit that introduced this file.
 */

const ROSTER = 9312;
const INCOMING = 3842;

/* --------------------------------------------------------------------- kpis */

const cohortOf = (key: string, label: string, clauses: string[], question: string) => ({
  key,
  label,
  filter: {},
  clauses,
  question,
});

/** `[yesterday, 7 days, 30 days, last year]`, in that order on every card. */
function comparisons(
  entries: [string, string, string | null, "up" | "down" | "flat", boolean][],
) {
  const labels = ["vs yesterday", "vs last 7 days", "vs last 30 days", "vs this time last year"];
  return entries.map(([delta, , percent, direction, favorable], index) => ({
    id: `c${index}`,
    label: labels[index],
    delta,
    percent,
    direction,
    favorable,
  }));
}

export const DEMO_KPIS: BrewKpi[] = [
  {
    id: "applications",
    topic: "admissions",
    label: "Applications",
    icon: "▤",
    value: 18432,
    format: "int",
    window: "Received for Fall 2027",
    basisLabel: null,
    basisPercent: null,
    cohort: cohortOf("applications", "applications received", ["term = Fall 2027"], "How many applications have we received for Fall 2027?"),
    comparisons: comparisons([
      ["+64", "", "0.3%", "up", true],
      ["+512", "", "2.9%", "up", true],
      ["+1,904", "", "11.5%", "up", true],
      ["+1,268", "", "7.4%", "up", true],
    ]),
    unavailable: false,
    detail: {
      definition: "Submitted applications for the Fall 2027 entry term, counted once per applicant.",
      segments: [
        { label: "First-year", value: 14208, percent: 77.1 },
        { label: "Transfer", value: 3106, percent: 16.9 },
        { label: "Readmit", value: 1118, percent: 6.1 },
      ],
      notes: [
        "Counted once per applicant, so a reopened application is not counted twice.",
        "Withdrawn applications stay in this figure; they leave at the admit step.",
      ],
    },
  },
  {
    id: "admitted",
    topic: "admissions",
    label: "Admitted",
    icon: "◈",
    value: 9684,
    format: "int",
    window: "Offers extended",
    basisLabel: "of 18,432 applications",
    basisPercent: 52.5,
    cohort: cohortOf("admitted", "admitted students", ["decision = admit"], "Which students have been admitted for Fall 2027?"),
    comparisons: comparisons([
      ["+38", "", "0.4%", "up", true],
      ["+286", "", "3.0%", "up", true],
      ["+1,442", "", "17.5%", "up", true],
      ["+402", "", "4.3%", "up", true],
    ]),
    unavailable: false,
    detail: {
      definition: "Applicants with an admit decision released for Fall 2027.",
      segments: [
        { label: "Released", value: 9684, percent: 100 },
        { label: "With an aid package", value: 8117, percent: 83.8 },
        { label: "Awaiting a package", value: 1567, percent: 16.2 },
      ],
      notes: [
        "An admit decision is counted from the moment it is released to the student.",
        "Deferred and waitlisted applicants are not in this figure.",
      ],
    },
  },
  {
    id: "accepted",
    topic: "admissions",
    label: "Offers accepted",
    icon: "✓",
    value: 4106,
    format: "int",
    window: "Accepted their offer",
    basisLabel: "of 9,684 admitted",
    basisPercent: 42.4,
    cohort: cohortOf("accepted", "students who accepted", ["offer status = accepted"], "Which admitted students have accepted their offer?"),
    comparisons: comparisons([
      ["+52", "", "1.3%", "up", true],
      ["+318", "", "8.4%", "up", true],
      ["+1,106", "", "36.8%", "up", true],
      ["+184", "", "4.7%", "up", true],
    ]),
    unavailable: false,
    detail: {
      definition: "Admitted students who have returned an acceptance for Fall 2027.",
      segments: [
        { label: "Accepted and deposited", value: 3842, percent: 93.6 },
        { label: "Accepted, deposit outstanding", value: 264, percent: 6.4 },
      ],
      notes: [
        "An acceptance without a deposit is still an acceptance; the two are counted separately.",
        "Acceptances withdrawn after the fact leave this figure on the day they are withdrawn.",
      ],
    },
  },
  {
    id: "deposits",
    topic: "admissions",
    label: "Net deposits",
    icon: "$",
    value: INCOMING,
    format: "int",
    window: "Enrollment deposits posted",
    basisLabel: "of 4,106 acceptances",
    basisPercent: 93.6,
    cohort: cohortOf("deposit_paid", "students with a posted deposit", ["deposit state = paid"], "Which students have paid their enrollment deposit?"),
    comparisons: comparisons([
      ["+47", "", "1.2%", "up", true],
      ["+228", "", "6.3%", "up", true],
      ["+1,012", "", "35.7%", "up", true],
      ["+286", "", "8.0%", "up", true],
    ]),
    unavailable: false,
    detail: {
      definition: "Students with a succeeded enrollment-deposit payment for Fall 2027, net of refunds.",
      segments: [
        { label: "Paid in full", value: 3596, percent: 93.6 },
        { label: "On a payment plan", value: 246, percent: 6.4 },
        { label: "Refunded this cycle", value: 63, percent: null },
      ],
      notes: [
        "Net of refunds: a deposit refunded after a withdrawal leaves this figure the same day.",
        "A deposit on an approved payment plan counts once the first instalment succeeds.",
      ],
    },
  },
  {
    id: "yield",
    topic: "admissions",
    label: "Yield",
    icon: "◎",
    value: 39.7,
    format: "percent",
    window: "Deposits over admits",
    basisLabel: "3,842 of 9,684",
    basisPercent: 39.7,
    cohort: cohortOf("yield", "yield on admitted students", ["deposit state = paid"], "What is our yield on admitted students this cycle?"),
    comparisons: comparisons([
      ["+0.2 pts", "", null, "up", true],
      ["+0.9 pts", "", null, "up", true],
      ["+3.1 pts", "", null, "up", true],
      ["+1.8 pts", "", null, "up", true],
    ]),
    unavailable: false,
    detail: {
      definition: "Deposited students as a share of admitted students, for the Fall 2027 entry term.",
      segments: [
        { label: "In state", value: 44, percent: 44.1 },
        { label: "Out of state", value: 33, percent: 33.4 },
        { label: "International", value: 28, percent: 27.6 },
      ],
      notes: [
        "Expressed in percentage points, so a move here is a move in the ratio, not in headcount.",
        "Segment figures are yield within each group, not shares of the class.",
      ],
    },
  },
  {
    id: "enrolled",
    topic: "admissions",
    label: "Enrolled students",
    icon: "⌂",
    value: ROSTER,
    format: "int",
    window: "Across all terms",
    basisLabel: null,
    basisPercent: null,
    cohort: cohortOf("roster", "students on the roster", ["enrollment status = active"], "How many students are enrolled right now?"),
    comparisons: comparisons([
      ["+12", "", "0.1%", "up", true],
      ["+64", "", "0.7%", "up", true],
      ["+188", "", "2.1%", "up", true],
      ["+214", "", "2.4%", "up", true],
    ]),
    unavailable: false,
    detail: {
      definition: "Students with an active enrollment record across every term in progress.",
      segments: [
        { label: "Undergraduate", value: 7104, percent: 76.3 },
        { label: "Graduate", value: 1908, percent: 20.5 },
        { label: "Non-degree", value: 300, percent: 3.2 },
      ],
      notes: [
        "The incoming class joins this figure at census, not at deposit.",
        "Leaves of absence are excluded for the term they cover.",
      ],
    },
  },
  {
    id: "aid_outstanding",
    topic: "financial_aid",
    label: "Aid files open",
    icon: "◆",
    value: 612,
    format: "int",
    window: "Awaiting a document or a review",
    basisLabel: "of 3,842 deposited",
    basisPercent: 15.9,
    cohort: cohortOf("aid_open", "students with an open aid file", ["aid file state != complete"], "Which deposited students have an open financial aid file?"),
    comparisons: comparisons([
      ["-18", "", "2.9%", "down", true],
      ["-96", "", "13.6%", "down", true],
      ["-284", "", "31.7%", "down", true],
      ["+74", "", "13.8%", "up", false],
    ]),
    unavailable: false,
    detail: {
      definition: "Deposited students whose aid file is missing a document or waiting on a review.",
      segments: [
        { label: "Missing a document", value: 341, percent: 55.7 },
        { label: "Awaiting review", value: 187, percent: 30.6 },
        { label: "Awaiting a correction", value: 84, percent: 13.7 },
      ],
      notes: [
        "A file is open until every required document is both received and accepted.",
        "Down is good here: the figure falls as files clear.",
      ],
    },
  },
  {
    id: "verification",
    topic: "financial_aid",
    label: "Verification queue",
    icon: "▦",
    value: 284,
    format: "int",
    window: "Selected files not yet cleared",
    basisLabel: "of 612 open aid files",
    basisPercent: 46.4,
    cohort: cohortOf("verification", "students selected for verification", ["verification = selected"], "Which students are selected for verification and not yet cleared?"),
    comparisons: comparisons([
      ["-9", "", "3.1%", "down", true],
      ["-41", "", "12.6%", "down", true],
      ["-118", "", "29.4%", "down", true],
      ["-206", "", "42.0%", "down", true],
    ]),
    unavailable: false,
    detail: {
      definition: "Students selected for federal verification whose file has not yet been cleared.",
      segments: [
        { label: "Under 7 days", value: 121, percent: 42.6 },
        { label: "7 to 14 days", value: 98, percent: 34.5 },
        { label: "Over 14 days", value: 65, percent: 22.9 },
      ],
      notes: [
        "Selection is the department's, not ours; clearing it is ours.",
        "The over-14-days band is the one that shows up in melt.",
      ],
    },
  },
  {
    id: "housing_assigned",
    topic: "housing",
    label: "Housing assigned",
    icon: "⌁",
    value: 3104,
    format: "int",
    window: "Deposited students with a bed",
    basisLabel: "of 3,842 deposited",
    basisPercent: 80.8,
    cohort: cohortOf("housed", "deposited students with an assignment", ["housing = assigned"], "Which deposited students still have no housing assignment?"),
    comparisons: comparisons([
      ["+86", "", "2.8%", "up", true],
      ["+402", "", "14.9%", "up", true],
      ["+1,268", "", "69.0%", "up", true],
      ["-142", "", "4.4%", "down", false],
    ]),
    unavailable: false,
    detail: {
      definition: "Deposited students with a confirmed room assignment for Fall 2027.",
      segments: [
        { label: "Residence halls", value: 2218, percent: 71.5 },
        { label: "Apartments", value: 604, percent: 19.5 },
        { label: "Student village", value: 282, percent: 9.0 },
      ],
      notes: [
        "738 deposited students have no assignment yet; that gap is the one to watch.",
        "An assignment is counted once the student has confirmed, not when it is offered.",
      ],
    },
  },
  {
    id: "blocked",
    topic: "student_success",
    label: "Students blocked",
    icon: "⚑",
    value: 1186,
    format: "int",
    window: "One or more open blockers",
    basisLabel: "of 3,842 deposited",
    basisPercent: 30.9,
    cohort: cohortOf("blocked", "students with an open blocker", ["blocker count > 0"], "Which deposited students have an open blocker?"),
    comparisons: comparisons([
      ["-24", "", "2.0%", "down", true],
      ["-138", "", "10.4%", "down", true],
      ["-402", "", "25.3%", "down", true],
      ["+96", "", "8.8%", "up", false],
    ]),
    unavailable: false,
    detail: {
      definition: "Deposited students with at least one unresolved requirement, hold, or missing document.",
      segments: [
        { label: "Aid document", value: 612, percent: 51.6 },
        { label: "Housing", value: 738, percent: 62.2 },
        { label: "Records or transcript", value: 418, percent: 35.2 },
      ],
      notes: [
        "Segments overlap: a student blocked on both aid and housing is counted in each.",
        "Down is good here.",
      ],
    },
  },
  {
    id: "transcripts",
    topic: "registrar",
    label: "Transcripts pending",
    icon: "▥",
    value: 418,
    format: "int",
    window: "Received, awaiting review",
    basisLabel: "of 3,842 deposited",
    basisPercent: 10.9,
    cohort: cohortOf("transcripts", "students with a transcript in review", ["transcript state = received"], "Which students have a transcript waiting on review?"),
    comparisons: comparisons([
      ["-31", "", "6.9%", "down", true],
      ["-127", "", "23.3%", "down", true],
      ["-286", "", "40.6%", "down", true],
      ["-64", "", "13.3%", "down", true],
    ]),
    unavailable: false,
    detail: {
      definition: "Final transcripts received from deposited students and not yet reviewed.",
      segments: [
        { label: "Under 3 days", value: 214, percent: 51.2 },
        { label: "3 to 7 days", value: 142, percent: 34.0 },
        { label: "Over 7 days", value: 62, percent: 14.8 },
      ],
      notes: [
        "A transcript is pending from receipt until a registrar accepts or rejects it.",
        "The queue has cleared 40% in thirty days; the over-7-days band is what remains.",
      ],
    },
  },
];

/* ----------------------------------------------------------------- insights */

export const DEMO_INSIGHTS: BrewInsight[] = [
  {
    id: "aid-holding-deposits",
    topic: "financial_aid",
    label: "Financial aid",
    title: "Aid verification is holding 284 deposited students",
    severity: "high",
    summary:
      "Selected files are clearing more slowly than documents arrive, and the backlog now sits entirely inside the deposited class.",
    scope: "284 of 3,842 deposited students",
    impactLabel: "Where it lands",
    impact: [
      { label: "284 students", tone: "negative" },
      { label: "65 over 14 days", tone: "negative" },
      { label: "Down 29% in 30 days", tone: "positive" },
    ],
    recommendedAction:
      "Clear the 65 files aged over 14 days first — they are the band that turns into melt.",
    impactLevel: "High",
    destination: "students",
    cohort: cohortOf("verification", "students selected for verification", ["verification = selected"], "Which deposited students are selected for verification and not yet cleared?"),
    detail: {
      narrative: [
        "284 deposited students are selected for federal verification and not yet cleared. The queue has fallen 29% over thirty days, so the process is working — but the remainder is ageing, and 65 files have now been open longer than fourteen days.",
        "The ageing band matters more than the total. Students whose aid is unresolved a fortnight before the first bill are the ones who quietly do not arrive, and they are counted as deposited right up until they do not.",
      ],
      drivers: [
        { label: "Missing tax documents", value: "148 students", note: "Nothing received from the family yet" },
        { label: "Awaiting review", value: "98 students", note: "Received, sitting in the reviewer queue" },
        { label: "Correction in flight", value: "38 students", note: "Sent back to the family once already" },
      ],
      breakdown: [
        { code: "aid_verification", title: "Federal verification", students: 284, requirements: 284, overdue: 65 },
        { code: "aid_tax_transcript", title: "Tax transcript", students: 148, requirements: 148, overdue: 41 },
        { code: "aid_correction", title: "Correction returned", students: 38, requirements: 38, overdue: 12 },
      ],
      breakdownNote: "A student can appear in more than one row when their file needs more than one thing.",
      actions: [
        { title: "Work the over-14-days band", detail: "65 files, oldest first", owner: "Financial Aid", due: "This week" },
        { title: "Second-contact the 148 with nothing received", detail: "Call rather than email; the email has been sent twice", owner: "Financial Aid", due: "Within 3 days" },
        { title: "Add a reviewer to the queue", detail: "98 files are received and simply waiting", owner: "Director of Financial Aid", due: "Today" },
      ],
      students: [
        { id: "s-1", name: "Sarah Johnson", program: "Nursing, BSN", note: "Tax transcript outstanding, 19 days" },
        { id: "s-2", name: "Michael Chen", program: "Computer Science, BS", note: "Awaiting review, 16 days" },
        { id: "s-3", name: "Priya Raman", program: "Business Administration, BBA", note: "Correction returned, 15 days" },
      ],
      studentsNote: "Three of 65 shown. The full cohort opens in the roster.",
      evidence: [
        "284 students carry a verification requirement in an unresolved state.",
        "65 of those requirements were created more than fourteen days ago.",
        "Every student in this cohort has a posted enrollment deposit.",
      ],
    },
  },
  {
    id: "housing-gap",
    topic: "housing",
    label: "Housing",
    title: "738 deposited students still have no bed",
    severity: "high",
    summary:
      "Assignments have moved quickly this month, but the unassigned group is now larger than the same point last year.",
    scope: "738 of 3,842 deposited students",
    impactLabel: "Where it lands",
    impact: [
      { label: "738 students", tone: "negative" },
      { label: "Behind last year", tone: "negative" },
      { label: "+1,268 in 30 days", tone: "positive" },
    ],
    recommendedAction:
      "Open the second-round selection window early for the 738 rather than waiting for the July date.",
    impactLevel: "High",
    destination: "students",
    cohort: cohortOf("unhoused", "deposited students without an assignment", ["housing != assigned"], "Which deposited students have no housing assignment?"),
    detail: {
      narrative: [
        "3,104 of 3,842 deposited students have confirmed a room. The remaining 738 have paid to attend and have nowhere to sleep, which is the single most reliable predictor of a summer withdrawal in this dataset.",
        "The month has gone well — 1,268 assignments confirmed — but the comparison that matters is against last year, and on that basis the unassigned group is 142 students larger.",
      ],
      drivers: [
        { label: "Never opened selection", value: "412 students", note: "No selection session recorded" },
        { label: "Started, did not confirm", value: "196 students", note: "Chose a room and left it unconfirmed" },
        { label: "Blocked by a hold", value: "130 students", note: "An aid or records hold prevents assignment" },
      ],
      breakdown: [
        { code: "housing_selection", title: "Selection not started", students: 412, requirements: 412, overdue: 412 },
        { code: "housing_confirm", title: "Selection not confirmed", students: 196, requirements: 196, overdue: 88 },
        { code: "housing_hold", title: "Held by another office", students: 130, requirements: 130, overdue: 130 },
      ],
      breakdownNote: "The 130 held students cannot act until the blocking office clears them.",
      actions: [
        { title: "Open second-round selection early", detail: "For the 412 who have never started", owner: "Residence Life", due: "This week" },
        { title: "Chase the 196 unconfirmed", detail: "One click each from a confirmed bed", owner: "Residence Life", due: "Within 3 days" },
        { title: "Clear the 130 holds", detail: "Mostly aid; a records handful", owner: "Financial Aid & Registrar", due: "This week" },
      ],
      students: [
        { id: "s-4", name: "Daniel Okafor", program: "Mechanical Engineering, BS", note: "Selection never opened" },
        { id: "s-5", name: "Elena Vasquez", program: "Psychology, BA", note: "Room chosen, not confirmed" },
        { id: "s-6", name: "Tom Whitfield", program: "History, BA", note: "Aid hold blocking assignment" },
      ],
      studentsNote: "Three of 738 shown. The full cohort opens in the roster.",
      evidence: [
        "738 students hold a posted deposit and no confirmed room assignment.",
        "412 of those have no housing selection session on record.",
        "The equivalent figure one year ago was 596.",
      ],
    },
  },
  {
    id: "transcripts-clearing",
    topic: "registrar",
    label: "Records",
    title: "The transcript queue has cleared 40% in thirty days",
    severity: "positive",
    summary:
      "Records is now turning transcripts around faster than they arrive, and only 62 files remain older than a week.",
    scope: "418 of 3,842 deposited students",
    impactLabel: "Where it lands",
    impact: [
      { label: "Down 286 in 30 days", tone: "positive" },
      { label: "62 over 7 days", tone: "neutral" },
    ],
    recommendedAction:
      "Hold the current reviewer count through July rather than reassigning; the gain is recent.",
    impactLevel: "Low",
    destination: "tasks",
    cohort: cohortOf("transcripts", "students with a transcript in review", ["transcript state = received"], "Which students have a transcript waiting on review?"),
    detail: {
      narrative: [
        "418 final transcripts are received and awaiting review, down from 704 a month ago. Intake has been steady, so the fall is a throughput gain rather than a drop in arrivals.",
        "What remains is mostly fresh: 214 files are under three days old. The 62 over seven days are the ones worth naming.",
      ],
      drivers: [
        { label: "Reviewed this month", value: "1,042 files", note: "Against 756 the month before" },
        { label: "Median turnaround", value: "2.4 days", note: "From 5.1 days a month ago" },
        { label: "Over seven days", value: "62 files", note: "Mostly international credentials" },
      ],
      breakdown: [
        { code: "transcript_domestic", title: "Domestic transcripts", students: 356, requirements: 356, overdue: 18 },
        { code: "transcript_international", title: "International credentials", students: 62, requirements: 62, overdue: 44 },
      ],
      breakdownNote: "International credentials carry a longer review by design; 44 are past even that.",
      actions: [
        { title: "Keep the reviewer count through July", detail: "The gain is one month old and not yet stable", owner: "Registrar", due: "Decision this week" },
        { title: "Route international credentials to the specialist queue", detail: "44 of 62 ageing files are in this group", owner: "Registrar", due: "This week" },
      ],
      students: [],
      studentsNote: "No individual students are named for a queue-level finding.",
      evidence: [
        "418 transcripts are in a received-not-reviewed state.",
        "1,042 transcripts moved out of that state in the last thirty days.",
        "62 have been in it for more than seven days.",
      ],
    },
  },
  {
    id: "melt-risk",
    topic: "student_success",
    label: "Student progress",
    title: "1,186 deposited students carry at least one open blocker",
    severity: "medium",
    summary:
      "Nearly a third of the incoming class has something unresolved, and 214 of them have three or more.",
    scope: "1,186 of 3,842 deposited students",
    impactLabel: "Where it lands",
    impact: [
      { label: "1,186 students", tone: "negative" },
      { label: "214 with 3+", tone: "negative" },
      { label: "Down 402 in 30 days", tone: "positive" },
    ],
    recommendedAction:
      "Work the 214 students with three or more blockers as one list rather than through each office separately.",
    impactLevel: "Medium",
    destination: "students",
    cohort: cohortOf("blocked", "deposited students with an open blocker", ["blocker count > 0"], "Which deposited students have an open blocker?"),
    detail: {
      narrative: [
        "1,186 of 3,842 deposited students have at least one unresolved requirement. Most have exactly one, and most of those will resolve themselves.",
        "The 214 students with three or more are a different group. Each of their blockers sits with a different office, so nobody owns the student — which is how a deposited student becomes a withdrawal without anyone deciding.",
      ],
      drivers: [
        { label: "One blocker", value: "742 students", note: "Usually resolves without contact" },
        { label: "Two blockers", value: "230 students", note: "Worth a single reminder" },
        { label: "Three or more", value: "214 students", note: "No single office sees the whole picture" },
      ],
      breakdown: [
        { code: "blocker_aid", title: "Aid document", students: 612, requirements: 784, overdue: 284 },
        { code: "blocker_housing", title: "Housing", students: 738, requirements: 738, overdue: 412 },
        { code: "blocker_records", title: "Records", students: 418, requirements: 418, overdue: 62 },
      ],
      breakdownNote: "Rows overlap; a student blocked in two offices appears in both.",
      actions: [
        { title: "Build the 214 as one worklist", detail: "One owner per student, not per blocker", owner: "Enrollment Leadership", due: "This week" },
        { title: "Call, do not email", detail: "This cohort has received four automated reminders already", owner: "Advising", due: "Within 5 days" },
      ],
      students: [
        { id: "s-7", name: "Aisha Bello", program: "Biology, BS", note: "Aid, housing and records all open" },
        { id: "s-8", name: "Marcus Lee", program: "Economics, BA", note: "Aid and housing open, 22 days" },
      ],
      studentsNote: "Two of 214 shown. The full cohort opens in the roster.",
      evidence: [
        "1,186 deposited students have one or more unresolved requirements.",
        "214 of those have three or more, across at least two offices.",
        "The cohort has fallen by 402 students in thirty days.",
      ],
    },
  },
];

/* ---------------------------------------------------------------- deadlines */

export const DEMO_DEADLINES: BrewDeadline[] = [
  {
    id: "d-aid-verification",
    topic: "financial_aid",
    kind: "requirement",
    kindLabel: "Requirement",
    code: "financial_aid_verification",
    title: "Submit verification documents",
    detail: "The last date a verification file can clear before the first bill is issued.",
    bucket: "overdue",
    dueLabel: "Jun 30",
    relativeLabel: "9 days overdue",
    students: 284,
    priority: "high",
    nextStep: "Call the 65 files aged over fourteen days before sending another reminder.",
    destination: "students",
  },
  {
    id: "d-housing-selection",
    topic: "housing",
    kind: "requirement",
    kindLabel: "Requirement",
    code: "housing_selection",
    title: "Choose a room for Fall 2027",
    detail: "Second-round selection closes; anything unchosen is assigned centrally.",
    bucket: "this_week",
    dueLabel: "Jul 12",
    relativeLabel: "in 3 days",
    students: 738,
    priority: "high",
    nextStep: "Open the window early for the 412 who have never started a selection.",
    destination: "students",
  },
  {
    id: "d-final-transcript",
    topic: "registrar",
    kind: "requirement",
    kindLabel: "Requirement",
    code: "official_transcript",
    title: "Send your final transcript",
    detail: "Required before registration opens for the incoming class.",
    bucket: "this_week",
    dueLabel: "Jul 15",
    relativeLabel: "in 6 days",
    students: 418,
    priority: "medium",
    nextStep: "Route the 44 ageing international credentials to the specialist queue.",
    destination: "tasks",
  },
  {
    id: "d-deposit-balance",
    topic: "admissions",
    kind: "offer_response",
    kindLabel: "Offer deadline",
    code: "enrollment_deposit",
    title: "Pay the enrollment deposit",
    detail: "264 accepted students have not yet posted a deposit.",
    bucket: "this_month",
    dueLabel: "Aug 1",
    relativeLabel: "in 23 days",
    students: 264,
    priority: "medium",
    nextStep: "These accepted without depositing; a single call converts most of them.",
    destination: "students",
  },
  {
    id: "d-immunization",
    topic: "student_success",
    kind: "requirement",
    kindLabel: "Requirement",
    code: "immunization",
    title: "Upload immunization records",
    detail: "Required before move-in; blocks the housing key handover.",
    bucket: "this_month",
    dueLabel: "Aug 8",
    relativeLabel: "in 30 days",
    students: 906,
    priority: "low",
    nextStep: "Batch reminder is scheduled; no manual work needed yet.",
    destination: "students",
  },
  {
    id: "d-orientation",
    topic: "student_success",
    kind: "requirement",
    kindLabel: "Requirement",
    code: "orientation",
    title: "Register for orientation",
    detail: "Session capacity is set from this count two weeks out.",
    bucket: "this_month",
    dueLabel: "Aug 14",
    relativeLabel: "in 36 days",
    students: 1204,
    priority: "low",
    nextStep: "Capacity is sufficient at the current rate.",
    destination: "students",
  },
];

/* ----------------------------------------------------------------- requests */

export const DEMO_REQUESTS: BrewRequest[] = [
  {
    id: "r-1",
    topic: "financial_aid",
    subject: "My verification has been open for three weeks",
    summary:
      "I sent the tax transcript on the 12th and the portal still says outstanding. My first bill is due in two weeks and I don't know if my aid is coming.",
    studentName: "Sarah Johnson",
    programName: "Nursing, BSN",
    status: "new",
    priority: "urgent",
    waitingLabel: "Waiting 2 days",
    assigneeName: null,
    destination: "messages",
  },
  {
    id: "r-2",
    topic: "housing",
    subject: "Can't confirm my room — it says I have a hold",
    summary:
      "I picked a room in the student village but confirming it gives me an error about a financial hold. I've paid my deposit.",
    studentName: "Tom Whitfield",
    programName: "History, BA",
    status: "open",
    priority: "high",
    waitingLabel: "Waiting 1 day",
    assigneeName: "Hana Dunmire",
    destination: "messages",
  },
  {
    id: "r-3",
    topic: "admissions",
    subject: "Deferring to spring — what happens to my deposit?",
    summary:
      "A family situation means I can't start in the fall. I'd like to defer rather than withdraw if the deposit carries over.",
    studentName: "Elena Vasquez",
    programName: "Psychology, BA",
    status: "waiting_on_student",
    priority: "medium",
    waitingLabel: "Waiting 4 days",
    assigneeName: "Leandro Hartigan",
    destination: "messages",
  },
  {
    id: "r-4",
    topic: "registrar",
    subject: "My international transcript hasn't been assessed",
    summary:
      "The credential evaluation was sent by WES three weeks ago. Registration opens next week and I can't pick classes.",
    studentName: "Daniel Okafor",
    programName: "Mechanical Engineering, BS",
    status: "open",
    priority: "high",
    waitingLabel: "Waiting 3 days",
    assigneeName: null,
    destination: "messages",
  },
  {
    id: "r-5",
    topic: "student_success",
    subject: "Which orientation session should I take?",
    summary: "I'm commuting and the two-day session is difficult. Is there a single-day option?",
    studentName: "Marcus Lee",
    programName: "Economics, BA",
    status: "open",
    priority: "low",
    waitingLabel: "Waiting 6 days",
    assigneeName: "Hana Dunmire",
    destination: "messages",
  },
];

/* --------------------------------------------------------------- priorities */

export const DEMO_PRIORITIES: BrewPriority[] = [
  {
    id: "p-aged-verification",
    topic: "financial_aid",
    title: "65 verification files aged over fourteen days",
    level: "High",
    detail:
      "Every one of these belongs to a deposited student whose first bill is issued in two weeks.",
    icon: "⚠",
    linkLabel: "Open the aid queue",
    destination: "tasks",
    breakdown: [
      { label: "Missing a document", value: "41" },
      { label: "Awaiting review", value: "16" },
      { label: "Correction returned", value: "8" },
    ],
    steps: [
      "Sort by age, oldest first.",
      "Call rather than email; this group has had four automated reminders.",
      "Escalate anything past twenty-one days to the Director.",
    ],
    window: "Today",
    count: 65,
    boardQuery: null,
  },
  {
    id: "p-unhoused",
    topic: "housing",
    title: "412 deposited students have never opened housing selection",
    level: "High",
    detail: "Second-round selection closes in three days, after which assignment goes central.",
    icon: "⌁",
    linkLabel: "Open the housing list",
    destination: "students",
    breakdown: [
      { label: "Never started", value: "412" },
      { label: "Started, unconfirmed", value: "196" },
      { label: "Blocked by a hold", value: "130" },
    ],
    steps: [
      "Open the second-round window early for the 412.",
      "Send the 196 unconfirmed a one-click confirm link.",
      "Hand the 130 held students to the office holding them.",
    ],
    window: "This week",
    count: 412,
    boardQuery: null,
  },
  {
    id: "p-multi-blocker",
    topic: "student_success",
    title: "214 students are blocked in three or more offices",
    level: "High",
    detail: "No single office sees the whole picture for these students, so nobody owns them.",
    icon: "⚑",
    linkLabel: "Build the worklist",
    destination: "tasks",
    breakdown: [
      { label: "Aid and housing", value: "128" },
      { label: "Aid, housing and records", value: "62" },
      { label: "Other combinations", value: "24" },
    ],
    steps: [
      "Assign one owner per student, not per blocker.",
      "Give each owner the full picture before they call.",
      "Review the list again on Friday.",
    ],
    window: "This week",
    count: 214,
    boardQuery: null,
  },
  {
    id: "p-unassigned-requests",
    topic: "financial_aid",
    title: "2 student requests have no owner",
    level: "Medium",
    detail: "Both are marked urgent and neither has been picked up.",
    icon: "✉",
    linkLabel: "Open Messages",
    destination: "messages",
    breakdown: [
      { label: "Urgent, unassigned", value: "2" },
      { label: "Waiting over 3 days", value: "3" },
    ],
    steps: ["Assign both this morning.", "Reply within the day; they are both about money."],
    window: "Today",
    count: 2,
    boardQuery: null,
  },
  {
    id: "p-deposit-outstanding",
    topic: "admissions",
    title: "264 accepted students have not posted a deposit",
    level: "Medium",
    detail: "They said yes and then stopped. The deadline is three weeks out.",
    icon: "$",
    linkLabel: "Open the list",
    destination: "students",
    breakdown: [
      { label: "Accepted over 14 days ago", value: "186" },
      { label: "Accepted this week", value: "78" },
    ],
    steps: ["Call the 186 who accepted more than a fortnight ago.", "Leave this week's cohort alone."],
    window: "This month",
    count: 264,
    boardQuery: null,
  },
];

/* ------------------------------------------------------------------ corpus */

export interface BrewDemoSource {
  generatedAt: string;
  windowLabel: string;
  students: number;
  synthesis: { headline: string; bullets: string[] };
  kpis: BrewKpi[];
  insights: BrewInsight[];
  deadlines: BrewDeadline[];
  requests: BrewRequest[];
  priorities: BrewPriority[];
  glance: {
    requests: number;
    requestsAwaitingReply: number;
    deadlinesOverdue: number;
    deadlinesThisWeek: number;
  };
  coverage: { notes: string[]; unsupported: { metric: string; reason: string }[] };
}

/**
 * `generatedAt` is resolved at read time rather than pinned, so the masthead
 * clock and the colophon date read as this morning whenever the demo is shown.
 */
export function demoBrewSource(now: Date = new Date()): BrewDemoSource {
  return {
    generatedAt: now.toISOString(),
    windowLabel: "the last 24 hours",
    students: ROSTER,
    synthesis: {
      headline: "47 deposits posted overnight, and the incoming class is 8% ahead of last year.",
      bullets: [
        "284 deposited students are still waiting on financial aid verification; 65 of those files are over a fortnight old.",
        "738 deposited students have no housing assignment, which is 142 more than at this point last year.",
        "The transcript queue has cleared 40% in thirty days and needs no attention this week.",
      ],
    },
    kpis: DEMO_KPIS,
    insights: DEMO_INSIGHTS,
    deadlines: DEMO_DEADLINES,
    requests: DEMO_REQUESTS,
    priorities: DEMO_PRIORITIES,
    glance: {
      requests: 47,
      requestsAwaitingReply: 12,
      deadlinesOverdue: 284,
      deadlinesThisWeek: 1156,
    },
    coverage: {
      notes: [
        "This briefing is running on demo data. Every figure is illustrative and no student record was read to produce it.",
        "Cohorts use the same definitions the staff assistant answers from, so any number here can be expanded into the students behind it.",
      ],
      unsupported: [
        { metric: "Predicted melt", reason: "A forecast is not a count, and this surface only shows counts." },
        { metric: "Revenue at risk", reason: "The platform holds no tuition schedule to price a cohort against." },
        { metric: "Likelihood to enroll", reason: "No model scores individual students, by design." },
      ],
    },
  };
}
