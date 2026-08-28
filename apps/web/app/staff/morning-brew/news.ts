import type { BrewNewsItem } from "./types";

/**
 * Higher Education News — the one band of this brief that is not the
 * institution's own data.
 *
 * A curated editorial list, held here as a constant and stated as such on the
 * section itself. It is kept deliberately separate from `data.ts`: nothing in
 * here is a count of anything, nothing is joined to a student, and no figure
 * from a story is ever mixed into a KPI. Each card carries its publisher, its
 * date, and a link out, so a reader can go and check the claim rather than take
 * it from us.
 *
 * Cover art is our own, drawn for these stories and served from
 * `public/media/news`. Publishers' photography is theirs, and a briefing that
 * hotlinked it would be both a bandwidth theft and a broken image the first
 * time they moved a file.
 *
 * When a real feed arrives it replaces this constant and nothing else: the
 * section already renders whatever list it is handed.
 */
export const HIGHER_ED_NEWS: BrewNewsItem[] = [
  {
    id: "news-summer-melt",
    title: "Summer melt widened again at public four-years, new federal data shows",
    summary:
      "One in seven deposited students did not enrol last fall — the widest gap since the series began.",
    publisher: "Inside Higher Ed",
    publisherMark: "IHE",
    publishedLabel: "Aug 18, 2026",
    url: "https://www.insidehighered.com/",
    image: "/media/news/enrollment-trends.svg",
    imageAlt: "An open notebook on a desk beside a coffee cup, with an enrollment chart on the page",
    topic: "admissions",
    bearing: "Bears on your deposited-to-enrolled step.",
    implication:
      "Your own deposited group is the cohort to watch: the national gap opens between the deposit and the first class, which is exactly the stretch your Action Center items cover.",
  },
  {
    id: "news-fafsa-october",
    title: "Education Department commits to an October 1 FAFSA opening for 2027–28",
    summary: "Aid offices would get their first full-length filing season since the rewrite began.",
    publisher: "Higher Ed Dive",
    publisherMark: "HED",
    publishedLabel: "Aug 14, 2026",
    url: "https://www.highereddive.com/",
    image: "/media/news/fafsa-pressure.svg",
    imageAlt: "A federal building with a clock above its portico",
    topic: "financial_aid",
    bearing: "Bears on aid document turnaround.",
    implication:
      "A full season moves aid completion earlier, which pulls your verification and document queues forward rather than shrinking them.",
  },
  {
    id: "news-verification-low",
    title: "Verification selections fall to a decade low after the FAFSA rewrite",
    summary: "Aid offices report smaller queues and a shift in which files the department flags.",
    publisher: "Higher Ed Dive",
    publisherMark: "HED",
    publishedLabel: "Aug 12, 2026",
    url: "https://www.highereddive.com/",
    image: "/media/news/verification-guidance.svg",
    imageAlt: "A document carrying a verified seal",
    topic: "financial_aid",
    bearing: "Bears on your outstanding aid requirements.",
    implication:
      "Fewer selections nationally does not mean fewer here: the flagging shifted rather than stopped, so read your own selected-file count before planning the queue down.",
  },
  {
    id: "news-tuition-resets",
    title: "Two more New England privates announce tuition resets for fall 2027",
    summary: "Both cite the discount rate rather than enrolment, and both keep their aid budgets flat.",
    publisher: "The Chronicle of Higher Education",
    publisherMark: "CHE",
    publishedLabel: "Aug 6, 2026",
    url: "https://www.chronicle.com/",
    image: "/media/news/yield-strategies.svg",
    imageAlt: "A hand holding a phone showing a rising yield chart",
    topic: "admissions",
    bearing: "Bears on your offer-to-acceptance step.",
    implication:
      "A reset changes the sticker a family compares your offer against, so it lands on acceptance rather than on applications.",
  },
  {
    id: "news-direct-admission",
    title: "Four more states extend direct admission to every public four-year",
    summary:
      "Students receive an offer before they apply, and the application step moves after the decision.",
    publisher: "Inside Higher Ed",
    publisherMark: "IHE",
    publishedLabel: "Aug 4, 2026",
    url: "https://www.insidehighered.com/",
    image: "/media/news/direct-admission.svg",
    imageAlt: "Two campus buildings joined by an arc of connected points",
    topic: "admissions",
    bearing: "Bears on your application volume and your admit rate.",
    implication:
      "Where this lands, applications rise and yield falls: the same students are admitted at more institutions, so an offer buys less commitment than it used to.",
  },
  {
    id: "news-advising-analytics",
    title: "Advising teams put caseload analytics in front of every student conversation",
    summary:
      "Directors report fewer escalations where advisers see the whole record before they pick up the phone.",
    publisher: "Higher Ed Dive",
    publisherMark: "HED",
    publishedLabel: "Jul 29, 2026",
    url: "https://www.highereddive.com/",
    image: "/media/news/ai-enrollment.svg",
    imageAlt: "An auditorium facing a screen showing a rising chart",
    topic: "student_success",
    bearing: "Bears on your multi-blocker cohort.",
    implication:
      "This is the argument for working your 214 three-or-more-blocker students as one list: the gain comes from one person seeing the whole record, not from more contact.",
  },
];
