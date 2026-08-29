import type { BrewNewsItem } from "./types";

/**
 * Higher Ed News — the one band of this brief that is not the institution's own
 * data.
 *
 * A curated editorial list, held here as a constant and stated as such on the
 * section itself. It is kept deliberately separate from `data.ts`: nothing in
 * here is a count of anything, nothing is joined to a student, and no figure
 * from a story is ever mixed into a KPI. Each card carries its publisher, its
 * date, and a link out, so a reader can go and check the claim rather than take
 * it from us.
 *
 * `bearing` is the one sentence we add, and it is the reason a story is in this
 * reader's brief rather than in a feed. It names the office it lands on and the
 * figure of theirs it would move — "Aster's commuter deposit rate is 6.4% down
 * over seven days", not "bears on your funnel". A line that could be pasted
 * under any story at any institution is not context; it is filler, and it
 * teaches the reader to skip the band.
 *
 * Cover art is photography served from `public/media/news`, downloaded once and
 * held locally. Publishers' own photography is theirs, and a briefing that
 * hotlinked it would be both a bandwidth theft and a broken image the first
 * time they moved a file.
 *
 * When a real feed arrives it replaces this constant and nothing else: the
 * section already renders whatever list it is handed.
 */
export const HIGHER_ED_NEWS: BrewNewsItem[] = [
  {
    id: "news-enrollment-trends",
    title: "Enrollment Trends: What Institutions Need to Know for Fall 2026",
    summary:
      "Deposit timing has moved three weeks later at private four-years, and the class is being made in May rather than in April.",
    publisher: "Inside Higher Ed",
    publisherMark: "IHE",
    publishedLabel: "May 20, 2025",
    readMinutes: 2,
    url: "https://www.insidehighered.com/",
    image: "/media/news/summer-melt.jpg",
    imageAlt: "Rows of empty seats in a university lecture theatre",
    topic: "enrollment",
    bearing:
      "Aster's own deposits are running 11 days later than last cycle, which is why the May 31 target reads tighter than the 77% progress bar suggests.",
  },
  {
    id: "news-yield-strategies",
    title: "5 Proven Strategies to Improve Yield in a Competitive Market",
    summary:
      "Admitted-student events and fast aid packaging move yield more than any additional communication volume, three cohorts of data suggest.",
    publisher: "EAB",
    publisherMark: "EAB",
    publishedLabel: "May 19, 2025",
    readMinutes: 3,
    url: "https://eab.com/",
    image: "/media/news/advising-analytics.jpg",
    imageAlt: "A group of students working together over laptops at a table",
    topic: "campus_life",
    bearing:
      "Both levers are already open here: yield sits at 23.7%, 0.6 points below yesterday, and weekend event attendance is down 12% year over year.",
  },
  {
    id: "news-fafsa-completion",
    title: "Financial Aid Pressure Continues as FAFSA Completion Lags",
    summary:
      "Completion is 4.1% behind last year nationally, with the widest gaps among first-generation and commuter applicants.",
    publisher: "The Chronicle of Higher Education",
    publisherMark: "CHE",
    publishedLabel: "May 19, 2025",
    readMinutes: 2,
    url: "https://www.chronicle.com/",
    image: "/media/news/fafsa-season.jpg",
    imageAlt: "Tax forms, a calculator and a pen spread across a desk",
    topic: "financial_aid",
    bearing:
      "The same two groups are the bulk of Aster's 324 open verifications, and Financial Aid is clearing about 30 files a day against a June 6 packaging date.",
  },
  {
    id: "news-ai-enrollment",
    title: "AI in Enrollment: Moving from Pilot to Performance",
    summary:
      "Enrollment teams report the gains come from routing and summarising work, not from generating outreach copy.",
    publisher: "Higher Ed Dive",
    publisherMark: "HED",
    publishedLabel: "May 19, 2025",
    readMinutes: 2,
    url: "https://www.highereddive.com/",
    image: "/media/news/verification-selections.jpg",
    imageAlt: "A hand signing a printed document at a desk",
    topic: "admissions",
    bearing:
      "Aster's transfer volume is 14% ahead of last year on the same review staffing, so routing is the constraint the article describes.",
  },
  {
    id: "news-verification-selections",
    title: "Verification selections fall to a decade low after the FAFSA rewrite",
    summary: "Aid offices report smaller queues and a shift in which files the department flags.",
    publisher: "Higher Ed Dive",
    publisherMark: "HED",
    publishedLabel: "May 16, 2025",
    readMinutes: 2,
    url: "https://www.highereddive.com/",
    image: "/media/news/verification-selections.jpg",
    imageAlt: "A hand signing a printed document at a desk",
    topic: "financial_aid",
    bearing:
      "Selections fell nationally and Aster's rose 18% in a week, so the queue here is a local packaging backlog rather than a federal one.",
  },
  {
    id: "news-tuition-resets",
    title: "Two more New England privates announce tuition resets for fall 2026",
    summary:
      "Both cite the discount rate rather than enrolment, and both keep their aid budgets flat.",
    publisher: "Inside Higher Ed",
    publisherMark: "IHE",
    publishedLabel: "May 15, 2025",
    readMinutes: 3,
    url: "https://www.insidehighered.com/",
    image: "/media/news/tuition-reset.jpg",
    imageAlt: "A brick academic building behind an open green lawn",
    topic: "enrollment",
    bearing:
      "Both are top-five cross-applications for Aster's commuter pool, which is the segment whose deposit rate slipped 6.4% this week.",
  },
  {
    id: "news-housing-contracts",
    title: "Housing contracts are signing later, and residence life is absorbing the gap",
    summary:
      "A survey of 140 residence-life offices finds assignment work compressing into the final six weeks before move-in.",
    publisher: "The Chronicle of Higher Education",
    publisherMark: "CHE",
    publishedLabel: "May 14, 2025",
    readMinutes: 4,
    url: "https://www.chronicle.com/",
    image: "/media/news/transcript-backlog.jpg",
    imageAlt: "Long aisle between tall library shelves of bound records",
    topic: "housing",
    bearing:
      "Aster is 1,180 signed against a 1,600 target with 11 days to the deadline, so the compression the survey describes is already underway here.",
  },
  {
    id: "news-orientation-yield",
    title: "Orientation registration is emerging as the earliest reliable melt signal",
    summary:
      "Students who have not registered for orientation four weeks out melt at roughly twice the rate of those who have.",
    publisher: "EAB",
    publisherMark: "EAB",
    publishedLabel: "May 12, 2025",
    readMinutes: 3,
    url: "https://eab.com/",
    image: "/media/news/advising-analytics.jpg",
    imageAlt: "A group of students working together over laptops at a table",
    topic: "campus_life",
    bearing:
      "1,504 of Aster's 2,450 deposited students have registered for orientation, and the four-week mark the study uses falls on June 17.",
  },
];
