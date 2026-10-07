import type { BrewInsight, BrewTopicId } from "./types";

/** User-supplied design examples only; never a platform forecast or student read.
 * These scenarios use $24K per student, as specified in the reference mockup.
 */
const examples = [
  {
    "id": "deposited-aid-delay",
    "topic": "financial_aid",
    "label": "Financial aid delays",
    "title": "Financial aid delays are putting 38 deposited students at risk.",
    "summary": "38 deposited students have been waiting more than 7 days for aid review, which is 2.4x longer than the institution's typical review time. Most have completed their other enrollment requirements.",
    "confidence": 94,
    "exposed": 38,
    "lossRange": [
      8,
      11
    ],
    "netTuitionPerStudent": 24000,
    "note": "Current model implies roughly 21%-29% of this exposed cohort may fail to enroll if the delay persists.",
    "whyItMatters": "aid review is now the main unresolved barrier for this cohort, not student follow-through.",
    "recommendation": "Prioritize these 38 files for review within 48 hours and contact only students who still need to take an action.",
    "evidence": "Deposited students with aid reviews exceeding seven days historically enrolled at 68%, compared with 91% for otherwise-similar students resolved within three days. Of the 38 students currently beyond that threshold, 29 have completed at least 80% of remaining onboarding requirements.",
    "owner": "Financial Aid"
  },
  {
    "id": "registration-capacity",
    "topic": "enrollment",
    "label": "Registration capacity",
    "title": "Course capacity is blocking 32 enrollment-ready students from registering.",
    "summary": "96 incoming students are ready for a required first-year course, but only 64 unreserved seats remain across eligible sections.",
    "confidence": 91,
    "exposed": 32,
    "lossRange": [
      7,
      10
    ],
    "netTuitionPerStudent": 24000,
    "note": "Current model implies roughly 22%-31% of these students may fail to enroll if no viable registration path is available.",
    "whyItMatters": "these students cannot complete registration under the current schedule even if they take every required action on time.",
    "recommendation": "Add capacity or approve an alternate course path before the registration deadline. Avoid another generic reminder campaign to this cohort.",
    "evidence": "Audentra matched student program requirements, prerequisite completion, registration eligibility, and live section capacity. The eligible cohort exceeds available unreserved seats by 32.",
    "owner": "Registrar"
  },
  {
    "id": "deposited-disengagement",
    "topic": "enrollment",
    "label": "Student engagement",
    "title": "54 deposited students have gone quiet at a point when engagement usually predicts enrollment.",
    "summary": "54 deposited students have had no portal activity, event participation, or two-way response for at least 10 days. Comparable active students are enrolling at a materially higher rate.",
    "confidence": 88,
    "exposed": 54,
    "lossRange": [
      9,
      13
    ],
    "netTuitionPerStudent": 24000,
    "note": "Current model implies roughly 17%-24% of this cohort represents incremental enrollment risk tied to sustained disengagement.",
    "whyItMatters": "the pattern is surfacing before a formal enrollment failure appears in the headline KPIs.",
    "recommendation": "Launch a counselor-led recovery play focused on students with unresolved checklist items and no recent two-way contact.",
    "evidence": "Among otherwise-similar deposited students at the same stage of the cycle, students with meaningful activity in the past seven days enrolled at 89%, compared with 68% among students inactive for 10 or more days.",
    "owner": "Enrollment Management"
  }
];

export const DEMO_EMERGING_INSIGHTS: BrewInsight[] = examples.map((example) => {
  const loss = example.lossRange.join("–");
  const tuition = example.lossRange.map((count) => `$${count * example.netTuitionPerStudent / 1000}K`).join("–");
  const stats = `${example.exposed} students exposed · ${loss} estimated loss risk · ${tuition} net tuition at risk`;
  return {
    id: example.id,
    topic: example.topic as BrewTopicId,
    label: example.label,
    title: example.title,
    severity: "high",
    summary: example.summary,
    projection: example.note,
    stats: { glance: stats, context: stats, deep: stats },
    context: example.whyItMatters,
    deepDive: example.evidence,
    impactLabel: "Forecasted impact",
    impact: [
      { label: `${loss} students at risk`, tone: "negative" },
      { label: tuition, tone: "negative" },
    ],
    forecast: {
      studentsExposed: example.exposed,
      estimatedLoss: example.lossRange as [number, number],
      netTuitionPerStudent: example.netTuitionPerStudent,
      note: example.note,
    },
    whyItMatters: example.whyItMatters,
    recommendations: { glance: example.recommendation, context: example.recommendation, deep: example.recommendation },
    owner: example.owner,
    impactLevel: "High",
    confidence: example.confidence,
    destination: "students",
    cohortAvailable: false,
    cohort: {
      key: example.id,
      label: example.label,
      filter: {},
      clauses: [],
      question: `What canonical records are available about ${example.label.toLowerCase()}?`,
    },
    detail: {
      narrative: [example.whyItMatters, example.evidence],
      drivers: [
        { label: "Students exposed", value: String(example.exposed), note: "Illustrative cohort" },
        { label: "Estimated loss risk", value: loss, note: "Illustrative range, not a live forecast" },
        { label: "Net tuition at risk", value: tuition, note: "$24,000 per student in this design example" },
      ],
      breakdown: [],
      breakdownNote: "This design example does not identify a live student cohort.",
      actions: [{ title: "Recommended next move", detail: example.recommendation, owner: example.owner, due: "For review" }],
      students: [],
      studentsNote: "Sample data only; no student records were used for this finding.",
      evidence: [example.evidence, "Illustrative mockup supplied for product design; not a model output."],
    },
  };
});
