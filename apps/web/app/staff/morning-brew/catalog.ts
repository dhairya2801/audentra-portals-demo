import type {
  BrewDeliveryTime,
  BrewDetailLevelId,
  BrewSourceDefinition,
  BrewSourceId,
  BrewSourcePreference,
  BrewTopic,
  BrewTopicId,
} from "./types";

/**
 * What the reader can choose, and what each choice actually shows.
 *
 * Every entry here names a canonical record type rather than a vendor, with one
 * declared exception: Higher Education News is an outside editorial feed, and
 * `news.ts` says so in as many words. Everything else is a count of rows in the
 * tenant's own database.
 *
 * A source's `title` is also the section heading it produces in the brief, so
 * the question a reader answered in setup and the band they meet the next
 * morning carry the same name.
 */

export const BREW_TOPICS: BrewTopic[] = [
  {
    id: "financial_aid",
    title: "Financial aid",
    blurb: "Where aid files are stuck, and who is waiting on whom.",
    preview: "Aid documents · verification · action required",
    icon: "◆",
    accent: "purple",
    recommended: true,
    recommendation: "Aid blocks the most enrollment steps",
  },
  {
    id: "admissions",
    title: "Admissions & enrollment",
    blurb: "Who was offered, who accepted, and who has actually deposited.",
    preview: "Offers · acceptances · deposits",
    icon: "▲",
    accent: "blue",
    recommended: true,
    recommendation: "The funnel your team is measured on",
  },
  {
    id: "student_success",
    title: "Student progress",
    blurb: "Students who committed but are still blocked or overdue.",
    preview: "Blockers · overdue work · support requests",
    icon: "◇",
    accent: "teal",
    recommended: true,
    recommendation: "Where a deposit quietly stops converting",
  },
  {
    id: "housing",
    title: "Housing",
    blurb: "The housing step, and anything holding it closed.",
    preview: "Selected · actionable · blocked",
    icon: "⌂",
    accent: "amber",
    recommended: false,
    recommendation: "Good for deposit-to-bed visibility",
  },
  {
    id: "registrar",
    title: "Records & documents",
    blurb: "Transcripts and the documents waiting on a decision.",
    preview: "Transcripts · uploads · reviews",
    icon: "▤",
    accent: "navy",
    recommended: false,
    recommendation: "Handy when the review queue backs up",
  },
];

export const BREW_DETAIL_LEVELS: BrewDetailLevelId[] = ["glance", "context", "deep"];

export const BREW_SOURCES: BrewSourceDefinition[] = [
  {
    id: "pulse",
    title: "Institutional Pulse",
    kicker: "Keep a pulse on what matters",
    description:
      "We bring your most important institutional goals and KPIs from your systems every morning\u2014so you can see where things stand and whether you\u2019re moving in the right direction.",
    source: "Offers, payments, and journeys in your Audentra database",
    icon: "chart",
    accent: "teal",
    recommended: true,
    details: {
      glance: {
        title: "At a Glance",
        kicker: "The essentials",
        description:
          "See your most important KPIs, where they stand today, and how they\u2019ve changed since yesterday, the last 7 or 30 days, and this time last year.",
        tag: "Fast scan",
      },
      context: {
        title: "With Context",
        kicker: "Goals & progress",
        description:
          "Add your target, target date, and progress toward the goal so you can immediately see whether performance is on track.",
        tag: "Decision context",
      },
      deep: {
        title: "Deep Dive",
        kicker: "Trends & trajectory",
        description:
          "Add trends and trajectory to understand the pace of change, whether momentum is improving, and where performance may be heading.",
        tag: "Deeper insight",
      },
    },
  },
  {
    id: "news",
    title: "Higher Education News",
    kicker: "Stay ahead of what\u2019s happening in higher education",
    description:
      "We bring the higher-education stories that would change how your own figures read\u2014policy, aid, and the moves peer institutions are already making.",
    source: "An outside editorial feed, credited and linked on every card",
    icon: "records",
    accent: "navy",
    recommended: true,
    details: {
      glance: {
        title: "At a Glance",
        kicker: "The essentials",
        description:
          "See the headlines that touch enrollment, each with its publisher, its date, and a one-line summary you can scan in seconds.",
        tag: "Fast scan",
      },
      context: {
        title: "With Context",
        kicker: "Why it matters",
        description:
          "Add why a story reached your desk: the part of your funnel it touches and the figure in this brief it would move.",
        tag: "Decision context",
      },
      deep: {
        title: "Deep Dive",
        kicker: "What it means for you",
        description:
          "Add the read across stories\u2014what is building in the sector, which of your cohorts is exposed, and what peers have already done about it.",
        tag: "Deeper insight",
      },
    },
  },
  {
    id: "calendar",
    title: "Calendar",
    kicker: "Start the day knowing what\u2019s ahead",
    description:
      "We surface what is on your schedule today and upcoming, so you can walk into your day prepared and never miss what matters most.",
    source: "Requirement due dates and admission offer deadlines",
    icon: "calendar",
    accent: "purple",
    recommended: true,
    details: {
      glance: {
        title: "At a Glance",
        kicker: "The essentials",
        description:
          "See your schedule for today and tomorrow with key meetings, times, and participants\u2014so you know what is next at a glance.",
        tag: "Fast scan",
      },
      context: {
        title: "With Context",
        kicker: "Why it matters",
        description:
          "Add meeting purpose, location and links, and flags for conflicts or prep items so you can prepare and prioritize.",
        tag: "Decision context",
      },
      deep: {
        title: "Deep Dive",
        kicker: "What it means for you",
        description:
          "Add your full week view, time blocking insights, workload balance, and travel or prep recommendations to help you plan your time smarter.",
        tag: "Deeper insight",
      },
    },
  },
  {
    id: "email",
    title: "Email",
    kicker: "See what needs your attention in your inbox",
    description:
      "We surface the messages most relevant to you each morning, so you can quickly see what is important, what is waiting, and what needs your attention without working through the full inbox.",
    source: "Student support conversations",
    icon: "mail",
    accent: "purple",
    recommended: true,
    details: {
      glance: {
        title: "At a Glance",
        kicker: "The essentials",
        description:
          "See your highest-priority messages with sender, subject, time, and a quick summary\u2014so you can scan what matters in seconds.",
        tag: "Fast scan",
      },
      context: {
        title: "With Context",
        kicker: "Why it matters",
        description:
          "Add priority signals and action cues so you can quickly understand what needs a response, a review, or a follow-up.",
        tag: "Decision context",
      },
      deep: {
        title: "Deep Dive",
        kicker: "What it means for you",
        description:
          "Go beyond individual messages with inbox patterns, response priorities, and follow-up insights to help you manage communication more proactively.",
        tag: "Deeper insight",
      },
    },
  },
  {
    id: "actions",
    title: "Action Center",
    kicker: "Know what needs attention today",
    description:
      "Your command center for enrollment work\u2014tasks, follow-ups, approvals, alerts, student issues, and workload signals\u2014so you know what needs attention and why.",
    source: "Open work items, approvals, and alerts on the task board",
    icon: "checklist",
    accent: "blue",
    recommended: true,
    details: {
      glance: {
        title: "At a Glance",
        kicker: "What needs attention",
        description:
          "See the most important items requiring your attention today\u2014overdue work, upcoming deadlines, student risks, approvals, and critical alerts.",
        tag: "Summary view",
      },
      context: {
        title: "With Context",
        kicker: "What needs to happen",
        description:
          "Add priority, reason, owner, due date, student context, and the recommended next step so you can quickly understand what to do and why.",
        tag: "Actionable context",
      },
      deep: {
        title: "Deep Dive",
        kicker: "Where the operation is under pressure",
        description:
          "See patterns across the operation\u2014workload, bottlenecks, aging work, emerging risks, recurring issues, and where resources may need to shift.",
        tag: "Operational insight",
      },
    },
  },
  {
    id: "intelligence",
    title: "Institutional Intelligence",
    kicker: "See what your data is telling you",
    description:
      "We read across your canonical records for the cohorts that are stuck, why they are stuck, and who owns the fix\u2014so the pattern reaches you before the escalation does.",
    source: "Requirements, documents, and aid records",
    icon: "spark",
    accent: "amber",
    recommended: true,
    details: {
      glance: {
        title: "At a Glance",
        kicker: "What we found",
        description:
          "See each finding in a single line: the cohort that is stuck and how far it has slipped, ranked by how much it holds up.",
        tag: "Fast scan",
      },
      context: {
        title: "With Context",
        kicker: "Who it affects",
        description:
          "Add the affected cohort stated against your roster, the drivers behind it, and the stage of the funnel it is holding closed.",
        tag: "Decision context",
      },
      deep: {
        title: "Deep Dive",
        kicker: "What to do about it",
        description:
          "Add the full reasoning\u2014the evidence behind the finding, the named students inside the cohort, and the next step we would take.",
        tag: "Deeper insight",
      },
    },
  },
];

export const BREW_DELIVERY_TIMES: { id: BrewDeliveryTime; label: string; caption: string }[] = [
  { id: "06:00", label: "6:00 AM", caption: "Before the commute" },
  { id: "06:30", label: "6:30 AM", caption: "Early desk time" },
  { id: "07:00", label: "7:00 AM", caption: "Most people pick this" },
  { id: "07:30", label: "7:30 AM", caption: "Just before stand-up" },
];

/* ----------------------------------------------------------------- defaults */

export const DEFAULT_BREW_TOPICS: BrewTopicId[] = BREW_TOPICS.filter(
  (topic) => topic.recommended,
).map((topic) => topic.id);

/**
 * Everything on, at the level the card marks as the essentials. A first-time
 * reader sees the whole brief and turns things off, rather than meeting an
 * empty page and having to guess what could fill it.
 */
export const DEFAULT_BREW_SOURCES: Record<BrewSourceId, BrewSourcePreference> = {
  pulse: { enabled: true, detail: "glance" },
  news: { enabled: true, detail: "glance" },
  calendar: { enabled: true, detail: "glance" },
  email: { enabled: true, detail: "glance" },
  actions: { enabled: true, detail: "glance" },
  intelligence: { enabled: true, detail: "context" },
};

export const BREW_SOURCE_IDS: BrewSourceId[] = BREW_SOURCES.map((source) => source.id);
export const BREW_TOPIC_IDS: BrewTopicId[] = BREW_TOPICS.map((topic) => topic.id);

export const topicById = (id: BrewTopicId) => BREW_TOPICS.find((topic) => topic.id === id);
export const sourceById = (id: BrewSourceId) =>
  BREW_SOURCES.find((source) => source.id === id) ?? BREW_SOURCES[0];
