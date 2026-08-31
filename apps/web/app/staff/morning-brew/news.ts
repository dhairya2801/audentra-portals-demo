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
    title:
      "61 Percent of Colleges Have Met Their Enrollment Goals for Fall 2026",
    summary:
      "Six in ten enrolment leaders say they hit their fall goals; confidence is markedly lower at institutions under 2,000 students.",
    publisher: "Inside Higher Ed",
    publisherMark: "IHE",
    publishedLabel: "Aug 5, 2026",
    readMinutes: 2,
    url: "https://www.insidehighered.com/news/students/financial-aid/2026/08/05/61-percent-colleges-have-met-their-enrollment-goals-fall",
    image: "/media/news/summer-melt.jpg",
    imageAlt: "Rows of empty seats in a university lecture theatre",
    topic: "enrollment",
    bearing:
      "Aster's own deposits are running 11 days later than last cycle, which is why the May 31 target reads tighter than the 77% progress bar suggests.",
  },
  {
    id: "news-yield-strategies",
    title:
      "More Than Melt: Strategies for an Extended Yield Season",
    summary:
      "Yield season no longer ends on May 1, and the work that holds a deposited student is not the work that won them.",
    publisher: "Inside Higher Ed",
    publisherMark: "IHE",
    publishedLabel: "Jul 28, 2026",
    readMinutes: 3,
    url: "https://www.insidehighered.com/blogs/call-action-marketing-and-communications-higher-education/more-melt-strategies-extended-yield",
    image: "/media/news/advising-analytics.jpg",
    imageAlt: "A group of students working together over laptops at a table",
    topic: "campus_life",
    bearing:
      "Both levers are already open here: yield sits at 23.7%, 0.6 points below yesterday, and weekend event attendance is down 12% year over year.",
  },
  {
    id: "news-fafsa-completion",
    title:
      "FAFSA completion rate for class of 2026 highest on record",
    summary:
      "Completion reached 54.7% nationally, with every state ahead of last year and four up by more than twenty per cent.",
    publisher: "Higher Ed Dive",
    publisherMark: "HED",
    publishedLabel: "Jul 15, 2026",
    readMinutes: 2,
    url: "https://www.highereddive.com/news/fafsa-completion-rate-for-class-of-2026-highest-on-record/820295/",
    image: "/media/news/fafsa-season.jpg",
    imageAlt: "Tax forms, a calculator and a pen spread across a desk",
    topic: "financial_aid",
    bearing:
      "The same two groups are the bulk of Aster's 324 open verifications, and Financial Aid is clearing about 30 files a day against a June 6 packaging date.",
  },
  {
    id: "news-ai-enrollment",
    title:
      "Admissions Offices Need More Students and Less ‘Drudgery.’ Is AI the Answer?",
    summary:
      "More offices are putting AI against application review, and most still have no policy governing how it is used.",
    publisher: "The Chronicle of Higher Education",
    publisherMark: "CHE",
    publishedLabel: "Jun 24, 2026",
    readMinutes: 2,
    url: "https://www.chronicle.com/article/admissions-offices-need-more-students-and-less-drudgery-is-ai-the-answer",
    image: "/media/news/verification-selections.jpg",
    imageAlt: "A hand signing a printed document at a desk",
    topic: "admissions",
    bearing:
      "Aster's transfer volume is 14% ahead of last year on the same review staffing, so routing is the constraint the article describes.",
  },
  {
    id: "news-verification-selections",
    title:
      "Education Dept. Launches New FAFSA Fraud Prevention Tool",
    summary:
      "Applicants flagged high-risk now face a live identity check, which adds a step between submission and a package.",
    publisher: "Inside Higher Ed",
    publisherMark: "IHE",
    publishedLabel: "Apr 27, 2026",
    readMinutes: 2,
    url: "https://www.insidehighered.com/news/government/student-aid-policy/2026/04/27/education-dept-launches-new-fafsa-fraud-prevention",
    image: "/media/news/verification-selections.jpg",
    imageAlt: "A hand signing a printed document at a desk",
    topic: "financial_aid",
    bearing:
      "Selections fell nationally and Aster's rose 18% in a week, so the queue here is a local packaging backlog rather than a federal one.",
  },
  {
    id: "news-tuition-resets",
    title:
      "Colleges Are Looking for Enrollment Wins. So They’re Touting Their Deposits.",
    summary:
      "A dozen institutions published deposit counts within days of May 1, making a working number into a public one.",
    publisher: "The Chronicle of Higher Education",
    publisherMark: "CHE",
    publishedLabel: "Jun 3, 2026",
    readMinutes: 3,
    url: "https://www.chronicle.com/article/colleges-are-looking-for-enrollment-wins-so-theyre-touting-their-deposits",
    image: "/media/news/tuition-reset.jpg",
    imageAlt: "A brick academic building behind an open green lawn",
    topic: "enrollment",
    bearing:
      "Both are top-five cross-applications for Aster's commuter pool, which is the segment whose deposit rate slipped 6.4% this week.",
  },
  {
    id: "news-housing-contracts",
    title:
      "6 higher education trends to watch in 2026",
    summary:
      "The demographic cliff, AI and federal pressure are the three forces the sector spent the cycle absorbing.",
    publisher: "Higher Ed Dive",
    publisherMark: "HED",
    publishedLabel: "Jan 8, 2026",
    readMinutes: 4,
    url: "https://www.highereddive.com/news/6-higher-education-trends-to-watch-in-2026/809045/",
    image: "/media/news/transcript-backlog.jpg",
    imageAlt: "Long aisle between tall library shelves of bound records",
    topic: "housing",
    bearing:
      "Aster is 1,180 signed against a 1,600 target with 11 days to the deadline, so the compression the survey describes is already underway here.",
  },
  {
    id: "news-orientation-yield",
    title:
      "4 predictions for 2026: What’s next for graduate and online enrollment",
    summary:
      "One in five adult learners will research programmes through an AI assistant, changing where a first impression is made.",
    publisher: "EAB",
    publisherMark: "EAB",
    publishedLabel: "Feb 11, 2026",
    readMinutes: 3,
    url: "https://eab.com/resources/blog/adult-education-blog/2026-predictions-graduate-online-enrollment/",
    image: "/media/news/advising-analytics.jpg",
    imageAlt: "A group of students working together over laptops at a table",
    topic: "campus_life",
    bearing:
      "1,504 of Aster's 2,450 deposited students have registered for orientation, and the four-week mark the study uses falls on June 17.",
  },
];
