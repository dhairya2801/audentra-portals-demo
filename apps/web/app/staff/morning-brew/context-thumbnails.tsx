import type { BrewMeeting, BrewPriority, BrewRequest } from "./types";

/** Miniatures of this briefing's demo evidence, not provider documents. */
export function SheetThumbnail() {
  return (
    <div
      className="brew-context-mini brew-context-mini--sheet"
      aria-hidden="true"
    >
      <header>Scholarship_Reallocation.xlsx</header>
      <strong>FY26 Reallocation — Scholarship Initiative</strong>
      <table>
        <thead>
          <tr>
            <th>Line item</th>
            <th>Change</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Summer campaign", "−$240,000", "Marketing"],
            ["Commuter cohort aid", "+$240,000", "Financial Aid"],
            ["Net budget change", "$0", "Finance"],
          ].map((row) => (
            <tr key={row[0]}>
              {row.map((cell) => (
                <td key={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="brew-mini-grid" />
    </div>
  );
}

export function CampaignThumbnail() {
  return (
    <div
      className="brew-context-mini brew-context-mini--document"
      aria-hidden="true"
    >
      <div>
        <small>ENROLLMENT MARKETING</small>
        <strong>Summer Campaign</strong>
        <em>Digital and print plan · Prepared for the Provost</em>
        <p>
          Protect the commuter cohort before committing the summer spend. Review
          the proposed $240K reallocation alongside the enrollment outlook.
        </p>
        <p>
          Prioritize students with an incomplete aid file and a deposit decision
          ahead.
        </p>
      </div>
    </div>
  );
}

export function ThreadThumbnail({ request }: { request: BrewRequest }) {
  return (
    <div
      className="brew-context-mini brew-context-mini--thread"
      aria-hidden="true"
    >
      <header>Summer Campaign Reallocation</header>
      <div>
        <i>MO</i>
        <span>
          <strong>{request.fromName}</strong>
          <p>{request.summary}</p>
        </span>
      </div>
      <div>
        <i>VH</i>
        <span>
          <strong>Vivian Hale</strong>
          <p>Reviewing the tradeoff for Friday’s enrollment packet.</p>
        </span>
      </div>
      <div>
        <i>MO</i>
        <span>
          <strong>{request.fromName}</strong>
          <p>82 deposits at risk, roughly $1.6M in net tuition.</p>
        </span>
      </div>
    </div>
  );
}

export function CalendarThumbnail({ meeting }: { meeting: BrewMeeting }) {
  return (
    <div
      className="brew-context-mini brew-context-mini--calendar"
      aria-hidden="true"
    >
      <header>
        Today <span>Day · Week · Month</span>
      </header>
      <div>
        <time>{meeting.timeLabel}</time>
        <section>
          <strong>{meeting.title}</strong>
          <p>
            {meeting.durationMinutes} min · {meeting.attendees.length} guests
          </p>
          <i>VH</i>
          <i>RC</i>
          <i>TW</i>
        </section>
      </div>
      <div>
        <time>Next</time>
        <section>
          <strong>Continue your day</strong>
          <p>Your enrollment calendar</p>
        </section>
      </div>
    </div>
  );
}

export function WorkThumbnail({ priority }: { priority: BrewPriority }) {
  return (
    <div
      className="brew-context-mini brew-context-mini--work"
      aria-hidden="true"
    >
      <header>{priority.title}</header>
      <p>{priority.detail}</p>
      <div className="brew-mini-progress">
        <i />
      </div>
      <div className="brew-mini-facts">
        {priority.breakdown.slice(0, 3).map((row) => (
          <span key={row.label}>
            <strong>{row.value}</strong>
            <small>{row.label}</small>
          </span>
        ))}
      </div>
      <footer>{priority.window}</footer>
    </div>
  );
}
