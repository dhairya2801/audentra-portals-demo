"use client";

import Icon from "../../design-system/Icon.jsx";
import type { BrewDetailLevelId, BrewSourceId } from "./types";

/**
 * The miniature inside each detail-level option: what a source's cards look
 * like when you ask for the essentials, for context, or for the whole thing.
 *
 * These are drawings, not reads. They are fixed illustrations shown while the
 * reader is still choosing, and they never touch the briefing payload — the
 * live miniature beside the questions is where real records appear. Keeping the
 * two apart is deliberate: an illustration that quietly rendered one tenant's
 * numbers would be a claim about that tenant, made on a screen whose whole job
 * is explaining an option.
 *
 * Every figure below is invented and labelled as a sample on the card that
 * frames it.
 */

function Head({ label, meta }: { label: string; meta?: string }) {
  return (
    <p className="mbp-head">
      <b>{label}</b>
      {meta ? <span>{meta}</span> : null}
    </p>
  );
}

function Delta({ value, up, note }: { value: string; up: boolean; note: string }) {
  return (
    <span className={up ? "mbp-delta is-up" : "mbp-delta is-down"}>
      <b>
        <i aria-hidden="true">{up ? "↑" : "↓"}</i> {value}
      </b>
      <small>{note}</small>
    </span>
  );
}

function Meter({ parts }: { parts: { label: string; percent: number; tone: string }[] }) {
  return (
    <>
      <span className="mbp-meter" aria-hidden="true">
        {parts.map((part) => (
          <i className={`is-${part.tone}`} style={{ width: `${part.percent}%` }} key={part.label} />
        ))}
      </span>
      <span className="mbp-legend">
        {parts.map((part) => (
          <em key={part.label}>
            <i className={`is-${part.tone}`} aria-hidden="true" /> {part.label} {part.percent}%
          </em>
        ))}
      </span>
    </>
  );
}

/** A three-point rising sparkline with a dotted run-out to the projection. */
function Spark() {
  return (
    <svg className="mbp-spark" viewBox="0 0 120 40" role="presentation" aria-hidden="true">
      <polyline
        points="4,32 20,29 36,30 52,24 68,21 84,12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="84" y1="12" x2="114" y2="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" opacity=".5" />
      {[
        [4, 32],
        [20, 29],
        [36, 30],
        [52, 24],
        [68, 21],
        [84, 12],
      ].map(([x, y]) => (
        <circle cx={x} cy={y} r="2.4" fill="#fff" stroke="currentColor" strokeWidth="1.6" key={`${x}`} />
      ))}
      <circle cx="114" cy="7" r="2.4" fill="#fff" stroke="currentColor" strokeWidth="1.4" opacity=".6" />
    </svg>
  );
}

/* ---------------------------------------------------------- institutional pulse */

const PULSE = {
  glance: (
    <div className="mbp-card">
      <Head label="Net Deposits" />
      <div className="mbp-figure">
        <strong>3,842</strong>
        <Delta value="47" up note="vs yesterday" />
      </div>
      <div className="mbp-figure-row">
        <Delta value="6.2%" up note="vs last 7 days" />
        <Delta value="8.1%" up note="vs last year" />
      </div>
    </div>
  ),
  context: (
    <div className="mbp-card">
      <Head label="Net Deposits" />
      <div className="mbp-figure">
        <strong>
          3,842 <small>/ 4,500</small>
        </strong>
        <span className="mbp-target">
          Target
          <b>May 1</b>
        </span>
      </div>
      <span className="mbp-meter" aria-hidden="true">
        <i className="is-good" style={{ width: "85%" }} />
      </span>
      <p className="mbp-goal">85% to goal</p>
    </div>
  ),
  deep: (
    <div className="mbp-card">
      <div className="mbp-figure">
        <span>
          <Head label="Net Deposits" />
          <strong>
            3,842 <small>/ 4,500</small>
          </strong>
        </span>
        <span className="mbp-goal">85% to goal</span>
      </div>
      <div className="mbp-trend">
        <Spark />
        <span className="mbp-projection">
          Projected
          <b>4,470</b>
          <small>by May 1</small>
        </span>
      </div>
      <p className="mbp-axis">
        <span>30d ago</span>
        <span>Today</span>
        <span>May 1</span>
      </p>
    </div>
  ),
};

/* ------------------------------------------------------------------- calendar */

const MEETINGS = [
  { time: "9:00 AM", title: "Leadership Sync", meta: "60 min · 2 guests" },
  { time: "11:00 AM", title: "Enrollment Review", meta: "30 min · 4 guests" },
  { time: "2:00 PM", title: "Budget Check-in", meta: "30 min · 3 guests" },
];

const CALENDAR = {
  glance: (
    <div className="mbp-card">
      <Head label="Today" meta="Tuesday, Apr 29" />
      <ul className="mbp-agenda">
        {MEETINGS.map((meeting) => (
          <li key={meeting.title}>
            <i aria-hidden="true" />
            <span>
              <em>{meeting.time}</em>
              <b>{meeting.title}</b>
              <small>{meeting.meta}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  ),
  context: (
    <div className="mbp-card">
      <Head label="Today" meta="Tuesday, Apr 29" />
      <ul className="mbp-agenda">
        <li>
          <i aria-hidden="true" />
          <span>
            <em>9:00 AM</em>
            <b>Leadership Sync</b>
            <small>60 min · 2 guests · Board Room</small>
            <span className="mbp-note is-warn">
              <b>Purpose:</b> Weekly leadership alignment and decisions.
              <br />
              <b>Prep:</b> Review Q2 dashboard
            </span>
          </span>
        </li>
        <li>
          <i aria-hidden="true" />
          <span>
            <em>11:00 AM</em>
            <b>Enrollment Review</b>
            <small>30 min · 4 guests · Room 204</small>
            <span className="mbp-note is-good">
              <b>Conflicts:</b> None
            </span>
          </span>
        </li>
      </ul>
    </div>
  ),
  deep: (
    <div className="mbp-card">
      <Head label="This Week" meta="Apr 29 – May 5" />
      <p className="mbp-sub">Time Focus</p>
      <Meter
        parts={[
          { label: "Meetings", percent: 55, tone: "purple" },
          { label: "Focus Time", percent: 25, tone: "good" },
          { label: "Other", percent: 20, tone: "muted" },
        ]}
      />
      <span className="mbp-note is-warn">
        <b>Insights</b>
        <br />· Back-to-back meetings: Tue 9am – 12pm
        <br />· Best focus windows: Tue 1–2pm, Thu 2–4pm
      </span>
      <p className="mbp-fact">
        <b>Travel:</b> Thu to Chicago (ORD)
      </p>
      <p className="mbp-fact">
        <b>Prep alerts:</b> 2 meetings need attention
      </p>
    </div>
  ),
};

/* ---------------------------------------------------------------------- email */

const EMAILS = [
  {
    sender: "President’s Office",
    time: "9:02 AM",
    subject: "Campus update: Spring events",
    line: "A quick update on upcoming events…",
  },
  {
    sender: "Financial Aid Team",
    time: "10:15 AM",
    subject: "FAFSA verification reminder",
    line: "Please review and submit any outstanding documents…",
  },
  {
    sender: "Admissions Ops",
    time: "11:48 AM",
    subject: "Application review updates",
    line: "New updates to your application status…",
  },
];

const EMAIL = {
  glance: (
    <div className="mbp-card">
      <Head label="Today" meta="Tuesday, Apr 29" />
      <ul className="mbp-inbox">
        {EMAILS.map((email) => (
          <li key={email.subject}>
            <i aria-hidden="true">
              <Icon name="mail" size={12} />
            </i>
            <span>
              <span className="mbp-inbox__top">
                <b>{email.sender}</b>
                <em>{email.time}</em>
              </span>
              <strong>{email.subject}</strong>
              <small>{email.line}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  ),
  context: (
    <div className="mbp-card">
      <Head label="Today" meta="Tuesday, Apr 29" />
      <ul className="mbp-inbox">
        <li>
          <i aria-hidden="true">
            <Icon name="mail" size={12} />
          </i>
          <span>
            <span className="mbp-inbox__top">
              <b>President’s Office</b>
              <em>9:02 AM</em>
            </span>
            <strong>Campus update: Spring events</strong>
            <span className="mbp-tags">
              <em className="is-warn">Action needed</em>
              <em className="is-plain">Reply by 2 PM</em>
            </span>
            <span className="mbp-note is-warn">
              <b>Summary:</b> Requesting your input on commencement logistics and guest speaker.
            </span>
          </span>
        </li>
        <li>
          <i aria-hidden="true">
            <Icon name="mail" size={12} />
          </i>
          <span>
            <span className="mbp-inbox__top">
              <b>Financial Aid Team</b>
              <em>10:15 AM</em>
            </span>
            <strong>FAFSA verification reminder</strong>
            <span className="mbp-tags">
              <em className="is-good">Waiting on you</em>
              <em className="is-plain">Due May 2</em>
            </span>
          </span>
        </li>
        <li>
          <i aria-hidden="true">
            <Icon name="mail" size={12} />
          </i>
          <span>
            <span className="mbp-inbox__top">
              <b>Admissions Ops</b>
              <em>11:48 AM</em>
            </span>
            <strong>Application review updates</strong>
            <span className="mbp-tags">
              <em className="is-info">FYI</em>
              <em className="is-plain">No action needed</em>
            </span>
          </span>
        </li>
      </ul>
    </div>
  ),
  deep: (
    <div className="mbp-card">
      <Head label="Inbox Overview" meta="Last 7 Days" />
      <div className="mbp-stats">
        <span>
          <b>128</b>
          <small>Total emails</small>
        </span>
        <span>
          <b>27</b>
          <small>From important senders</small>
        </span>
        <span>
          <b>82%</b>
          <small>Response rate</small>
        </span>
      </div>
      <p className="mbp-sub">Response Priority</p>
      <Meter
        parts={[
          { label: "High", percent: 15, tone: "bad" },
          { label: "Medium", percent: 35, tone: "warn" },
          { label: "Low", percent: 30, tone: "good" },
          { label: "FYI", percent: 20, tone: "muted" },
        ]}
      />
      <p className="mbp-sub">Key Insights</p>
      <ul className="mbp-bullets">
        <li>5 messages need reply today</li>
        <li>2 executive follow-ups</li>
        <li>Trend: higher volume from student support</li>
      </ul>
    </div>
  ),
};

/* --------------------------------------------------------------- action center */

const ACTIONS = {
  glance: (
    <div className="mbp-card">
      <Head label="My Day at a Glance" meta="Today" />
      <ul className="mbp-counts">
        {[
          { label: "Overdue", value: 8, tone: "bad" },
          { label: "Due Today", value: 14, tone: "warn" },
          { label: "Student Risks", value: 6, tone: "warn" },
          { label: "Approvals", value: 3, tone: "purple" },
          { label: "Alerts", value: 2, tone: "info" },
        ].map((row) => (
          <li key={row.label}>
            <i className={`is-${row.tone}`} aria-hidden="true" />
            <b>{row.label}</b>
            <em>{row.value}</em>
            <span aria-hidden="true">›</span>
          </li>
        ))}
      </ul>
    </div>
  ),
  context: (
    <div className="mbp-card">
      <Head label="Top Items for You" meta="Today" />
      <ul className="mbp-items">
        <li>
          <span className="mbp-items__top">
            <em className="is-bad">High</em>
            <b>FAFSA Document Missing</b>
          </span>
          <small>Sarah Johnson</small>
          <small>Due: Today, 11:00 AM · Owner: You</small>
          <span className="mbp-note is-warn">Next step: Call student to request document</span>
        </li>
        <li>
          <span className="mbp-items__top">
            <em className="is-warn">Medium</em>
            <b>Housing Deposit Reminder</b>
          </span>
          <small>Michael Chen</small>
          <small>Due: Today, 2:00 PM · Owner: You</small>
          <span className="mbp-note is-warn">Next step: Send reminder email</span>
        </li>
      </ul>
    </div>
  ),
  deep: (
    <div className="mbp-card">
      <Head label="Team Overview" meta="This Week" />
      <div className="mbp-stats is-quad">
        <span>
          <small>Open Items</small>
          <b>184</b>
          <Delta value="12%" up note="" />
        </span>
        <span>
          <small>Past SLA</small>
          <b>27</b>
          <Delta value="8%" up note="" />
        </span>
        <span>
          <small>Avg Age</small>
          <b>3.6d</b>
          <Delta value="0.9" up note="" />
        </span>
        <span>
          <small>At Risk</small>
          <b>23</b>
          <Delta value="15%" up note="" />
        </span>
      </div>
      <p className="mbp-sub">Workload by Team</p>
      <ul className="mbp-bars">
        {[
          { label: "Admissions", percent: 112 },
          { label: "Financial Aid", percent: 124 },
          { label: "Student Services", percent: 87 },
          { label: "Records", percent: 76 },
        ].map((row) => (
          <li key={row.label}>
            <small>{row.label}</small>
            <i aria-hidden="true">
              <b
                className={row.percent > 100 ? "is-over" : ""}
                style={{ width: `${Math.min(100, (row.percent / 130) * 100)}%` }}
              />
            </i>
            <em className={row.percent > 100 ? "is-over" : ""}>{row.percent}%</em>
          </li>
        ))}
      </ul>
      <p className="mbp-axis is-right">100% Capacity</p>
    </div>
  ),
};

/* ----------------------------------------------------------------------- news */

const STORIES = [
  { mark: "IHE", title: "Summer melt widened again at public four-years", date: "Aug 18" },
  { mark: "HED", title: "Education Department commits to an October 1 FAFSA", date: "Aug 14" },
  { mark: "CHE", title: "Two more New England privates announce tuition resets", date: "Aug 6" },
];

const NEWS = {
  glance: (
    <div className="mbp-card">
      <Head label="Higher-ed news" meta="6 stories" />
      <ul className="mbp-stories">
        {STORIES.map((story) => (
          <li key={story.mark + story.date}>
            <i aria-hidden="true">{story.mark}</i>
            <span>
              <b>{story.title}</b>
              <small>{story.date}, 2026</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  ),
  context: (
    <div className="mbp-card">
      <Head label="Higher-ed news" meta="6 stories" />
      <ul className="mbp-stories">
        <li>
          <i aria-hidden="true">IHE</i>
          <span>
            <b>Summer melt widened again at public four-years</b>
            <small>Aug 18, 2026</small>
            <span className="mbp-note is-warn">Bears on your deposited-to-enrolled step.</span>
          </span>
        </li>
        <li>
          <i aria-hidden="true">HED</i>
          <span>
            <b>Education Department commits to an October 1 FAFSA</b>
            <small>Aug 14, 2026</small>
            <span className="mbp-note is-warn">Bears on aid document turnaround.</span>
          </span>
        </li>
      </ul>
    </div>
  ),
  deep: (
    <div className="mbp-card">
      <Head label="Across the sector" meta="Last 30 days" />
      <span className="mbp-note is-plain">
        Three of six stories point the same way: the gap is opening after the deposit, not before
        it.
      </span>
      <p className="mbp-sub">Where you are exposed</p>
      <ul className="mbp-bars">
        {[
          { label: "Deposited, not enrolled", percent: 64 },
          { label: "Aid documents open", percent: 41 },
          { label: "Housing unassigned", percent: 28 },
        ].map((row) => (
          <li key={row.label}>
            <small>{row.label}</small>
            <i aria-hidden="true">
              <b style={{ width: `${row.percent}%` }} />
            </i>
            <em>{row.percent}%</em>
          </li>
        ))}
      </ul>
      <p className="mbp-fact">
        <b>Peers:</b> 2 have already moved their deposit deadline
      </p>
    </div>
  ),
};

/* ------------------------------------------------ institutional intelligence */

const INTELLIGENCE = {
  glance: (
    <div className="mbp-card">
      <Head label="What we found" meta="3 findings" />
      <ul className="mbp-findings">
        {[
          { rank: 1, title: "Aid verification is holding the deposit step", tone: "bad" },
          { rank: 2, title: "Housing selection slipped a week behind last year", tone: "warn" },
          { rank: 3, title: "Transcript reviews cleared their backlog", tone: "good" },
        ].map((finding) => (
          <li key={finding.rank}>
            <i className={`is-${finding.tone}`} aria-hidden="true">
              {finding.rank}
            </i>
            <b>{finding.title}</b>
          </li>
        ))}
      </ul>
    </div>
  ),
  context: (
    <div className="mbp-card">
      <Head label="What we found" meta="3 findings" />
      <ul className="mbp-findings">
        <li>
          <i className="is-bad" aria-hidden="true">
            1
          </i>
          <span>
            <b>Aid verification is holding the deposit step</b>
            <span className="mbp-tags">
              <em className="is-bad">14 of 96 students</em>
              <em className="is-plain">Financial aid</em>
            </span>
            <small>Drivers: 9 missing tax documents · 5 awaiting review</small>
          </span>
        </li>
        <li>
          <i className="is-warn" aria-hidden="true">
            2
          </i>
          <span>
            <b>Housing selection slipped a week behind</b>
            <span className="mbp-tags">
              <em className="is-warn">22 of 96 students</em>
              <em className="is-plain">Housing</em>
            </span>
          </span>
        </li>
      </ul>
    </div>
  ),
  deep: (
    <div className="mbp-card">
      <Head label="Aid verification is holding the deposit step" />
      <span className="mbp-tags">
        <em className="is-bad">14 of 96 students</em>
        <em className="is-plain">Financial aid</em>
      </span>
      <p className="mbp-sub">Evidence</p>
      <ul className="mbp-bullets">
        <li>9 files selected for verification, none cleared in 6 days</li>
        <li>5 students have paid a deposit and are still blocked</li>
      </ul>
      <p className="mbp-sub">In the cohort</p>
      <ul className="mbp-people">
        <li>
          <i aria-hidden="true">SJ</i> Sarah Johnson <small>Tax transcript</small>
        </li>
        <li>
          <i aria-hidden="true">MC</i> Michael Chen <small>Awaiting review</small>
        </li>
      </ul>
      <span className="mbp-note is-warn">Next step: Clear the 5 deposited files first</span>
    </div>
  ),
};

const PREVIEWS: Record<BrewSourceId, Record<BrewDetailLevelId, React.ReactNode>> = {
  pulse: PULSE,
  news: NEWS,
  calendar: CALENDAR,
  email: EMAIL,
  actions: ACTIONS,
  intelligence: INTELLIGENCE,
};

export function SourcePreview({
  sourceId,
  level,
}: {
  sourceId: BrewSourceId;
  level: BrewDetailLevelId;
}) {
  return (
    <div className="mbp">
      <p className="mbp__label">Sample</p>
      {PREVIEWS[sourceId][level]}
    </div>
  );
}
