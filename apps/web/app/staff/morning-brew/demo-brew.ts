import type {
  BrewInsight,
  BrewKpi,
  BrewMeeting,
  BrewPriority,
  BrewReader,
  BrewRequest,
} from "./types";

/**
 * The demo corpus — Aster University, Fall 2025 cycle, read at 7:30 AM ET on
 * Tuesday May 20, 2025.
 *
 * Morning Brew reads this instead of `GET /v1/staff/morning-brew`. Every figure
 * below is invented, and the surface says so in its colophon rather than
 * claiming a canonical read — a page of fabricated numbers under the sentence
 * "every figure is a count of canonical records" would be the one dishonest
 * thing this product could ship.
 *
 * The numbers are invented but not arbitrary. They agree with each other:
 *
 *  - the funnel narrows monotonically — applications, then admits, then
 *    deposits — and no stage ever exceeds the one above it;
 *  - every rate is its own two figures. Deposit rate is deposits ÷ admits;
 *    yield is projected enrolled ÷ admits. Neither is typed in by hand;
 *  - every progress bar is its figure ÷ its target, rounded once;
 *  - a finding's "Potential Impact" chips are the arithmetic of the sentence
 *    directly above them. $19.5K of net tuition per enrolled student is the
 *    single conversion the whole brief uses, so 82 deposits is $1.6M wherever
 *    it appears.
 *
 * Two conventions worth stating, because a reader will notice both:
 *
 *  - **Counts can fall.** Deposits paid is net of withdrawals and refunds, so a
 *    day with 27 more withdrawals than deposits reads as −27. It is a level,
 *    not a running total.
 *  - **Rates move in points.** A rate's comparison is stated in points ("−1.6pp")
 *    and never as a percentage of a percentage, which is a number nobody can
 *    hold in their head.
 *
 * To put the live read back, restore `getStaffMorningBrew` and the contract
 * mappers in `data.ts` from the commit that introduced this file.
 */

/* ------------------------------------------------------------------ funnel */

const APPLICATIONS = 14782;
const ADMITS = 6125;
/** Net of withdrawals and refunds, which is why it can fall day to day. */
const DEPOSITS = 2450;
/** Deposits, less the melt observed at the same point in the Fall 2024 cycle. */
const PROJECTED_ENROLLED = 1452;
/** The one conversion the brief uses, in dollars of net tuition per student. */
const NET_TUITION_PER_STUDENT = 19500;

const rate = (numerator: number, denominator: number) =>
  Number(((numerator / denominator) * 100).toFixed(1));

const DEPOSIT_RATE = rate(DEPOSITS, ADMITS);
const YIELD = rate(PROJECTED_ENROLLED, ADMITS);

/**
 * The morning the brief describes. Pinned rather than resolved from the clock:
 * every relative label below ("11 days to go", "due by May 31") is measured
 * from this date, and a brief whose masthead said this afternoon would
 * contradict its own calendar.
 */
export const DEMO_GENERATED_AT = "2025-05-20T11:30:00.000Z";

export const DEMO_READER: BrewReader = {
  name: "Vivian Hale",
  firstName: "Vivian",
  role: "Vice President for Enrollment Management",
  email: "vivian.hale@aster.example.edu",
};

/* ------------------------------------------------------------------- lines */

/**
 * A small deterministic generator, so a line is drawn the same on the server as
 * in the browser. `Math.random` here would hydrate one shape over another.
 */
function noise(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/**
 * A run of daily readings from `from` to `to`.
 *
 * The daily steps are randomised and then rescaled so the run lands exactly on
 * `to`, which does two things at once: the line wobbles the way a real daily
 * count does — some days flat, some down — and it still ends on the number
 * printed above it. A smooth interpolation would be visibly synthetic; an
 * unconstrained walk would drift off its own headline.
 */
function walk(
  count: number,
  from: number,
  to: number,
  wobble: number,
  seed: number,
  decimals = 0,
): number[] {
  if (count < 2) return [Number(to.toFixed(decimals))];
  const random = noise(seed);
  const steps = Array.from({ length: count - 1 }, () => 1 + (random() - 0.5) * 2 * wobble);
  const total = steps.reduce((sum, step) => sum + step, 0);
  const points = [from];
  let travelled = 0;
  for (const step of steps) {
    travelled += step;
    points.push(from + ((to - from) * travelled) / total);
  }
  // The endpoints are stated, not generated: a line has to start and finish on
  // figures the brief can name.
  points[0] = from;
  points[points.length - 1] = to;
  return points.map((value) => Number(value.toFixed(decimals)));
}

/** Days of history the chart draws, ending on today. */
const HISTORY_DAYS = 22;
/** Days of forecast past today. History plus forecast is the 30-day axis. */
const FORECAST_DAYS = 9;

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
  entries: [string, string | null, "up" | "down" | "flat", boolean][],
) {
  const labels = ["vs yesterday", "vs last 7 days", "vs last 30 days", "vs this time last year"];
  return entries.map(([delta, percent, direction, favorable], index) => ({
    id: `c${index}`,
    label: labels[index],
    delta,
    percent,
    direction,
    favorable,
  }));
}

/** Progress to target, rounded once so the bar and the number cannot disagree. */
const progress = (value: number, target: number) => Math.round((value / target) * 100);

const INT = new Intl.NumberFormat("en-US");

export const DEMO_KPIS: BrewKpi[] = [
  {
    id: "applications",
    topic: "admissions",
    label: "Applications",
    icon: "applications",
    value: APPLICATIONS,
    display: INT.format(APPLICATIONS),
    window: "Applications received for Fall 2025",
    series: walk(HISTORY_DAYS, 12483, APPLICATIONS, 1.5, 11),
    previousYear: walk(HISTORY_DAYS + FORECAST_DAYS, 11740, 15310, 1.4, 12),
    forecast: walk(FORECAST_DAYS, APPLICATIONS, 16040, 0.7, 13),
    target: 20000,
    targetDisplay: "20,000",
    progressPercent: progress(APPLICATIONS, 20000),
    dueLabel: "Due by Jun 30",
    trendNote:
      "Last week's pace reaches 16,040 by month end — short of 20,000.",
    cohort: cohortOf(
      "applications",
      "Fall 2025 applicants",
      ["term = Fall 2025", "application state = submitted"],
      "How many students have applied for Fall 2025, and from where?",
    ),
    comparisons: comparisons([
      ["3.2%", "+458", "up", true],
      ["6.9%", "+954", "up", true],
      ["18.4%", "+2,299", "up", true],
      ["9.6%", "+1,296", "up", true],
    ]),
    unavailable: false,
    detail: {
      definition:
        "Submitted applications for the Fall 2025 entry term, counted once per applicant.",
      segments: [
        { label: "First-year", value: 11318, percent: 76.6 },
        { label: "Transfer", value: 2604, percent: 17.6 },
        { label: "Readmit and other", value: 860, percent: 5.8 },
      ],
      notes: [
        "Volume is 9.6% ahead of the same day in the Fall 2024 cycle.",
        "Growth is concentrated in transfer, which is 14% ahead year over year.",
      ],
    },
  },
  {
    id: "admits",
    topic: "admissions",
    label: "Admits",
    icon: "admits",
    value: ADMITS,
    display: INT.format(ADMITS),
    window: "Offers released for Fall 2025",
    series: walk(HISTORY_DAYS, 5037, ADMITS, 1.4, 21),
    previousYear: walk(HISTORY_DAYS + FORECAST_DAYS, 4820, 6640, 1.3, 22),
    forecast: walk(FORECAST_DAYS, ADMITS, 6710, 0.6, 23),
    target: 8500,
    targetDisplay: "8,500",
    progressPercent: progress(ADMITS, 8500),
    dueLabel: "Due by Jun 15",
    trendNote:
      "At roughly 65 decisions a day the round closes near 6,710, short of 8,500.",
    cohort: cohortOf(
      "admits",
      "admitted students",
      ["term = Fall 2025", "decision = admit"],
      "Which students have been admitted for Fall 2025?",
    ),
    comparisons: comparisons([
      ["2.8%", "+167", "up", true],
      ["5.9%", "+341", "up", true],
      ["21.6%", "+1,088", "up", true],
      ["4.4%", "+258", "up", true],
    ]),
    unavailable: false,
    detail: {
      definition: "Applicants holding a released admit decision for Fall 2025.",
      segments: [
        { label: "First-year", value: 4712, percent: 76.9 },
        { label: "Transfer", value: 1108, percent: 18.1 },
        { label: "Readmit and other", value: 305, percent: 5.0 },
      ],
      notes: [
        "The admit rate is 41.4% of applications, against 42.1% a year ago.",
        "1,108 transfer admits is the largest transfer round Aster has released.",
      ],
    },
  },
  {
    id: "deposits",
    topic: "enrollment",
    label: "Deposit Paid",
    icon: "deposit",
    value: DEPOSITS,
    display: INT.format(DEPOSITS),
    window: "Enrollment deposits held, net of withdrawals",
    series: walk(HISTORY_DAYS, 1932, DEPOSITS, 2.2, 31),
    previousYear: walk(HISTORY_DAYS + FORECAST_DAYS, 2104, 2884, 1.8, 32),
    forecast: walk(FORECAST_DAYS, DEPOSITS, 2716, 0.9, 33),
    target: 3200,
    targetDisplay: "3,200",
    progressPercent: progress(DEPOSITS, 3200),
    dueLabel: "Due by May 31",
    trendNote:
      "Flat for six days; the current pace reaches about 2,716 by May 31.",
    cohort: cohortOf(
      "deposit_paid",
      "students with a posted deposit",
      ["deposit state = paid"],
      "Which admitted students have paid their enrollment deposit?",
    ),
    comparisons: comparisons([
      ["1.1%", "−27", "down", false],
      ["4.2%", "+99", "up", true],
      ["26.8%", "+518", "up", true],
      ["3.6%", "−92", "down", false],
    ]),
    unavailable: false,
    detail: {
      definition:
        "Admitted students holding a succeeded enrollment deposit for Fall 2025, net of refunds and withdrawals.",
      segments: [
        { label: "Residential", value: 1612, percent: 65.8 },
        { label: "Commuter", value: 838, percent: 34.2 },
        { label: "Registered for orientation", value: 1504, percent: 61.4 },
      ],
      notes: [
        "Yesterday's fall of 27 is 41 withdrawals against 14 new deposits.",
        "The commuter half of this figure is the cohort whose deposit rate fell 6.4% in seven days.",
      ],
    },
  },
  {
    id: "deposit-rate",
    topic: "enrollment",
    label: "Deposit Rate",
    icon: "rate",
    value: DEPOSIT_RATE,
    display: `${DEPOSIT_RATE.toFixed(1)}%`,
    window: "Deposits as a share of admits",
    series: walk(HISTORY_DAYS, 38.4, DEPOSIT_RATE, 1.9, 41, 1),
    previousYear: walk(HISTORY_DAYS + FORECAST_DAYS, 41.9, 43.4, 1.6, 42, 1),
    forecast: walk(FORECAST_DAYS, DEPOSIT_RATE, 40.5, 0.8, 43, 1),
    target: 45,
    targetDisplay: "45.0%",
    progressPercent: progress(DEPOSIT_RATE, 45),
    dueLabel: "Due by May 31",
    trendNote:
      "Admits are growing faster than deposits, so the rate falls even on days the count rises.",
    cohort: cohortOf(
      "deposit_rate",
      "admitted students by deposit state",
      ["term = Fall 2025", "decision = admit"],
      "Which admitted students have not yet paid a deposit?",
    ),
    comparisons: comparisons([
      ["1.6pp", null, "down", false],
      ["2.4pp", null, "down", false],
      ["1.9pp", null, "up", true],
      ["3.5pp", null, "down", false],
    ]),
    unavailable: false,
    detail: {
      definition: "Deposits paid divided by admits released, for the Fall 2025 entry term.",
      segments: [
        { label: "Residential admits", value: 4318, percent: 37.3 },
        { label: "Commuter admits", value: 1807, percent: 46.4 },
        { label: "Transfer admits", value: 1108, percent: 33.8 },
      ],
      notes: [
        "40.0% today against 43.5% at the same point last cycle.",
        "The commuter share is still the highest of the three and is the one that moved this week.",
      ],
    },
  },
  {
    id: "net-tuition",
    topic: "enrollment",
    label: "Net Tuition (Proj.)",
    icon: "tuition",
    value: 98.4,
    display: "$98.4M",
    window: "Projected net tuition revenue, Fall 2025 term",
    series: walk(HISTORY_DAYS, 80.4, 98.4, 1.7, 51, 1),
    previousYear: walk(HISTORY_DAYS + FORECAST_DAYS, 84.6, 108.2, 1.5, 52, 1),
    forecast: walk(FORECAST_DAYS, 98.4, 104.6, 0.6, 53, 1),
    target: 110,
    targetDisplay: "$110.0M",
    progressPercent: progress(98.4, 110),
    dueLabel: "Due by Aug 15",
    trendNote:
      "This line tracks deposits with a two-day lag; the current pace lands near $104.6M.",
    cohort: cohortOf(
      "net_tuition",
      "enrolled students by aid package",
      ["term = Fall 2025"],
      "What is the projected net tuition by cohort for Fall 2025?",
    ),
    comparisons: comparisons([
      ["1.3%", "+$1.3M", "up", true],
      ["3.8%", "+$3.6M", "up", true],
      ["22.4%", "+$18.0M", "up", true],
      ["2.9%", "−$2.9M", "down", false],
    ]),
    unavailable: false,
    detail: {
      definition:
        "Gross tuition less institutional aid across all Fall 2025 cohorts, projected from deposits held and last cycle's observed melt.",
      segments: [
        { label: "Continuing students", value: 70, percent: 71.1 },
        { label: "Entering class", value: 28, percent: 28.5 },
        { label: "Other", value: 0.4, percent: 0.4 },
      ],
      notes: [
        `The entering class carries $${(NET_TUITION_PER_STUDENT / 1000).toFixed(1)}K of net tuition per enrolled student.`,
        "Every impact figure in the findings above uses that same per-student conversion.",
      ],
    },
  },
  {
    id: "yield",
    topic: "enrollment",
    label: "Yield",
    icon: "yield",
    value: YIELD,
    display: `${YIELD.toFixed(1)}%`,
    window: "Projected enrolled as a share of admits",
    series: walk(HISTORY_DAYS, 21.5, YIELD, 1.8, 61, 1),
    previousYear: walk(HISTORY_DAYS + FORECAST_DAYS, 24.7, 25.9, 1.5, 62, 1),
    forecast: walk(FORECAST_DAYS, YIELD, 24.1, 0.7, 63, 1),
    target: 26,
    targetDisplay: "26.0%",
    progressPercent: progress(YIELD, 26),
    dueLabel: "Due by Aug 15",
    trendNote:
      "Held within half a point for nine days; the 26.0% target needs 140 more deposits.",
    cohort: cohortOf(
      "yield",
      "admitted students projected to enrol",
      ["term = Fall 2025", "decision = admit"],
      "Which admitted students are projected to enrol for Fall 2025?",
    ),
    comparisons: comparisons([
      ["0.6pp", null, "down", false],
      ["0.9pp", null, "down", false],
      ["2.2pp", null, "up", true],
      ["1.8pp", null, "down", false],
    ]),
    unavailable: false,
    detail: {
      definition:
        "Projected enrolled students divided by admits, using the melt rate observed in the Fall 2024 cycle.",
      segments: [
        { label: "Projected enrolled", value: PROJECTED_ENROLLED, percent: YIELD },
        { label: "Deposited", value: DEPOSITS, percent: DEPOSIT_RATE },
        { label: "Projected melt from deposits", value: DEPOSITS - PROJECTED_ENROLLED, percent: 40.7 },
      ],
      notes: [
        "Melt is last cycle's observed rate, not a per-student model. No student here carries a score.",
        "23.7% today against 25.5% at the same point last cycle.",
      ],
    },
  },
  {
    id: "transfer-applications",
    topic: "admissions",
    label: "Transfer Applications",
    icon: "students",
    value: 2604,
    display: "2,604",
    window: "Transfer applications received for Fall 2025",
    series: walk(HISTORY_DAYS, 2118, 2604, 2, 71),
    previousYear: walk(HISTORY_DAYS + FORECAST_DAYS, 1932, 2402, 1.7, 72),
    forecast: walk(FORECAST_DAYS, 2604, 2812, 0.8, 73),
    target: 2400,
    targetDisplay: "2,400",
    progressPercent: progress(2604, 2400),
    dueLabel: "Target met May 14",
    trendNote:
      "Past target six days ago and still climbing, 14% ahead of last year.",
    cohort: cohortOf(
      "transfer_applications",
      "transfer applicants",
      ["term = Fall 2025", "applicant type = transfer"],
      "Which transfer applicants are waiting on a credit evaluation?",
    ),
    comparisons: comparisons([
      ["2.1%", "+54", "up", true],
      ["5.4%", "+133", "up", true],
      ["19.7%", "+429", "up", true],
      ["14.0%", "+320", "up", true],
    ]),
    unavailable: false,
    detail: {
      definition: "Submitted transfer applications for the Fall 2025 entry term.",
      segments: [
        { label: "Business", value: 812, percent: 31.2 },
        { label: "Health Sciences", value: 705, percent: 27.1 },
        { label: "All other programs", value: 1087, percent: 41.7 },
      ],
      notes: [
        "Business and Health Sciences are 58.3% of the transfer file between them.",
        "Credit evaluations are running nine days behind the application date.",
      ],
    },
  },
  {
    id: "verification-queue",
    topic: "financial_aid",
    label: "Verification Queue",
    icon: "verification",
    value: 324,
    display: "324",
    window: "Aid files selected and not yet cleared",
    series: walk(HISTORY_DAYS, 196, 324, 2.4, 81),
    previousYear: walk(HISTORY_DAYS + FORECAST_DAYS, 262, 214, 2, 82),
    forecast: walk(FORECAST_DAYS, 324, 372, 1, 83),
    // A queue is not a goal. There is no target here on purpose: "88% of the
    // way to 150 open files" would be a sentence about a number nobody set.
    target: null,
    targetDisplay: null,
    progressPercent: null,
    dueLabel: null,
    trendNote:
      "At 30 cleared a day against 38 arriving, the queue reaches roughly 372 by month end.",
    cohort: cohortOf(
      "verification_open",
      "students with an open verification file",
      ["aid state = verification_selected"],
      "Which students have an open financial aid verification?",
    ),
    comparisons: comparisons([
      ["2.5%", "+8", "up", false],
      ["18.0%", "+49", "up", false],
      ["46.6%", "+103", "up", false],
      ["51.4%", "+110", "up", false],
    ]),
    unavailable: false,
    detail: {
      definition:
        "Students selected for federal verification whose file is not yet cleared, counted once per student.",
      segments: [
        { label: "Awaiting documents from the family", value: 197, percent: 60.8 },
        { label: "Awaiting review by Financial Aid", value: 88, percent: 27.2 },
        { label: "Correction returned to the family", value: 39, percent: 12.0 },
      ],
      notes: [
        "312 of the 324 have not yet paid a deposit.",
        "National selections fell this cycle; this rise is a local packaging backlog.",
      ],
    },
  },
  {
    id: "aid-packages",
    topic: "financial_aid",
    label: "Aid Packages Sent",
    icon: "aid",
    value: 1880,
    display: "1,880",
    window: "Complete aid packages released to families",
    series: walk(HISTORY_DAYS, 1204, 1880, 1.6, 91),
    previousYear: walk(HISTORY_DAYS + FORECAST_DAYS, 1388, 2240, 1.4, 92),
    forecast: walk(FORECAST_DAYS, 1880, 2126, 0.7, 93),
    target: 2600,
    targetDisplay: "2,600",
    progressPercent: progress(1880, 2600),
    dueLabel: "Due by Jun 6",
    trendNote:
      "Packaging runs at about 30 a day; the June 6 date needs 43.",
    cohort: cohortOf(
      "aid_packaged",
      "students with a released aid package",
      ["aid state = packaged"],
      "Which admitted students are still waiting on an aid package?",
    ),
    comparisons: comparisons([
      ["1.6%", "+30", "up", true],
      ["6.9%", "+121", "up", true],
      ["24.3%", "+368", "up", true],
      ["8.7%", "−179", "down", false],
    ]),
    unavailable: false,
    detail: {
      definition:
        "Admitted students who have received a complete institutional aid package for Fall 2025.",
      segments: [
        { label: "Packaged and deposited", value: 1298, percent: 69.0 },
        { label: "Packaged, no deposit", value: 582, percent: 31.0 },
        { label: "Blocked behind verification", value: 324, percent: null },
      ],
      notes: [
        "69% of packaged students have deposited, against 44% of unpackaged ones.",
        "Packaging is the single step most correlated with a deposit in this cycle.",
      ],
    },
  },
  {
    id: "housing-contracts",
    topic: "housing",
    label: "Housing Contracts",
    icon: "housing",
    value: 1180,
    display: "1,180",
    window: "Signed residence contracts for Fall 2025",
    series: walk(HISTORY_DAYS, 704, 1180, 1.9, 101),
    previousYear: walk(HISTORY_DAYS + FORECAST_DAYS, 812, 1498, 1.6, 102),
    forecast: walk(FORECAST_DAYS, 1180, 1402, 0.8, 103),
    target: 1600,
    targetDisplay: "1,600",
    progressPercent: progress(1180, 1600),
    dueLabel: "Due by Jun 1",
    trendNote:
      "About 25 a day with 11 days left, which reaches 1,402 of the 1,600.",
    cohort: cohortOf(
      "housing_signed",
      "students with a signed housing contract",
      ["housing state = contract_signed"],
      "Which deposited students have not signed a housing contract?",
    ),
    comparisons: comparisons([
      ["2.2%", "+25", "up", true],
      ["9.7%", "+104", "up", true],
      ["37.4%", "+321", "up", true],
      ["12.2%", "−164", "down", false],
    ]),
    unavailable: false,
    detail: {
      definition: "Deposited students with a countersigned residence agreement for Fall 2025.",
      segments: [
        { label: "Signed and assigned", value: 742, percent: 62.9 },
        { label: "Signed, awaiting assignment", value: 438, percent: 37.1 },
        { label: "Deposited, unsigned", value: 432, percent: null },
      ],
      notes: [
        "1,180 of 1,612 residential deposits are signed.",
        "Assignment work compresses into the six weeks before move-in when signing runs late.",
      ],
    },
  },
  {
    id: "orientation",
    topic: "campus_life",
    label: "Orientation Registered",
    icon: "events",
    value: 1504,
    display: "1,504",
    window: "Deposited students registered for orientation",
    series: walk(HISTORY_DAYS, 892, 1504, 2.1, 111),
    previousYear: walk(HISTORY_DAYS + FORECAST_DAYS, 1046, 1932, 1.7, 112),
    forecast: walk(FORECAST_DAYS, 1504, 1798, 0.9, 113),
    target: 2450,
    targetDisplay: "2,450",
    progressPercent: progress(1504, 2450),
    dueLabel: "Due by Jun 17",
    trendNote:
      "61% of deposited students are registered with four weeks to go.",
    cohort: cohortOf(
      "orientation_registered",
      "deposited students registered for orientation",
      ["orientation state = registered"],
      "Which deposited students have not registered for orientation?",
    ),
    comparisons: comparisons([
      ["2.7%", "+40", "up", true],
      ["11.8%", "+159", "up", true],
      ["40.7%", "+435", "up", true],
      ["6.4%", "−103", "down", false],
    ]),
    unavailable: false,
    detail: {
      definition: "Deposited students holding a place in one of the six Fall 2025 orientation sessions.",
      segments: [
        { label: "Session 1–2 (June)", value: 604, percent: 40.2 },
        { label: "Session 3–4 (July)", value: 612, percent: 40.7 },
        { label: "Session 5–6 (August)", value: 288, percent: 19.1 },
      ],
      notes: [
        "Session 3 is oversubscribed by 44 places and Session 6 is a third empty.",
        "946 deposited students have not registered for any session.",
      ],
    },
  },
  {
    id: "campus-visits",
    topic: "campus_life",
    label: "Campus Visits",
    icon: "students",
    value: 4120,
    display: "4,120",
    window: "Visitors hosted this cycle",
    series: walk(HISTORY_DAYS, 3488, 4120, 2.3, 121),
    previousYear: walk(HISTORY_DAYS + FORECAST_DAYS, 3702, 4880, 1.9, 122),
    forecast: walk(FORECAST_DAYS, 4120, 4386, 1, 123),
    target: 5000,
    targetDisplay: "5,000",
    progressPercent: progress(4120, 5000),
    dueLabel: "Due by Jun 30",
    trendNote:
      "Weekday visits hold steady; weekend events run 12% behind last year.",
    cohort: cohortOf(
      "campus_visits",
      "students who have visited campus",
      ["visit state = attended"],
      "Which admitted students have visited campus this cycle?",
    ),
    comparisons: comparisons([
      ["1.1%", "+46", "up", true],
      ["4.6%", "+181", "up", true],
      ["15.3%", "+547", "up", true],
      ["12.2%", "−574", "down", false],
    ]),
    unavailable: false,
    detail: {
      definition: "Prospective and admitted students hosted on campus during the Fall 2025 cycle.",
      segments: [
        { label: "Weekday tours", value: 2864, percent: 69.5 },
        { label: "Weekend admitted-student events", value: 986, percent: 23.9 },
        { label: "Group and school visits", value: 270, percent: 6.6 },
      ],
      notes: [
        "Weekend attendance is down 12% year over year; weekday tours are up 4%.",
        "Deposited students who visited yield 9 points above those who did not.",
      ],
    },
  },
];

/* ----------------------------------------------------------------- insights */

/**
 * The findings, as a pool rather than a fixed three.
 *
 * The brief always prints three — a leader can act on three things before
 * lunch, and a list that grew with the topics followed would be a backlog
 * rather than a briefing. Which three depends on what the reader follows;
 * `data.ts` picks them and pads from the rest so the band is never short.
 */
export const DEMO_INSIGHTS: BrewInsight[] = [
  {
    id: "commuter-deposit-pace",
    topic: "enrollment",
    label: "Deposit pace",
    title: "Commuter student deposit pace is slowing",
    severity: "high",
    summary: "Deposit rate for accepted commuter students declined 6.4% in the last 7 days.",
    projection: "If this continues, we project 82 fewer deposits by May 31 (~$1.6M in tuition).",
    stats: {
      glance: "838 commuter deposits · 6.4% slower over 7 days · 82 deposits at risk by May 31",
      context:
        "838 of 1,807 commuter admits have deposited · 46.4% against 52.8% a week ago · 312 of the slipping group have an open aid file",
      deep: "838 commuter deposits · rate 46.4%, down 6.4% in 7 days · 312 of the 494 undeposited carry an open verification",
    },
    context:
      "Commuter admits deposit earlier than residential ones in a normal cycle, and this year they have stopped. The slowdown began the day Financial Aid's verification queue crossed 250 files, and 312 of the 494 commuter admits without a deposit are sitting in that queue waiting on a package.",
    deepDive:
      "The commuter cohort ran 6 points above residential at this point last cycle and is now 9 points below its own last-year figure. The break is not in interest — visit attendance is flat — it is in the aid package: 312 of the 494 undeposited commuter admits have an open verification file, open 19 days at the median.",
    impactLabel: "Potential Impact",
    impact: [
      { label: "−$1.6M", tone: "negative" },
      { label: "−82 Enrolled Students", tone: "negative" },
    ],
    recommendations: {
      glance: "Launch targeted outreach to 312 high-probability students with incomplete financial aid.",
      context:
        "Launch targeted outreach to the 312 commuter admits with incomplete financial aid, and clear their verification files first.",
      deep: "Launch targeted outreach to the 312 commuter admits with incomplete financial aid, put the same 312 at the head of the verification queue, and hold the May 31 deadline.",
    },
    owner: "Enrollment Management",
    impactLevel: "High",
    confidence: 85,
    destination: "students",
    cohort: cohortOf(
      "commuter_no_deposit",
      "commuter admits without a deposit",
      ["decision = admit", "residency = commuter", "deposit state != paid"],
      "Which commuter admits have not posted an enrollment deposit?",
    ),
    detail: {
      narrative: [
        "838 of 1,807 commuter admits have deposited, a rate of 46.4%. Seven days ago that rate was 52.8%. Nothing about the cohort changed in the week — the aid packages behind it stopped arriving.",
        "The shape of the shortfall matters more than its size. Commuter interest is intact: visit attendance is flat and inquiry volume is up. What moved is the gap between an admit letter and a package, which is now 19 days at the median.",
      ],
      drivers: [
        {
          label: "Commuter admits without a deposit",
          value: "494 students",
          note: "Of whom 312 carry an open verification file",
        },
        {
          label: "Median days from admit to package",
          value: "19 days",
          note: "11 days at the same point in the Fall 2024 cycle",
        },
        {
          label: "Commuter deposit rate",
          value: "46.4%",
          note: "52.8% seven days ago; 55.1% at this point last cycle",
        },
      ],
      breakdown: [
        {
          code: "commuter_verification_open",
          title: "Commuter, verification open",
          students: 312,
          requirements: 312,
          overdue: 197,
        },
        {
          code: "commuter_packaged_no_deposit",
          title: "Commuter, packaged, no deposit",
          students: 182,
          requirements: 182,
          overdue: 0,
        },
        {
          code: "commuter_deposited",
          title: "Commuter, deposited",
          students: 838,
          requirements: 0,
          overdue: 0,
        },
      ],
      breakdownNote:
        "The three rows are exclusive and sum to the 1,807 commuter admits less 475 who declined.",
      actions: [
        {
          title: "Call the 312 commuter admits with an open aid file",
          detail: "Named list, not a broadcast; the message is the package date",
          owner: "Enrollment Management",
          due: "This week",
        },
        {
          title: "Move the same 312 to the head of the verification queue",
          detail: "The queue is the blocker; outreach without it repeats the wait",
          owner: "Financial Aid",
          due: "By May 26",
        },
        {
          title: "Hold the May 31 deposit deadline",
          detail: "An extension moves the date, not the packages",
          owner: "Vice President for Enrollment Management",
          due: "This week",
        },
      ],
      students: [
        {
          id: "s-1",
          name: "Sarah Johnson",
          program: "Nursing, BSN",
          note: "Commuter · verification open 19 days · no deposit",
        },
        {
          id: "s-2",
          name: "Michael Chen",
          program: "Computer Science, BS",
          note: "Commuter · awaiting an aid package · no deposit",
        },
        {
          id: "s-3",
          name: "Priya Raman",
          program: "Business Administration, BBA",
          note: "Commuter · correction returned to the family, 15 days",
        },
      ],
      studentsNote: "Three of 312 shown. The full cohort opens in the roster.",
      evidence: [
        "838 commuter admits hold a posted deposit; 494 do not.",
        "312 of those 494 have an open federal verification file.",
        "$19,500 of net tuition per enrolled student, from the Fall 2025 projection.",
      ],
    },
  },
  {
    id: "verification-backlog",
    topic: "financial_aid",
    label: "Verification backlog",
    title: "Financial aid verification backlog increasing",
    severity: "medium",
    summary: "Verification cases are up 18% vs last week, driving delays in aid packages.",
    projection: "312 students are at risk of delaying their deposit.",
    stats: {
      glance: "324 open files · up 18% in 7 days · 312 students without a deposit behind it",
      context:
        "324 open files · 30 cleared a day against 38 arriving · June 6 packaging date needs 43 a day",
      deep: "324 open files · 197 awaiting documents, 88 awaiting review, 39 in correction · 30 cleared a day against 38 arriving",
    },
    context:
      "The queue is growing because arrivals outrun clearances, not because output fell — Financial Aid cleared 210 files in the last seven days, its best week of the cycle. At 30 a day against 38 arriving, the queue reaches roughly 372 by month end and the June 6 packaging date slips with it.",
    deepDive:
      "324 files are open: 197 waiting on documents from the family, 88 waiting on review here, and 39 in correction. Only the middle 88 are inside this office's control, which is why more staff moves the number and more email does not.",
    impactLabel: "Potential Impact",
    impact: [{ label: "−36 Enrolled Students", tone: "negative" }],
    recommendations: {
      glance: "Add 2 temporary reviewers and prioritize commuter and transfer cases.",
      context:
        "Add 2 temporary reviewers through June 6 and work commuter and transfer files first — both cohorts deposit late and melt early.",
      deep: "Add 2 temporary reviewers through June 6, work the 312 undeposited files ahead of the rest, and report the queue against arrivals rather than against its own size.",
    },
    owner: "Financial Aid",
    impactLevel: "High",
    confidence: 75,
    destination: "tasks",
    cohort: cohortOf(
      "verification_open",
      "students with an open verification file",
      ["aid state = verification_selected"],
      "Which students have an open financial aid verification, and what is each waiting on?",
    ),
    detail: {
      narrative: [
        "324 verification files are open, against 275 seven days ago. Output did not fall: 210 files were cleared in the same week, the highest of the cycle. Arrivals rose faster.",
        "36 fewer enrolled students is the cost of the queue holding through June, using the same melt rate the yield projection uses. It is a smaller number than the deposit finding above because most of these students eventually deposit — they deposit late, and late deposits melt.",
      ],
      drivers: [
        {
          label: "Files arriving",
          value: "38 a day",
          note: "Up from 26 a day two weeks ago",
        },
        {
          label: "Files cleared",
          value: "30 a day",
          note: "The highest sustained rate of the cycle",
        },
        {
          label: "Undeposited students in the queue",
          value: "312 of 324",
          note: "The queue is almost entirely students who have not yet committed",
        },
      ],
      breakdown: [
        {
          code: "awaiting_family",
          title: "Awaiting documents from the family",
          students: 197,
          requirements: 197,
          overdue: 118,
        },
        {
          code: "awaiting_review",
          title: "Awaiting review by Financial Aid",
          students: 88,
          requirements: 88,
          overdue: 41,
        },
        {
          code: "in_correction",
          title: "Correction returned to the family",
          students: 39,
          requirements: 39,
          overdue: 22,
        },
      ],
      breakdownNote: "Rows are exclusive and sum to the 324 open files.",
      actions: [
        {
          title: "Fund two temporary reviewers through June 6",
          detail: "At the observed 15 files a day each, the standing queue clears June 4",
          owner: "Financial Aid",
          due: "This week",
        },
        {
          title: "Work commuter and transfer files first",
          detail: "Both cohorts deposit late and melt at above-average rates",
          owner: "Financial Aid",
          due: "From May 21",
        },
        {
          title: "Report the queue against arrivals",
          detail: "A record clearing week currently reads as a worsening number",
          owner: "Enrollment Management",
          due: "Next Monday",
        },
      ],
      students: [
        {
          id: "s-4",
          name: "Devon Alvarez",
          program: "Health Sciences, BS",
          note: "Selected 22 days ago · tax transcript outstanding",
        },
        {
          id: "s-5",
          name: "Amara Okafor",
          program: "Psychology, BA",
          note: "Documents complete · awaiting review 9 days",
        },
      ],
      studentsNote: "Two of 324 shown. The full queue opens in the Action Center.",
      evidence: [
        "324 files open today against 275 on May 13.",
        "210 files cleared in the last seven days, the highest week of the cycle.",
        "312 of the 324 students in the queue have not paid a deposit.",
      ],
    },
  },
  {
    id: "transfer-volume",
    topic: "admissions",
    label: "Transfer volume",
    title: "Transfer application volume trending above target",
    severity: "positive",
    summary: "Transfer applications are up 14% vs last year and 9% above target pace.",
    projection: "Strong interest in Business and Health Sciences programs.",
    stats: {
      glance: "2,604 transfer applications · 14% ahead of last year · 9% above target pace",
      context:
        "2,604 applications against a 2,400 target · Business 812 and Health Sciences 705 · credit evaluations 9 days behind",
      deep: "2,604 applications, target met May 14 · Business 812 (+21%) and Health Sciences 705 (+18%) · credit evaluations 9 days behind",
    },
    context:
      "Transfer is the one part of the funnel running ahead, and it is running ahead in the two programs with room to take students. The constraint has moved from volume to throughput: credit evaluations are nine days behind the application date, and a transfer applicant who waits that long for an evaluation is choosing between offers, not waiting for one.",
    deepDive:
      "2,604 transfer applications is 320 more than the same day last cycle and 204 above the 2,400 target, with Business up 21% and Health Sciences 18%. At Aster's 42.6% admit and 33.8% yield those 320 are worth roughly 46 enrolled students — but only if the evaluations keep pace.",
    impactLabel: "Potential Impact",
    impact: [
      { label: "+$1.2M", tone: "positive" },
      { label: "+48 Enrolled Students", tone: "positive" },
    ],
    recommendations: {
      glance: "Increase admitted student events for transfer prospects in top feeder schools.",
      context:
        "Increase admitted-student events at the five feeder colleges carrying the growth, and add evaluation capacity so offers land inside a week.",
      deep: "Run two admitted-student evenings at the five feeder colleges before June 15, and add one evaluator through the same date.",
    },
    owner: "Admissions",
    impactLevel: "Medium",
    confidence: 80,
    destination: "students",
    cohort: cohortOf(
      "transfer_pending",
      "transfer applicants awaiting a decision",
      ["applicant type = transfer", "decision = pending"],
      "Which transfer applicants are waiting on a credit evaluation?",
    ),
    detail: {
      narrative: [
        "2,604 transfer applications, 14% ahead of the same day last cycle and 204 above the round's target. The growth is concentrated: Business and Health Sciences are 58% of the file between them.",
        "The risk in a positive finding is that it is read as nothing to do. Here there is something to do — evaluations are nine days behind, and a transfer applicant deciding between institutions rarely waits nine days.",
      ],
      drivers: [
        {
          label: "Applications above target",
          value: "+204",
          note: "Target of 2,400 met on May 14",
        },
        {
          label: "Business and Health Sciences",
          value: "1,517 applications",
          note: "Up 21% and 18% respectively; both programs have capacity",
        },
        {
          label: "Credit evaluation lag",
          value: "9 days",
          note: "4 days at the same point last cycle",
        },
      ],
      breakdown: [
        {
          code: "transfer_business",
          title: "Business",
          students: 812,
          requirements: 812,
          overdue: 214,
        },
        {
          code: "transfer_health",
          title: "Health Sciences",
          students: 705,
          requirements: 705,
          overdue: 186,
        },
        {
          code: "transfer_other",
          title: "All other programs",
          students: 1087,
          requirements: 1087,
          overdue: 173,
        },
      ],
      breakdownNote:
        "\"Overdue\" here is an evaluation past the five-day service target, not a student obligation.",
      actions: [
        {
          title: "Two admitted-student evenings at the five feeder colleges",
          detail: "61% of the growth comes from five colleges within 40 miles",
          owner: "Admissions",
          due: "Before June 15",
        },
        {
          title: "Add one credit evaluator through June 15",
          detail: "Brings the evaluation lag back inside the five-day service target",
          owner: "Registrar",
          due: "This week",
        },
      ],
      students: [
        {
          id: "s-6",
          name: "Jordan Reyes",
          program: "Business Administration, BBA",
          note: "Transfer · 42 credits submitted · evaluation open 11 days",
        },
        {
          id: "s-7",
          name: "Nia Thompson",
          program: "Health Sciences, BS",
          note: "Transfer · evaluation complete · offer released yesterday",
        },
      ],
      studentsNote: "Two of 573 pending evaluations shown.",
      evidence: [
        "2,604 transfer applications against 2,284 on the same day last cycle.",
        "1,108 transfer admits released, the largest transfer round Aster has run.",
        "42.6% admit rate and 33.8% deposit rate on the transfer file this cycle.",
      ],
    },
  },
  {
    id: "housing-signing-lag",
    topic: "housing",
    label: "Housing readiness",
    title: "Housing contracts are running 11 days behind the deadline",
    severity: "medium",
    summary: "1,180 of 1,600 contracts are signed with 11 days left before the June 1 deadline.",
    projection: "At the current pace roughly 200 beds are assigned after move-in planning closes.",
    stats: {
      glance: "1,180 of 1,600 signed · 74% · 11 days to the June 1 deadline",
      context:
        "1,180 signed against a 1,600 target · 25 signing a day · 432 deposited students have not signed",
      deep: "1,180 signed, 742 assigned · 25 a day against the 38 the deadline needs · 432 unsigned, 261 of them commuter admits",
    },
    context:
      "Signing is steady but too slow for the date. 432 deposited students have not signed, and 261 of them are commuter admits who may never need a bed — which means the real gap is nearer 171, and Residence Life is planning capacity against a number that includes students who will not use it.",
    deepDive:
      "1,180 contracts are signed against a 1,600 target, with 742 assigned to a room; the pace is 25 a day and the deadline needs 38. Of the 432 unsigned, 261 are commuter admits whose housing intent was never confirmed, and Residence Life is holding capacity for all 432.",
    impactLabel: "Potential Impact",
    impact: [
      { label: "≈200 late assignments", tone: "negative" },
      { label: "261 beds held unnecessarily", tone: "neutral" },
    ],
    recommendations: {
      glance: "Ask the 261 commuter admits to confirm housing intent before holding beds for them.",
      context:
        "Send a one-question housing intent confirmation to the 261 commuter admits, then work the remaining 171 as a named list.",
      deep: "Send a one-question housing intent confirmation to the 261 commuter admits this week, release the beds that come back negative, and hand Residence Life the remaining 171 as a named list.",
    },
    owner: "Residence Life",
    impactLevel: "Medium",
    confidence: 78,
    destination: "students",
    cohort: cohortOf(
      "housing_unsigned",
      "deposited students without a signed housing contract",
      ["deposit state = paid", "housing state != contract_signed"],
      "Which deposited students have not signed a housing contract?",
    ),
    detail: {
      narrative: [
        "1,180 of a 1,600 target are signed, 74% of the way there with 11 days left. The pace needed is 38 a day and the pace observed is 25.",
        "The number that matters is not 432 unsigned students but 171 — the rest are commuter admits whose housing intent was never asked for.",
      ],
      drivers: [
        {
          label: "Deposited students unsigned",
          value: "432 students",
          note: "261 of them commuter admits with no stated housing intent",
        },
        {
          label: "Signing pace",
          value: "25 a day",
          note: "38 a day would meet the June 1 deadline",
        },
        {
          label: "Signed but unassigned",
          value: "438 students",
          note: "Assignment work concentrates after the deadline when signing runs late",
        },
      ],
      breakdown: [
        {
          code: "housing_signed_assigned",
          title: "Signed and assigned",
          students: 742,
          requirements: 742,
          overdue: 0,
        },
        {
          code: "housing_signed_unassigned",
          title: "Signed, awaiting assignment",
          students: 438,
          requirements: 438,
          overdue: 0,
        },
        {
          code: "housing_unsigned",
          title: "Deposited, unsigned",
          students: 432,
          requirements: 432,
          overdue: 261,
        },
      ],
      breakdownNote: "Rows are exclusive and sum to the 1,612 residential-eligible deposits.",
      actions: [
        {
          title: "Send a one-question housing intent confirmation",
          detail: "To the 261 commuter admits currently holding a reserved bed",
          owner: "Residence Life",
          due: "By May 23",
        },
        {
          title: "Hand Residence Life the remaining 171 as a named list",
          detail: "Manageable at that size; unmanageable as a total of 432",
          owner: "Enrollment Management",
          due: "By May 26",
        },
      ],
      students: [
        {
          id: "s-8",
          name: "Elena Marsh",
          program: "Environmental Science, BS",
          note: "Deposited May 2 · residential · contract unsigned",
        },
      ],
      studentsNote: "One of 432 shown. The full list opens in the roster.",
      evidence: [
        "1,180 signed contracts against a 1,600 target for Fall 2025.",
        "432 deposited students have not signed; 261 are commuter admits.",
        "The June 1 deadline is 11 days away at the pace of 25 signatures a day.",
      ],
    },
  },
  {
    id: "orientation-melt-signal",
    topic: "campus_life",
    label: "Orientation",
    title: "946 deposited students have not registered for orientation",
    severity: "medium",
    summary: "61% of deposited students are registered, four weeks before the June 17 cut-off.",
    projection: "Unregistered deposits melt at roughly twice the rate of registered ones.",
    stats: {
      glance: "1,504 of 2,450 registered · 61% · 946 deposited students unregistered",
      context:
        "1,504 registered · Session 3 oversubscribed by 44 · Session 6 a third empty · 946 unregistered",
      deep: "1,504 registered across six sessions · Session 3 +44 over capacity, Session 6 at 68% · 946 unregistered deposits",
    },
    context:
      "Orientation registration is the earliest reliable melt signal the sector has found, and 946 deposited students have not registered with four weeks to go. The sessions themselves are also badly balanced: Session 3 is oversubscribed by 44 while Session 6 runs a third empty.",
    deepDive:
      "1,504 of 2,450 deposited students hold an orientation place. The 946 who do not are 61% commuter admits — the same cohort whose deposit rate slipped this week — and at last cycle's rates the unregistered melt at roughly twice the registered rate.",
    impactLabel: "Potential Impact",
    impact: [
      { label: "−54 Enrolled Students", tone: "negative" },
      { label: "44 places to rebalance", tone: "neutral" },
    ],
    recommendations: {
      glance: "Rebalance Session 3 into Session 6 and contact the 946 unregistered deposits.",
      context:
        "Move 44 places from Session 3 to Session 6, then contact the 946 unregistered deposits starting with the 577 commuter admits.",
      deep: "Move 44 places from Session 3 to Session 6 this week, then work the 946 unregistered deposits as a named list, starting with the 577 commuter admits.",
    },
    owner: "Campus Life",
    impactLevel: "Medium",
    confidence: 72,
    destination: "campus_life",
    cohort: cohortOf(
      "orientation_unregistered",
      "deposited students without an orientation place",
      ["deposit state = paid", "orientation state != registered"],
      "Which deposited students have not registered for orientation?",
    ),
    detail: {
      narrative: [
        "1,504 of 2,450 deposited students are registered for orientation, 61%, with the June 17 cut-off four weeks out.",
        "577 of the 946 unregistered are commuter admits — the same cohort behind on deposits and housing. That is one disengaging group appearing three times, not three separate problems.",
      ],
      drivers: [
        {
          label: "Unregistered deposits",
          value: "946 students",
          note: "577 of them commuter admits",
        },
        {
          label: "Session 3",
          value: "+44 over capacity",
          note: "Session 6 is running at 68% of its places",
        },
        {
          label: "Melt differential",
          value: "≈2×",
          note: "Observed in the Fall 2024 cycle between registered and unregistered deposits",
        },
      ],
      breakdown: [
        {
          code: "orientation_june",
          title: "Sessions 1–2 (June)",
          students: 604,
          requirements: 604,
          overdue: 0,
        },
        {
          code: "orientation_july",
          title: "Sessions 3–4 (July)",
          students: 612,
          requirements: 612,
          overdue: 44,
        },
        {
          code: "orientation_august",
          title: "Sessions 5–6 (August)",
          students: 288,
          requirements: 288,
          overdue: 0,
        },
      ],
      breakdownNote:
        "\"Overdue\" here counts places booked past a session's capacity, not a student obligation.",
      actions: [
        {
          title: "Move 44 places from Session 3 to Session 6",
          detail: "Costs nothing and reopens the session families ask for first",
          owner: "Campus Life",
          due: "This week",
        },
        {
          title: "Contact the 577 unregistered commuter deposits",
          detail: "One conversation can cover deposit, housing intent and orientation",
          owner: "Enrollment Management",
          due: "Before June 3",
        },
      ],
      students: [
        {
          id: "s-9",
          name: "Marcus Bell",
          program: "Business Administration, BBA",
          note: "Deposited April 28 · commuter · no orientation place",
        },
      ],
      studentsNote: "One of 946 shown. The full list opens in Campus Life.",
      evidence: [
        "1,504 of 2,450 deposited students hold an orientation place.",
        "Session 3 is 44 places over capacity; Session 6 is at 68%.",
        "Unregistered deposits melted at roughly twice the registered rate in Fall 2024.",
      ],
    },
  },
  {
    id: "discount-rate-creep",
    topic: "financial_aid",
    label: "Discount rate",
    title: "The discount rate is 1.9 points above plan on packages sent so far",
    severity: "high",
    summary: "Institutional aid on the 1,880 packages released averages 46.4% of gross tuition.",
    projection: "Held to the full class, that is $2.1M of net tuition below the $110.0M plan.",
    stats: {
      glance: "46.4% discount rate · 1.9 points above plan · $2.1M below the net tuition plan",
      context:
        "46.4% against a 44.5% plan · 1,880 of 2,600 packages released · $2.1M at full-class scale",
      deep: "46.4% discount on 1,880 packages against a 44.5% plan · merit awards up 3.1 points, need-based flat · 720 packages still to release",
    },
    context:
      "The rate is running above plan on merit rather than need: need-based awards are flat against last cycle and merit awards are 3.1 points higher, largely from the automatic bands applied at admit. 720 packages are still to release, which is enough room to bring the cycle back to plan if the bands are adjusted now.",
    deepDive:
      "Institutional aid on the 1,880 packages released averages 46.4% of gross tuition against a 44.5% plan. The gap is entirely in merit — need-based aid is within 0.2 points of last cycle while merit is 3.1 points above it — which follows from the automatic award bands applied at the point of admit.",
    impactLabel: "Potential Impact",
    impact: [
      { label: "−$2.1M", tone: "negative" },
      { label: "+1.9pp discount rate", tone: "negative" },
    ],
    recommendations: {
      glance: "Adjust the top two merit bands on the 720 packages still to release.",
      context:
        "Adjust the top two merit bands by one step on the 720 unreleased packages, and leave issued offers untouched.",
      deep: "Adjust the top two merit bands by one step on the 720 unreleased packages, worth about $1.4M, and take the residual $0.7M to the CFO as a plan variance.",
    },
    owner: "Financial Aid",
    impactLevel: "High",
    confidence: 82,
    destination: "overview",
    cohort: cohortOf(
      "packages_released",
      "students with a released aid package",
      ["aid state = packaged"],
      "What is the institutional aid on each released Fall 2025 package?",
    ),
    detail: {
      narrative: [
        "Institutional aid on the 1,880 released packages averages 46.4% of gross tuition, against a 44.5% plan. Held to the full class that is $2.1M below the $110.0M net tuition plan.",
        "The cause is structural rather than discretionary: the automatic merit bands applied at admit are one step generous against this year's gross tuition.",
      ],
      drivers: [
        {
          label: "Merit award average",
          value: "+3.1pp",
          note: "Against the same point in the Fall 2024 cycle",
        },
        {
          label: "Need-based award average",
          value: "+0.2pp",
          note: "Effectively flat; this is not a need-based movement",
        },
        {
          label: "Packages still to release",
          value: "720",
          note: "Enough room to recover roughly $1.4M without reopening an offer",
        },
      ],
      breakdown: [
        {
          code: "merit_band_top",
          title: "Merit bands 1–2",
          students: 604,
          requirements: 604,
          overdue: 0,
        },
        {
          code: "merit_band_mid",
          title: "Merit bands 3–4",
          students: 812,
          requirements: 812,
          overdue: 0,
        },
        {
          code: "need_only",
          title: "Need-based only",
          students: 464,
          requirements: 464,
          overdue: 0,
        },
      ],
      breakdownNote: "Rows are exclusive and sum to the 1,880 released packages.",
      actions: [
        {
          title: "Adjust the top two merit bands by one step",
          detail: "Applies to the 720 unreleased packages only",
          owner: "Financial Aid",
          due: "Before May 27",
        },
        {
          title: "Take the residual variance to the CFO",
          detail: "$0.7M cannot be recovered without reopening issued offers",
          owner: "Vice President for Enrollment Management",
          due: "Before the June 2 reforecast window closes",
        },
      ],
      students: [],
      studentsNote:
        "No students are named here. This is a finding about award bands, and a list of individuals would invite a conversation about their offers.",
      evidence: [
        "46.4% average institutional discount on 1,880 released packages.",
        "44.5% planned discount rate for the Fall 2025 cycle.",
        "720 packages remain unreleased as of this morning.",
      ],
    },
  },
];

/* ----------------------------------------------------------------- calendar */

export const DEMO_MEETINGS: BrewMeeting[] = [
  {
    id: "m-leadership-huddle",
    topic: "enrollment",
    title: "Enrollment Leadership Huddle",
    detail: "Review key metrics and insights",
    timeLabel: "8:30 AM",
    durationMinutes: 60,
    startsAtMinutes: 8 * 60 + 30,
    priority: "high",
    attendees: [
      "Hana Dunmire",
      "Dana Ruiz",
      "Tom Whitfield",
      "Priya Raman",
      "Alicia Moreno",
      "Rachel Adeyemi",
      "Nathan Cole",
      "Imani Brooks",
    ],
    organizer: true,
    prep: "Bring the commuter deposit finding — it is the only item that needs a decision today.",
    destination: "overview",
  },
  {
    id: "m-transfer-pathways",
    topic: "admissions",
    title: "Transfer Pathways Working Group",
    detail: "Five feeder colleges, evaluation turnaround",
    timeLabel: "9:15 AM",
    durationMinutes: 30,
    startsAtMinutes: 9 * 60 + 15,
    priority: "medium",
    attendees: ["Dana Ruiz", "Tom Whitfield", "Jordan Pike"],
    organizer: false,
    prep: "Registrar is asking for one evaluator through June 15; the transfer finding sizes the return.",
    destination: "students",
  },
  {
    id: "m-campaign-review",
    topic: "enrollment",
    title: "Campaign Review – Commuter",
    detail: "Marketing, Comms",
    timeLabel: "10:00 AM",
    durationMinutes: 30,
    startsAtMinutes: 10 * 60,
    priority: "medium",
    attendees: ["Alicia Moreno"],
    organizer: false,
    prep: "The 312 named commuter admits should replace the broadcast send on the plan.",
    destination: "outreach",
  },
  {
    id: "m-board-packet",
    topic: "enrollment",
    title: "Board Packet Walkthrough – Finance",
    detail: "Enrollment section for the June meeting",
    timeLabel: "11:00 AM",
    durationMinutes: 45,
    startsAtMinutes: 11 * 60,
    priority: "high",
    attendees: ["Rachel Adeyemi", "Eleanor Voss", "Nathan Cole"],
    organizer: false,
    prep: "Take the range, not the point estimate: 2,716 to 3,200 deposits by May 31.",
    destination: "overview",
  },
  {
    id: "m-yield-standup",
    topic: "campus_life",
    title: "Admitted Student Yield Standup",
    detail: "Events, visits, orientation",
    timeLabel: "12:00 PM",
    durationMinutes: 20,
    startsAtMinutes: 12 * 60,
    priority: "medium",
    attendees: ["Imani Brooks", "Dana Ruiz"],
    organizer: true,
    prep: "Session 3 is 44 over capacity and Session 6 is a third empty — decide the rebalance here.",
    destination: "campus_life",
  },
  {
    id: "m-fa-operations",
    topic: "financial_aid",
    title: "Financial Aid Operations Sync",
    detail: "FA, Ops, Enrollment",
    timeLabel: "1:00 PM",
    durationMinutes: 45,
    startsAtMinutes: 13 * 60,
    priority: "high",
    attendees: ["Hana Dunmire", "Nathan Cole", "Imani Brooks"],
    organizer: false,
    prep: "Approve or decline the two temporary reviewers; the June 6 packaging date depends on it.",
    destination: "tasks",
  },
  {
    id: "m-housing-readiness",
    topic: "housing",
    title: "Housing Assignment Readiness",
    detail: "Residence Life",
    timeLabel: "2:15 PM",
    durationMinutes: 30,
    startsAtMinutes: 14 * 60 + 15,
    priority: "medium",
    attendees: ["Priya Raman", "Elena Marsh"],
    organizer: false,
    prep: "Ask whether the 261 commuter beds are still being held; that is the real gap.",
    destination: "students",
  },
  {
    id: "m-provost-1-1",
    topic: "enrollment",
    title: "1:1 with Provost",
    detail: "Weekly update",
    timeLabel: "3:30 PM",
    durationMinutes: 30,
    startsAtMinutes: 15 * 60 + 30,
    priority: "low",
    attendees: ["Dr. Marcus Okonjo"],
    organizer: false,
    prep: "He has asked about the scholarship reallocation by email; have a number ready.",
    destination: "messages",
  },
  {
    id: "m-forecast-review",
    topic: "enrollment",
    title: "Weekly Enrollment Forecast Review",
    detail: "Finance, Enrollment, IR",
    timeLabel: "4:30 PM",
    durationMinutes: 45,
    startsAtMinutes: 16 * 60 + 30,
    priority: "high",
    attendees: ["Rachel Adeyemi", "Nathan Cole", "Jordan Pike", "Imani Brooks"],
    organizer: true,
    prep: "The reforecast window closes June 2. This is the last review before the number is fixed.",
    destination: "overview",
  },
];

/* ----------------------------------------------------------------- requests */

export const DEMO_REQUESTS: BrewRequest[] = [
  {
    id: "r-1",
    topic: "financial_aid",
    subject: "Provost: Reallocation Request – Scholarship Initiative",
    summary:
      "Request to approve additional scholarship funds for commuter outreach. Before the board packet closes I want your read on moving $240K from the summer campaign — can you send me a number by Friday?",
    fromName: "Dr. Marcus Okonjo",
    fromRole: "Provost",
    status: "new",
    priority: "urgent",
    unread: true,
    important: true,
    receivedLabel: "9:00 PM",
    waitingLabel: "Waiting since last night",
    assigneeName: null,
    destination: "messages",
  },
  {
    id: "r-2",
    topic: "enrollment",
    subject: "Board of Trustees: Upcoming Enrollment Update",
    summary:
      "Reminder: Enrollment update requested for June board meeting. The finance committee has asked for a range on the entering class rather than a single number this time.",
    fromName: "Eleanor Voss",
    fromRole: "Board Liaison",
    status: "new",
    priority: "high",
    unread: true,
    important: true,
    receivedLabel: "6:30 AM",
    waitingLabel: "Waiting 1 hour",
    assigneeName: null,
    destination: "messages",
  },
  {
    id: "r-3",
    topic: "admissions",
    subject: "Regional High School Visit This Week",
    summary:
      "Three of the five feeder colleges have confirmed for Thursday and Friday. I can add an admitted-student evening at two of them if you want the transfer push before June 15.",
    fromName: "Dana Ruiz",
    fromRole: "Associate Director of Admissions",
    status: "open",
    priority: "low",
    unread: false,
    important: true,
    receivedLabel: "6:45 AM",
    waitingLabel: "Waiting 45 minutes",
    assigneeName: "Dana Ruiz",
    destination: "messages",
  },
  {
    id: "r-4",
    topic: "enrollment",
    subject: "1:1 with Provost – agenda for this afternoon",
    summary:
      "Sending the running order ahead of 3:30. He has two items: the scholarship reallocation and where the entering-class number lands before the June 2 reforecast window closes.",
    fromName: "Camille Osei",
    fromRole: "Executive Assistant to the Provost",
    status: "open",
    priority: "medium",
    unread: false,
    important: false,
    receivedLabel: "7:15 AM",
    waitingLabel: "Waiting 15 minutes",
    assigneeName: null,
    destination: "messages",
  },
  {
    id: "r-5",
    topic: "enrollment",
    subject: "Net tuition reforecast – the plan line still says $110.0M",
    summary:
      "Finance closes the reforecast window on June 2. If the entering class is moving I need the range and the assumptions behind it, not the point estimate, and I need them before then.",
    fromName: "Rachel Adeyemi",
    fromRole: "Chief Financial Officer",
    status: "new",
    priority: "urgent",
    unread: true,
    important: true,
    receivedLabel: "6:12 AM",
    waitingLabel: "Waiting 1 hour",
    assigneeName: null,
    destination: "messages",
  },
  {
    id: "r-6",
    topic: "financial_aid",
    subject: "324 open verifications – I need two more reviewers",
    summary:
      "We cleared 210 files last week, the best of the cycle, and the queue still grew. The June 6 packaging date needs 43 a day and we are running 30. Two temporary reviewers close it.",
    fromName: "Hana Dunmire",
    fromRole: "Director of Financial Aid",
    status: "new",
    priority: "high",
    unread: true,
    important: true,
    receivedLabel: "5:58 AM",
    waitingLabel: "Waiting 2 hours",
    assigneeName: null,
    destination: "messages",
  },
  {
    id: "r-7",
    topic: "housing",
    subject: "432 housing contracts unsigned with 11 days to go",
    summary:
      "261 of the unsigned are commuter admits and I do not think they need a bed at all. One yes-or-no question would let me release the capacity instead of holding it through June.",
    fromName: "Priya Raman",
    fromRole: "Director of Residence Life",
    status: "open",
    priority: "medium",
    unread: false,
    important: false,
    receivedLabel: "Yesterday 4:40 PM",
    waitingLabel: "Waiting 15 hours",
    assigneeName: "Priya Raman",
    destination: "messages",
  },
  {
    id: "r-8",
    topic: "campus_life",
    subject: "Orientation Session 3 is oversubscribed by 44",
    summary:
      "Session 6 is running at 68%. I can move the overflow with a single mail-out, but families booked Session 3 deliberately and I would rather you saw the message before it goes.",
    fromName: "Imani Brooks",
    fromRole: "Director of Campus Life",
    status: "open",
    priority: "medium",
    unread: false,
    important: false,
    receivedLabel: "Yesterday 2:15 PM",
    waitingLabel: "Waiting 17 hours",
    assigneeName: "Imani Brooks",
    destination: "campus_life",
  },
  {
    id: "r-9",
    topic: "admissions",
    subject: "Commuter scholarship pilot – first results",
    summary:
      "The GA and NC markets are returning about $4.10 of net tuition per dollar of award. The other three markets are under $1.60. Worth reallocating before the summer buy is committed.",
    fromName: "Alicia Moreno",
    fromRole: "Director of Enrollment Marketing",
    status: "open",
    priority: "low",
    unread: false,
    important: false,
    receivedLabel: "Yesterday 11:05 AM",
    waitingLabel: "Waiting 20 hours",
    assigneeName: "Alicia Moreno",
    destination: "outreach",
  },
];

/* --------------------------------------------------------------- priorities */

export const DEMO_PRIORITIES: BrewPriority[] = [
  {
    id: "p-verification-surge",
    topic: "financial_aid",
    title: "Financial Aid Verification Surge",
    level: "High",
    detail: "324 students need documents to complete files. Take action to protect yield.",
    icon: "flag",
    linkLabel: "Open the verification queue",
    destination: "tasks",
    breakdown: [
      { label: "Open files", value: "324" },
      { label: "Cleared per day", value: "30" },
      { label: "Needed per day to June 6", value: "43" },
    ],
    steps: [
      "Fund two temporary reviewers through June 6.",
      "Work the 312 undeposited files ahead of the rest.",
      "Report the queue against arrivals, not against its own size.",
    ],
    window: "This week",
    count: 324,
    ownedByReader: true,
    boardQuery: null,
  },
  {
    id: "p-commuter-outreach",
    topic: "enrollment",
    title: "Commuter Deposit Outreach",
    level: "High",
    detail: "312 commuter admits are stalled behind an aid package. $1.6M of net tuition is at stake.",
    icon: "flag",
    linkLabel: "Open the commuter cohort",
    destination: "students",
    breakdown: [
      { label: "Commuter admits without a deposit", value: "494" },
      { label: "Of those, verification open", value: "312" },
      { label: "Net tuition at risk", value: "$1.6M" },
    ],
    steps: [
      "Call the 312 as a named list, not a broadcast send.",
      "Lead with the package date, which is the actual blocker.",
      "Hold the May 31 deadline rather than extending it.",
    ],
    window: "Today",
    count: 312,
    ownedByReader: true,
    boardQuery: null,
  },
  {
    id: "p-reforecast",
    topic: "enrollment",
    title: "Net Tuition Reforecast",
    level: "High",
    detail: "The June 2 window closes in 13 days and the plan line still reads $110.0M.",
    icon: "tuition",
    linkLabel: "Open the enrollment dashboard",
    destination: "overview",
    breakdown: [
      { label: "Projected today", value: "$98.4M" },
      { label: "Plan", value: "$110.0M" },
      { label: "Deposit range to May 31", value: "2,716–3,200" },
    ],
    steps: [
      "Take the range to the CFO, not the point estimate.",
      "State the two assumptions: verification throughput and commuter melt.",
      "Fix the number before the June 2 window closes.",
    ],
    window: "This week",
    count: 13,
    ownedByReader: true,
    boardQuery: null,
  },
  {
    id: "p-board-packet",
    topic: "enrollment",
    title: "Board Packet: Enrollment Section",
    level: "High",
    detail: "The finance committee has asked for a range on the entering class for the June meeting.",
    icon: "actions",
    linkLabel: "Open the board packet draft",
    destination: "knowledge",
    breakdown: [
      { label: "Board meeting", value: "June 11" },
      { label: "Draft due to the liaison", value: "May 28" },
      { label: "Sections outstanding", value: "2 of 5" },
    ],
    steps: [
      "Draft the enrollment section against the reforecast range.",
      "Clear the discount-rate variance with Financial Aid first.",
      "Send to Eleanor Voss by May 28.",
    ],
    window: "This week",
    count: 2,
    ownedByReader: true,
    boardQuery: null,
  },
  {
    id: "p-events-visits",
    topic: "campus_life",
    title: "Events & Campus Visits",
    level: "Medium",
    detail: "Weekend event attendance is down 12% vs last year. Review outreach plan.",
    icon: "events",
    linkLabel: "Open campus life",
    destination: "campus_life",
    breakdown: [
      { label: "Weekend attendance", value: "986" },
      { label: "Year over year", value: "−12%" },
      { label: "Weekday tours", value: "+4%" },
    ],
    steps: [
      "Move the two June weekend events earlier in the day.",
      "Invite the 577 unregistered commuter deposits directly.",
      "Measure against deposits, not against registrations.",
    ],
    window: "This week",
    count: 986,
    ownedByReader: false,
    boardQuery: null,
  },
  {
    id: "p-housing-readiness",
    topic: "housing",
    title: "Housing Assignment Readiness",
    level: "Medium",
    detail: "432 deposited students are unsigned, and 261 of them may not need a bed at all.",
    icon: "housing",
    linkLabel: "Open the housing queue",
    destination: "students",
    breakdown: [
      { label: "Unsigned deposits", value: "432" },
      { label: "Commuter admits among them", value: "261" },
      { label: "Days to the deadline", value: "11" },
    ],
    steps: [
      "Send a one-question housing intent confirmation to the 261.",
      "Release the beds that come back negative.",
      "Hand Residence Life the remaining 171 as a named list.",
    ],
    window: "This week",
    count: 432,
    ownedByReader: false,
    boardQuery: null,
  },
  {
    id: "p-transfer-evaluations",
    topic: "admissions",
    title: "Transfer Credit Evaluation Backlog",
    level: "Medium",
    detail: "573 evaluations are open and running nine days behind the application date.",
    icon: "students",
    linkLabel: "Open the evaluation queue",
    destination: "tasks",
    breakdown: [
      { label: "Open evaluations", value: "573" },
      { label: "Days behind", value: "9" },
      { label: "Service target", value: "5 days" },
    ],
    steps: [
      "Add one evaluator through June 15.",
      "Work Business and Health Sciences first — 58% of the file.",
      "Release offers within five days of a complete application.",
    ],
    window: "This week",
    count: 573,
    ownedByReader: false,
    boardQuery: null,
  },
  {
    id: "p-scholarship-roi",
    topic: "financial_aid",
    title: "Scholarship ROI Review",
    level: "Low",
    detail: "Early results show high ROI in GA and NC markets. Consider reallocating spend.",
    icon: "aid",
    linkLabel: "Open the outreach workspace",
    destination: "outreach",
    breakdown: [
      { label: "GA and NC return", value: "$4.10 per $1" },
      { label: "Other three markets", value: "$1.60 per $1" },
      { label: "Summer buy not yet committed", value: "$240K" },
    ],
    steps: [
      "Confirm the two market figures with Marketing.",
      "Reallocate the summer buy before it is committed.",
      "Answer the provost's reallocation request with the same number.",
    ],
    window: "This month",
    count: 240,
    ownedByReader: false,
    boardQuery: null,
  },
  {
    id: "p-orientation-capacity",
    topic: "campus_life",
    title: "Orientation Capacity",
    level: "Low",
    detail: "Session 3 is 44 places over capacity while Session 6 runs a third empty.",
    icon: "events",
    linkLabel: "Open orientation sessions",
    destination: "campus_life",
    breakdown: [
      { label: "Session 3", value: "+44 over" },
      { label: "Session 6", value: "68% full" },
      { label: "Unregistered deposits", value: "946" },
    ],
    steps: [
      "Approve the rebalance message before it goes out.",
      "Open the released Session 3 places to the unregistered.",
      "Re-check the balance after the June 3 outreach.",
    ],
    window: "This month",
    count: 946,
    ownedByReader: false,
    boardQuery: null,
  },
];

/* ------------------------------------------------------------------ corpus */

export interface BrewDemoSource {
  generatedAt: string;
  windowLabel: string;
  cycleLabel: string;
  students: number;
  reader: BrewReader;
  synthesis: { headline: string };
  kpis: BrewKpi[];
  insights: BrewInsight[];
  meetings: BrewMeeting[];
  requests: BrewRequest[];
  priorities: BrewPriority[];
  glance: {
    /** The whole mailbox, not the curated slice the Email panel prints. */
    requests: number;
    requestsAwaitingReply: number;
  };
  coverage: { notes: string[]; unsupported: { metric: string; reason: string }[] };
}

/**
 * The corpus, as one morning.
 *
 * `generatedAt` is pinned to the morning the brief describes rather than to the
 * clock, because every relative label in it — "11 days to go", "due by May 31"
 * — is measured from that date. A masthead reading this afternoon under a
 * calendar counted from May 20 would be a page arguing with itself.
 */
export function demoBrewSource(): BrewDemoSource {
  return {
    generatedAt: DEMO_GENERATED_AT,
    windowLabel: "the last 24 hours",
    cycleLabel: "Fall 2025 cycle",
    students: ADMITS,
    reader: DEMO_READER,
    synthesis: {
      headline:
        "Here is your enrollment executive morning brief as of today 7:30 AM ET",
    },
    kpis: DEMO_KPIS,
    insights: DEMO_INSIGHTS,
    meetings: DEMO_MEETINGS,
    requests: DEMO_REQUESTS,
    priorities: DEMO_PRIORITIES,
    glance: {
      requests: 23,
      requestsAwaitingReply: 7,
    },
    coverage: {
      notes: [
        "This briefing is running on demo data. Every figure is illustrative and no student record was read to produce it.",
        "Rates move in points and counts move in students. A rate's comparison is never stated as a percentage of a percentage.",
        "Deposits paid is a level, net of withdrawals and refunds, so it can fall on a day with more withdrawals than deposits.",
        "Every impact figure in the findings uses one conversion: $19,500 of net tuition per enrolled student.",
      ],
      unsupported: [
        {
          metric: "Predicted melt per student",
          reason:
            "No model scores individual students, by design. Melt is last cycle's observed rate applied to a cohort, not a forecast about a person.",
        },
        {
          metric: "Productivity decline in Financial Aid",
          reason:
            "There was none. Output rose to the highest week of the cycle; the queue grew because arrivals rose faster.",
        },
        {
          metric: "Confidence as a probability",
          reason:
            "The confidence on a finding is how firm the reading is, stated by the analyst who wrote it. It is not a calibrated probability and should not be read as one.",
        },
      ],
    },
  };
}
