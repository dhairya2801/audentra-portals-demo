/**
 * Aster University's institutional profile, as the demo environment publishes it.
 *
 * The platform records a tenant's name, branding, contacts and academic context,
 * and nothing else about the institution — no endowment, no discount rate, no
 * funnel. Those are the facts a demo has to be able to state out loud, because
 * every operational number elsewhere in the staff portal is derived from them:
 * 26 advisers splitting an admitted class of 1,330 is why a caseload is 27, and
 * a 54.2% discount is why one melted student costs $19,050 rather than $41,600.
 *
 * So this file is the mockup's source of record, transcribed from
 * `aster-university-profile.docx` and held here rather than fetched, exactly as
 * the portrait set in `components/staff-portrait.tsx` is held rather than
 * fetched. When the platform learns to publish an institutional profile, this
 * becomes the shape the page reads and the numbers come from the API instead.
 *
 * Every figure below is stated as of **June 24, 2027** — 60 days before classes
 * and 23 days after the deposit deadline, which is the day the demo is set on.
 */

export const AS_OF = "June 24, 2027";

export const OVERVIEW = {
  founded: 1897,
  place: "Ashfield, New York",
  blurb:
    "Private nonprofit university founded in 1897 in Ashfield, in upstate New York, about two hours from Albany. Residential 183-acre main campus, plus a smaller urban campus for evening professional programs.",
  posture:
    "Mid-sized, minimally selective, and tuition-dependent — the most common profile among American private institutions, and the one most exposed to summer melt.",
} as const;

/** The attribute table, in the order it is read: what the institution is, then how big, then how selective, then what it is worth. */
export const ATTRIBUTES: ReadonlyArray<{ label: string; value: string; note?: string }> = [
  { label: "Control", value: "Private, nonprofit" },
  { label: "Carnegie classification", value: "Master’s Colleges & Universities", note: "Larger Programs" },
  { label: "Admit rate", value: "71.9%", note: "1,330 admitted of 1,850 applications." },
  { label: "Student–faculty ratio", value: "14:1" },
  { label: "Endowment", value: "$218M" },
  { label: "First-years on campus", value: "82%", note: "The residential half of the melt risk." },
];

export const ACADEMICS = {
  blurb:
    "Four schools, 61 undergraduate programs, 22 graduate programs. Bachelor’s degrees require 120 credits across a common core, area requirements, and a major.",
  calendar:
    "Semester calendar: fall from late August to mid-December, spring from mid-January to early May, plus two summer sessions.",
  undergraduatePrograms: 61,
  graduatePrograms: 22,
  credits: 120,
};

/** Undergraduates by school. `share` is of the 4,180 undergraduate total, and is what the bar draws. */
export const SCHOOLS: ReadonlyArray<{
  name: string;
  undergraduates: number;
  programs: number;
  anchor: string;
}> = [
  { name: "College of Arts & Sciences", undergraduates: 1780, programs: 28, anchor: "Computer Science" },
  { name: "School of Business", undergraduates: 1140, programs: 12, anchor: "Finance" },
  { name: "School of Health Professions", undergraduates: 820, programs: 11, anchor: "Nursing" },
  { name: "School of Education", undergraduates: 440, programs: 10, anchor: "Childhood Education" },
];

export const OFFICES_BLURB =
  "A question is answered by the office that owns the decision. Enrollment Management covers Admissions, Financial Aid, and Student Accounts. The Registrar and Student Health report to the provost, and together they own two thirds of what blocks registration.";

/** Who owns which decision, and how many people that office has to make it with. */
export const OFFICES: ReadonlyArray<{ name: string; staff: number; owns: string }> = [
  { name: "Admissions", staff: 26, owns: "the offer, and the relationship through deposit" },
  { name: "Registrar", staff: 14, owns: "academic record, identity, transcripts, catalog" },
  { name: "Financial Aid", staff: 11, owns: "aid packaging, federal verification" },
  { name: "Student Accounts", staff: 9, owns: "billing, deposits, payment plans" },
  { name: "Student Health", staff: 7, owns: "immunization and health clearance" },
  { name: "Housing & Residence Life", staff: 12, owns: "housing plans and room assignments" },
  { name: "Student Life", staff: 15, owns: "events and student organizations" },
  { name: "Accessibility Services", staff: 5, owns: "accommodations" },
];

export const CASELOAD_NOTE =
  "Twenty-six enrollment advisors split the incoming class, roughly 27 admitted students each by program. That split is what appears in the operational screens.";

/**
 * The published price, and then what is actually paid. The three components add
 * to the cost of attendance, so they are drawn as a ladder that sums; the
 * discount, the net and the aid share are what the ladder resolves to and sit
 * apart from it.
 */
export const COST_LADDER: ReadonlyArray<{ label: string; amount: number }> = [
  { label: "Tuition", amount: 41600 },
  { label: "Fees", amount: 1980 },
  { label: "Room and board", amount: 15400 },
];

export const COST_TOTAL = { label: "Estimated cost of attendance", amount: 62300 };

export const AID_FACTS: ReadonlyArray<{ label: string; value: string; note: string }> = [
  {
    label: "Average institutional discount",
    value: "54.2%",
    note: "First-year students. The share of published tuition the institution funds itself.",
  },
  {
    label: "Average net tuition",
    value: "$19,050",
    note: "First-year students. What one enrolled student is actually worth to the budget.",
  },
  { label: "Students receiving some aid", value: "94%", note: "Institutional, federal or state." },
  {
    label: "Enrollment deposit",
    value: "$500",
    note: "Waivable on demonstrated need, so it never decides a student on its own.",
  },
];

export const DISCOUNT_NOTE =
  "A 54% discount rate is the financial pressure point. Every student lost to summer melt costs about $19,050 in net revenue the budget already booked.";

export const CYCLE_BLURB =
  "Rolling admission, with decisions released continuously from October through June. Acceptances and deposits spread across the calendar, and a standing group of admitted students never responds at all.";

/**
 * The Fall 2027 calendar. `done` is measured against `AS_OF` and is stated here
 * rather than computed: the demo's today is a fixed date in the fixture, and a
 * page that read the wall clock would drift out of agreement with every other
 * number on it.
 */
export const MILESTONES: ReadonlyArray<{ label: string; date: string; done: boolean }> = [
  { label: "Applications open", date: "August 1, 2026", done: true },
  { label: "First decisions released", date: "October 15, 2026", done: true },
  { label: "Financial aid priority date", date: "March 1, 2027", done: true },
  { label: "Deposit deadline", date: "June 1, 2027", done: true },
  { label: "Financial aid verification due", date: "June 15, 2027", done: true },
  { label: "Immunization record due", date: "June 15, 2027", done: true },
  { label: "Final transcript due", date: "June 20, 2027", done: true },
  { label: "ID document due", date: "July 19, 2027", done: false },
  { label: "Orientation", date: "July 19–21, 2027", done: false },
  { label: "Room assignments released", date: "July 25, 2027", done: false },
  { label: "Move-in", date: "August 20, 2027", done: false },
  { label: "Classes begin", date: "August 23, 2027", done: false },
];

/**
 * The funnel, stage by stage. `base` names what the rate is a share *of*, which
 * is the whole difficulty with a funnel: 62.6% is deposits over acceptances, not
 * over applications, and a bar drawn against the wrong base tells the opposite
 * story. `tone` is the colour budget — amber is what someone has to act on.
 */
export type FunnelTone = "neutral" | "good" | "watch";

export const FUNNEL: ReadonlyArray<{
  stage: string;
  students: number;
  base: number | null;
  rate: string | null;
  baseLabel: string | null;
  tone: FunnelTone;
  note?: string;
}> = [
  { stage: "Applications", students: 1850, base: null, rate: null, baseLabel: null, tone: "neutral" },
  { stage: "Admitted", students: 1330, base: 1850, rate: "71.9%", baseLabel: "of applications", tone: "neutral" },
  { stage: "Accepted an offer", students: 986, base: 1330, rate: "74.1%", baseLabel: "of admitted", tone: "good" },
  { stage: "Deposit paid", students: 617, base: 986, rate: "62.6%", baseLabel: "of acceptances", tone: "good" },
  {
    stage: "Deposit outstanding",
    students: 369,
    base: 986,
    rate: "37.4%",
    baseLabel: "of acceptances",
    tone: "watch",
    note: "Accepted the offer and has not paid.",
  },
  {
    stage: "Enrollment ready",
    students: 224,
    base: 617,
    rate: "36.3%",
    baseLabel: "of deposits",
    tone: "watch",
    note: "Nothing outstanding. Everyone else still owes a document, a record or a decision.",
  },
  {
    stage: "Has an outstanding requirement",
    students: 762,
    base: 986,
    rate: "77.3%",
    baseLabel: "of acceptances",
    tone: "watch",
  },
  {
    stage: "Projected enrollment",
    students: 555,
    base: 1330,
    rate: "41.7%",
    baseLabel: "final yield",
    tone: "neutral",
  },
];

export const PROJECTION_NOTE =
  "The projection carries an assumption: that deposits keep arriving through August. At last cycle’s 11.1% melt rate, today’s 617 deposits alone yield 549 enrolled, and reaching 570 would require 641. The 555 projection sits between the two, and the deposit rate is currently running 6.1 points behind last year.";

export const COMPOSITION: ReadonlyArray<{ label: string; share: number }> = [
  { label: "First generation", share: 31 },
  { label: "Pell-eligible", share: 38 },
  { label: "Out of state", share: 27 },
  { label: "International", share: 6 },
  { label: "Living on campus", share: 82 },
];

export const LARGEST_MAJORS = [
  "Nursing",
  "Computer Science",
  "Business Administration",
  "Psychology",
] as const;

export const PELL_NOTE =
  "Pell eligibility at 38% is why federal verification reaches 234 students, and why an aid delay turns into melt faster than a paperwork delay does.";

/**
 * Who owns this record. The platform names offices, not people, so the person
 * seated on this page is the demo's — the same rule the student portal's office
 * contacts follow (`components/office-contact.ts`), and for the same reason: the
 * bar in a summary panel seats a person, and an office never gets a face.
 */
export const PROFILE_OWNER = {
  label: "Your institutional research contact",
  name: "Anjali Rao",
  office: "Institutional Research",
  photo: "/images/staff/anjali-rao.jpg",
  email: "institutional.research@aster.example.edu",
};
