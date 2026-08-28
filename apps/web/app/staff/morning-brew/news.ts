import type { BrewNewsItem } from "./types";

/**
 * Higher Education News — the one band of this brief that is not the tenant's
 * own data.
 *
 * The platform serves no news feed, so this is a curated editorial list, held
 * here as a constant and stated as such on the section itself. It is kept
 * deliberately separate from `data.ts`: nothing in here is a count of anything,
 * nothing in here is joined to a student, and no figure from a story is ever
 * mixed into a KPI. Each card carries its publisher, its date, and a link out,
 * so the reader can go and check the claim rather than take it from us.
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
    topic: "admissions",
    bearing: "Bears on your deposited-to-enrolled step.",
    implication:
      "Your own deposited group is the cohort to watch here: the national gap opens between the deposit and the first class, which is exactly the stretch your Action Center items cover.",
  },
  {
    id: "news-fafsa-october",
    title: "Education Department commits to an October 1 FAFSA opening for 2027–28",
    summary: "Aid offices would get their first full-length filing season since the rewrite began.",
    publisher: "Higher Ed Dive",
    publisherMark: "HED",
    publishedLabel: "Aug 14, 2026",
    url: "https://www.highereddive.com/",
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
    topic: "admissions",
    bearing: "Bears on your offer-to-acceptance step.",
    implication:
      "A reset changes the sticker a family compares your offer against, so it lands on acceptance rather than on applications.",
  },
  {
    id: "news-deposit-deadline",
    title: "More public universities push the deposit deadline past May 1",
    summary: "Admissions officers say the extra fortnight moves the deposit, not the melt.",
    publisher: "Inside Higher Ed",
    publisherMark: "IHE",
    publishedLabel: "Aug 4, 2026",
    url: "https://www.insidehighered.com/",
    topic: "admissions",
    bearing: "Bears on your offer response deadlines.",
    implication:
      "If peers move and you do not, your response deadline becomes the earliest one a shared applicant faces — which shows up in your Calendar section before it shows up in deposits.",
  },
  {
    id: "news-housing-holds",
    title: "Housing holds are the fastest-growing block on enrolment, survey finds",
    summary:
      "Registrars report more students cleared for classes but still without an assigned bed.",
    publisher: "Higher Ed Dive",
    publisherMark: "HED",
    publishedLabel: "Jul 29, 2026",
    url: "https://www.highereddive.com/",
    topic: "housing",
    bearing: "Bears on your deposit-to-bed step.",
    implication:
      "Worth reading against your own housing step: a student who is academically clear and unhoused is counted as enrolled everywhere except where it matters.",
  },
];
