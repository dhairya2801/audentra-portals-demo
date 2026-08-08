import type { StaffOperationsWorkspace } from "@vv/contracts";
import { BREW_DEPTH_OPTIONS } from "./catalog";
import {
  BREW_CHANGES,
  BREW_EMAILS,
  BREW_INSIGHTS,
  BREW_KPIS,
  BREW_MEETINGS,
  BREW_NEWS,
  BREW_PRIORITIES,
  BREW_QUICK_LINKS,
  attendeeAvatar,
} from "./content";
import type {
  BrewBriefing,
  BrewChange,
  BrewInsight,
  BrewNumberFormat,
  BrewPreferences,
  BrewPriority,
  EdwardAnswer,
  EdwardRequest,
} from "./types";

export {
  BREW_CHANGES,
  BREW_EMAILS,
  BREW_INSIGHTS,
  BREW_KPIS,
  BREW_MEETINGS,
  BREW_NEWS,
  BREW_PRIORITIES,
  BREW_QUICK_LINKS,
  attendeeAvatar,
};

/* ---------------------------------------------------------------- formatting */

const INT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Formats a KPI value. Shared by the static card and the animated ticker. */
export function formatBrewNumber(value: number, format: BrewNumberFormat): string {
  switch (format) {
    case "percent":
      return `${ONE_DECIMAL.format(value)}%`;
    case "currencyM":
      return `$${ONE_DECIMAL.format(value)}M`;
    case "currencyK":
      return `$${INT.format(value)}K`;
    default:
      return INT.format(value);
  }
}

/* ------------------------------------------------------------------- builder */

const depthOption = (preferences: BrewPreferences) =>
  BREW_DEPTH_OPTIONS.find((option) => option.id === preferences.depth) ?? BREW_DEPTH_OPTIONS[1];

const readTimeFor = (preferences: BrewPreferences) =>
  preferences.depth === "headlines" ? 2 : preferences.depth === "deep" ? 7 : 4;

const kpiLimit = (preferences: BrewPreferences) => (preferences.depth === "deep" ? 8 : 6);
const changeLimit = (preferences: BrewPreferences) =>
  preferences.depth === "headlines" ? 4 : preferences.depth === "deep" ? 7 : 5;
const priorityLimit = (preferences: BrewPreferences) => (preferences.depth === "deep" ? 5 : 3);
const newsLimit = (preferences: BrewPreferences) => (preferences.depth === "deep" ? 6 : 4);
const meetingLimit = (preferences: BrewPreferences) => (preferences.depth === "headlines" ? 3 : 5);
const emailLimit = (preferences: BrewPreferences) =>
  preferences.depth === "headlines" ? 3 : preferences.depth === "deep" ? 5 : 4;

function deckFor(preferences: BrewPreferences, urgent: number): string {
  const time = preferences.deliveryTime === "06:00" ? "6:00" : preferences.deliveryTime.replace(/^0/, "");
  if (preferences.tone === "narrative") {
    return `Here is your enrollment executive morning brief as of today ${time} AM ET. ${
      urgent > 3
        ? "A few decisions today can protect this week's momentum."
        : "Momentum is healthy — conversion still deserves the closest look."
    }`;
  }
  return `Here is your enrollment executive morning brief as of today ${time} AM ET.`;
}

/**
 * Assembles today's briefing from the reader's preferences.
 *
 * Items tagged `workspace` are recomputed here against the live staff workspace
 * so the label on screen stays truthful; everything else is clearly modeled.
 */
export function buildBrewBriefing(
  workspace: StaffOperationsWorkspace,
  preferences: BrewPreferences,
): BrewBriefing {
  const teams = new Set(preferences.teams);
  const cohort = workspace.cohort;
  const highRisk = cohort.filter((student) => student.risk.band === "high" || student.risk.band === "critical");
  const recommendedToday = cohort.filter((student) => student.recommendedAction.recommendedToday);
  const openTasks = workspace.actionCenter.items.filter((item) => item.status !== "done");
  const urgentTasks = openTasks.filter((item) => item.priority === "urgent" || item.escalated);

  /* Live-workspace substitutions ------------------------------------------- */

  const insights: BrewInsight[] = BREW_INSIGHTS.filter((insight) => teams.has(insight.team)).map(
    (insight) => {
      if (insight.id !== "verification-backlog") return insight;
      const students = highRisk.slice(0, 3).map((student) => ({
        name: student.name,
        program: student.programName,
        note: student.recommendedAction.recommendedToday
          ? "Recommended for action today"
          : `Risk signal: ${student.risk.category}`,
        risk: (student.risk.band === "critical" ? "critical" : student.risk.band === "high" ? "high" : "medium") as
          | "critical"
          | "high"
          | "medium",
      }));
      return students.length ? { ...insight, detail: { ...insight.detail, students } } : insight;
    },
  );

  const changes: BrewChange[] = BREW_CHANGES.filter((change) => teams.has(change.team)).map((change) => {
    if (change.id !== "early-alerts") return change;
    return {
      ...change,
      title: `${recommendedToday.length} intervention recommendation${recommendedToday.length === 1 ? "" : "s"} are ready`,
      detail: `${highRisk.length} students in your workspace are high or critical risk with a clear next action.`,
      metric: `${recommendedToday.length} ready`,
    };
  });

  const priorities: BrewPriority[] = BREW_PRIORITIES.filter((priority) => teams.has(priority.team)).map(
    (priority) => {
      if (priority.id !== "verification-surge") return priority;
      return {
        ...priority,
        breakdown: [
          ...priority.breakdown,
          { label: "Open staff work items", value: String(openTasks.length) },
          { label: "Urgent or escalated", value: String(urgentTasks.length) },
        ],
      };
    },
  );

  /* Section assembly -------------------------------------------------------- */

  // Give every followed team at least one tile before filling the board in
  // editorial order, so a reader who only follows Housing still gets a pulse.
  const eligibleKpis = BREW_KPIS.filter((kpi) => teams.has(kpi.team));
  const limit = kpiLimit(preferences);
  const chosen = new Set(
    preferences.teams
      .map((team) => eligibleKpis.find((kpi) => kpi.team === team))
      .filter((kpi) => kpi !== undefined)
      .slice(0, limit),
  );
  for (const kpi of eligibleKpis) {
    if (chosen.size >= limit) break;
    chosen.add(kpi);
  }
  const kpis = eligibleKpis.filter((kpi) => chosen.has(kpi));

  const news = BREW_NEWS.filter((item) => item.teams.some((team) => teams.has(team)));
  const emails = BREW_EMAILS.filter((email) => teams.has(email.team) || email.priority === "high");

  return {
    greetingName: workspace.currentStaff.name.split(" ")[0] || "there",
    deck: deckFor(preferences, urgentTasks.length),
    readTimeMinutes: readTimeFor(preferences),
    updatedAt: workspace.generatedAt,
    deliveryLabel: preferences.deliveryTime.replace(/^0/, ""),
    insights: preferences.sections.insights ? insights.slice(0, depthOption(preferences).storyCount) : [],
    kpis: preferences.sections.pulse ? kpis : [],
    changes: preferences.sections.changes ? changes.slice(0, changeLimit(preferences)) : [],
    meetings: preferences.connectors.calendar ? BREW_MEETINGS.slice(0, meetingLimit(preferences)) : [],
    emails: preferences.connectors.outlook ? emails.slice(0, emailLimit(preferences)) : [],
    priorities: preferences.sections.priorities ? priorities.slice(0, priorityLimit(preferences)) : [],
    news: preferences.sections.news ? news.slice(0, newsLimit(preferences)) : [],
    quickLinks: BREW_QUICK_LINKS,
    inbox: {
      unread: preferences.connectors.outlook ? 23 : 0,
      highPriority: preferences.connectors.outlook ? emails.filter((email) => email.priority === "high").length : 0,
      meetings: preferences.connectors.calendar ? Math.min(BREW_MEETINGS.length, meetingLimit(preferences)) : 0,
      meetingsHighPriority: preferences.connectors.calendar
        ? BREW_MEETINGS.slice(0, meetingLimit(preferences)).filter((meeting) => meeting.priority === "high").length
        : 0,
    },
  };
}

/* -------------------------------------------------------------------- edward */

export const EDWARD_SUGGESTIONS = [
  "What should I pay attention to today?",
  "What are our biggest enrollment risks?",
  "What changed since yesterday?",
  "Summarize today's important emails.",
  "How should I prepare for the 8:30 huddle?",
] as const;

function summarize(briefing: BrewBriefing, context: string): EdwardAnswer {
  const bullets = [
    ...briefing.insights.slice(0, 2).map((insight) => `${insight.title} — ${insight.recommendedAction}`),
    ...briefing.priorities.slice(0, 2).map((priority) => `${priority.title}: ${priority.detail}`),
  ];
  return {
    question: `Summarize ${context.toLowerCase()}`,
    answer: bullets.length
      ? "Here is the short version of what is in front of you."
      : "There is nothing material in that section today.",
    bullets: bullets.slice(0, 4),
    followUp: "If you only do one thing this morning, clear the aid files blocking commuter deposits.",
  };
}

function insightsAnswer(briefing: BrewBriefing, context: string): EdwardAnswer {
  const insight = briefing.insights[0];
  if (!insight) {
    return {
      question: `What stands out in ${context.toLowerCase()}?`,
      answer: "Nothing in that section crosses the threshold I would bring to you today.",
      followUp: "Turn on more teams in Customize if you want a wider read.",
    };
  }
  return {
    question: `What stands out in ${context.toLowerCase()}?`,
    answer: `${insight.title}. ${insight.summary}`,
    bullets: [
      ...insight.detail.drivers.slice(0, 3).map((driver) => `${driver.label}: ${driver.value} — ${driver.note}`),
      `Recommended: ${insight.recommendedAction}`,
    ],
    followUp: `Confidence is ${insight.confidence}%. ${insight.projection}`,
  };
}

function draftReply(briefing: BrewBriefing, emailId?: string): EdwardAnswer {
  const email = briefing.emails.find((item) => item.id === emailId) ?? briefing.emails[0];
  if (!email) {
    return {
      question: "Draft a reply",
      answer: "Outlook is not connected, so I do not have a message to reply to.",
      followUp: "Turn on the Email connection in Customize to use drafting.",
    };
  }
  return {
    question: `Draft a reply to "${email.subject}"`,
    answer: `Here is a draft answering ${email.senderRole.split(",")[0]} directly. I pulled the numbers from today's briefing — review before sending.`,
    bullets: email.asks.map((ask) => `Addresses: ${ask}`),
    draft: {
      subject: email.suggestedReply.subject,
      body: [
        email.suggestedReply.greeting,
        ...email.suggestedReply.body,
        email.suggestedReply.signoff,
      ],
    },
    followUp: "This is a synthetic draft for the demo. Nothing is sent and no mailbox is contacted.",
  };
}

function prepAnswer(briefing: BrewBriefing, context: string): EdwardAnswer {
  const meeting = briefing.meetings[0];
  if (!meeting) {
    return {
      question: `Prepare me for ${context.toLowerCase()}`,
      answer: "Your calendar is not connected, so I cannot see today's agenda.",
      followUp: "Turn on the Calendar connection in Customize.",
    };
  }
  return {
    question: `How should I prepare for ${meeting.title}?`,
    answer: `${meeting.time} · ${meeting.duration} · organized by ${meeting.organizer}. Here is what matters.`,
    bullets: [...meeting.prep, ...meeting.agenda.slice(0, 2)],
    followUp: "You own the verification staffing decision — everything else on that agenda is informational.",
  };
}

export function answerEdward(request: EdwardRequest, briefing: BrewBriefing): EdwardAnswer {
  if (request.mode === "draft_reply") return draftReply(briefing, request.emailId);
  if (request.mode === "summarize") return summarize(briefing, request.context);
  if (request.mode === "insights") return insightsAnswer(briefing, request.context);
  if (request.mode === "prep") return prepAnswer(briefing, request.context);

  const question = (request.question ?? "").trim();
  const normalized = question.toLowerCase();

  if (normalized.includes("more useful") || normalized.includes("feedback")) {
    return {
      question,
      answer: "Tell me what you skipped this morning and I will stop sending it.",
      bullets: [
        "Use Customize to change which teams, sections, and length you get.",
        "Ask me to summarize any panel and I will compress it into three lines.",
        "If a number looks wrong, open it — every KPI shows its definition and owner.",
      ],
      followUp: "Preferences apply from tomorrow's edition onward, and you can change them any morning.",
    };
  }

  if (normalized.includes("email") || normalized.includes("inbox")) {
    return briefing.emails.length
      ? {
          question,
          answer: `${briefing.inbox.highPriority} of your messages need a decision before noon.`,
          bullets: briefing.emails
            .filter((email) => email.priority === "high")
            .slice(0, 3)
            .map((email) => `${email.sender}: ${email.summary}`),
          followUp:
            "Handle the provost's reallocation request first — it is tied to today's commuter strategy and she asked for a read before noon.",
        }
      : {
          question,
          answer: "Email is not connected, so I cannot summarize your inbox.",
          followUp: "Turn on the Email connection in Customize.",
        };
  }

  if (normalized.includes("prepare") || normalized.includes("huddle") || normalized.includes("meeting")) {
    return prepAnswer(briefing, "your next meeting");
  }

  if (normalized.includes("changed") || normalized.includes("yesterday") || normalized.includes("overnight")) {
    return {
      question,
      answer: briefing.changes.length
        ? "Three things moved overnight, and only one of them needs you."
        : "Nothing material moved overnight in the teams you follow.",
      bullets: briefing.changes.slice(0, 3).map((change) => `${change.time} — ${change.title}`),
      followUp: "Verification throughput improving is real progress. The commuter deposit slide is the one to act on.",
    };
  }

  if (normalized.includes("risk") || normalized.includes("worry") || normalized.includes("concern")) {
    return {
      question,
      answer: "The biggest risk is friction after students have already shown intent.",
      bullets: [
        "312 commuter admits are one document away from depositing.",
        "Verification median wait is 11.2 days against a 5-day standard.",
        "Deposit rate is 1.7 points behind last cycle — roughly 104 enrolled students.",
      ],
      followUp: "Clear the operational blockers before spending anything on additional outreach.",
    };
  }

  if (normalized.includes("news") || normalized.includes("policy") || normalized.includes("industry")) {
    return briefing.news.length
      ? {
          question,
          answer: "Two of today's stories bear directly on decisions you are already making.",
          bullets: briefing.news.slice(0, 3).map((item) => `${item.sourceName}: ${item.headline}`),
          followUp:
            "The EAB piece argues against raising awards for stalled students — worth citing in your reply to the provost.",
        }
      : {
          question,
          answer: "Higher ed news is turned off in your briefing preferences.",
          followUp: "Turn it back on in Customize if you want the industry read.",
        };
  }

  if (normalized.includes("yield") || normalized.includes("deposit") || normalized.includes("tuition")) {
    return {
      question,
      answer:
        "Volume is fine. Conversion is the problem. Deposit rate is 40.1% against a 45.0% target, and commuter explains 78% of the gap.",
      bullets: [
        "Net tuition projects to $98.4M, up 5.2% year over year but $11.6M below plan.",
        "Every point of deposit rate is worth about 61 enrolled students.",
        "The commuter segment converts at 33.2%, down 6.4 points year over year.",
      ],
      followUp: "The fastest lever available today is verification throughput, not additional aid.",
    };
  }

  return {
    question: question || "What should I pay attention to today?",
    answer: "Start with the students whose intent is already visible but whose next step is blocked.",
    bullets: briefing.priorities.slice(0, 3).map((priority) => `${priority.title}: ${priority.detail}`),
    followUp: "Then use the 8:30 huddle to assign owners while the room is together.",
  };
}
