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
 * declared exception: Higher Ed News is an outside editorial feed, and `news.ts`
 * says so in as many words. Everything else is a count of rows in the tenant's
 * own database.
 *
 * A source's `title` is also the section heading it produces in the brief, so
 * the question a reader answered in setup and the band they meet the next
 * morning carry the same name.
 */

export const BREW_TOPICS: BrewTopic[] = [
  {
    id: "financial_aid",
    title: "Financial Aid",
    blurb: "Where aid files are stuck, and who is waiting on whom.",
    preview: "Verification · packaging · disbursement",
    icon: "aid",
    accent: "purple",
    recommended: true,
    recommendation: "Aid blocks the most enrollment steps",
  },
  {
    id: "admissions",
    title: "Admissions",
    blurb: "Applications, admits, and the pace the funnel is filling at.",
    preview: "Applications · admits · transfer volume",
    icon: "applications",
    accent: "blue",
    recommended: true,
    recommendation: "The top of the funnel your team is measured on",
  },
  {
    id: "enrollment",
    title: "Enrollment",
    blurb: "Who paid, who cleared, and who will actually be in a seat.",
    preview: "Deposits · deposit rate · yield · net tuition",
    icon: "deposit",
    accent: "teal",
    recommended: true,
    recommendation: "Where an admit quietly stops converting",
  },
  {
    id: "housing",
    title: "Housing",
    blurb: "The housing step, and anything holding it closed.",
    preview: "Contracts signed · assignments · waitlist",
    icon: "housing",
    accent: "amber",
    recommended: true,
    recommendation: "Good for deposit-to-bed visibility",
  },
  {
    id: "campus_life",
    title: "Campus Life",
    blurb: "Orientation, admitted-student events, and campus visits.",
    preview: "Orientation · yield events · visit volume",
    icon: "events",
    accent: "navy",
    recommended: true,
    recommendation: "The yield lever that is not a discount",
  },
];

export const BREW_DETAIL_LEVELS: BrewDetailLevelId[] = ["glance", "context", "deep"];

export const BREW_SOURCES: BrewSourceDefinition[] = [
  {
    id: "pulse",
    title: "Institutional Pulse",
    kicker: "Keep a pulse on what matters",
    description:
      "We bring the figures that carry your cycle from your systems every morning—where each one stands today, how far it has moved since the last time it was worth checking, and how it is tracking against the goal you set for it.",
    source: "Offers, payments, and journeys in your Audentra database",
    icon: "pulse",
    accent: "teal",
    recommended: true,
    levels: ["glance", "context", "deep"],
    details: {
      glance: {
        title: "At a Glance",
        kicker: "The essentials",
        description:
          "The figure and where it moved. Each card cycles its comparison windows in one place—yesterday, the last 7 and 30 days, and the same day last year—so one card carries one reading at a time.",
        tag: "Fast scan",
      },
      context: {
        title: "With Context",
        kicker: "Goals & progress",
        description:
          "Add the goal beside the figure—650 of 900, 72% of the way there, due by the date it has to be met. You can see what is on pace and what is not without opening anything.",
        tag: "Decision context",
      },
      deep: {
        title: "Deep Dive",
        kicker: "The whole run",
        description:
          "Add thirty days as a chart—last year behind it, this year's actuals on top, and the pace you are running at continued as a dotted line—with one sentence reading the trend.",
        tag: "Deeper insight",
      },
    },
  },
  {
    id: "news",
    title: "Higher Ed News",
    kicker: "Stay ahead of what’s happening in higher education",
    description:
      "We bring the higher-education stories that would change how your own figures read—policy, aid, and the moves peer institutions are already making.",
    source: "An outside editorial feed, credited and linked on every card",
    icon: "broadcast",
    accent: "navy",
    recommended: true,
    /*
     * Two depths, not three. A third, longer reading of somebody else's article
     * would have been us writing an analysis and attributing it to a headline —
     * the one place on this page where more depth meant less honesty.
     */
    levels: ["glance", "context"],
    details: {
      glance: {
        title: "At a Glance",
        kicker: "The essentials",
        description:
          "See the headlines that touch enrollment, each with its publisher, its date, and how long it takes to read.",
        tag: "Fast scan",
      },
      context: {
        title: "With Context",
        kicker: "Why it reached you",
        description:
          "Add the line that says why the story is in your brief: the office it lands on and the figure of yours it would move.",
        tag: "Decision context",
      },
      deep: {
        title: "Deep Dive",
        kicker: "Not offered here",
        description:
          "Higher Ed News is somebody else's reporting. We will tell you why a story reached you; we will not write a longer version of it.",
        tag: "Not offered",
      },
    },
  },
  {
    id: "calendar",
    title: "Calendar",
    kicker: "Start the day knowing what’s ahead",
    description:
      "We bring today’s meetings in order—who is in them, how long they run, and which ones carry a decision—so the first thing you read is the shape of your own day.",
    source: "Your calendar, and the enrollment work attached to each invitation",
    icon: "calendar",
    accent: "purple",
    recommended: true,
    levels: ["glance", "context", "deep"],
    details: {
      glance: {
        title: "At a Glance",
        kicker: "The essentials",
        description:
          "Today in time order: when it starts, how long it runs, who is in it, and how urgent it is.",
        tag: "Fast scan",
      },
      context: {
        title: "With Context",
        kicker: "What to do about it",
        description:
          "Add the prep line on every high-priority meeting—the one thing to have read or decided before you walk in.",
        tag: "Decision context",
      },
      deep: {
        title: "Deep Dive",
        kicker: "The whole day",
        description:
          "Add the full guest list on every meeting, so you can see whose time today is really being spent and where the same room meets twice.",
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
    source: "Your connected Outlook mailbox and student support conversations",
    icon: "outlook",
    accent: "blue",
    recommended: true,
    levels: ["glance", "context", "deep"],
    details: {
      glance: {
        title: "At a Glance",
        kicker: "The essentials",
        description:
          "See your highest-priority messages with sender, subject, time, and a quick summary—so you can scan what matters in seconds.",
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
      "Your command center for enrollment work—tasks, follow-ups, approvals, alerts, student issues, and workload signals—so you know what needs attention and why.",
    source: "Open work items, approvals, and alerts on the task board",
    icon: "actions",
    accent: "blue",
    recommended: true,
    levels: ["glance", "context", "deep"],
    details: {
      glance: {
        title: "At a Glance",
        kicker: "What needs attention",
        description:
          "See the most important items requiring your attention today—overdue work, upcoming deadlines, student risks, approvals, and critical alerts.",
        tag: "Summary view",
      },
      context: {
        title: "With Context",
        kicker: "What needs to happen",
        description:
          "Add the recommended next step and the office that owns it, so you can tell what to do from what to escalate.",
        tag: "Actionable context",
      },
      deep: {
        title: "Deep Dive",
        kicker: "Where the operation is under pressure",
        description:
          "See patterns across the operation—workload, bottlenecks, aging work, emerging risks, recurring issues, and where resources may need to shift.",
        tag: "Operational insight",
      },
    },
  },
  {
    id: "intelligence",
    title: "Institutional Intelligence",
    kicker: "See what your data is telling you",
    description:
      "We read across your canonical records for the three things most likely to change your enrollment outcome this week—what is moving, what it costs if it keeps moving, and the one action that would turn it.",
    source: "Applications, payments, requirements, and aid records",
    icon: "sparkle",
    accent: "amber",
    recommended: true,
    levels: ["glance", "context", "deep"],
    details: {
      glance: {
        title: "At a Glance",
        kicker: "What we found",
        description:
          "Three findings, each as one sentence with the impact it carries and the action it asks for.",
        tag: "Fast scan",
      },
      context: {
        title: "With Context",
        kicker: "Why it reads that way",
        description:
          "Add the paragraph behind the headline: what changed, what it costs, and where the recommendation gets more specific.",
        tag: "Decision context",
      },
      deep: {
        title: "Deep Dive",
        kicker: "The whole argument",
        description:
          "Add the full reasoning—every figure the finding rests on, the range around it, and a recommendation stated tightly enough to act on this week.",
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
  pulse: { enabled: true, detail: "context" },
  news: { enabled: true, detail: "glance" },
  calendar: { enabled: true, detail: "glance" },
  email: { enabled: true, detail: "glance" },
  actions: { enabled: true, detail: "glance" },
  intelligence: { enabled: true, detail: "glance" },
};

export const BREW_SOURCE_IDS: BrewSourceId[] = BREW_SOURCES.map((source) => source.id);
export const BREW_TOPIC_IDS: BrewTopicId[] = BREW_TOPICS.map((topic) => topic.id);

export const topicById = (id: BrewTopicId) => BREW_TOPICS.find((topic) => topic.id === id);
export const sourceById = (id: BrewSourceId) =>
  BREW_SOURCES.find((source) => source.id === id) ?? BREW_SOURCES[0];

/**
 * The depth a source will actually honour.
 *
 * A reader who chose Deep Dive on a source that later stopped offering it — or
 * who is carrying a stored preference from before Higher Ed News dropped to two
 * levels — reads at the deepest level that source does offer, rather than at a
 * level it would have to invent content for.
 */
export function supportedLevel(
  id: BrewSourceId,
  level: BrewDetailLevelId,
): BrewDetailLevelId {
  const levels = sourceById(id).levels;
  return levels.includes(level) ? level : (levels.at(-1) ?? "glance");
}
