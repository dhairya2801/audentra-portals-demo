"use client";

import { Children, cloneElement, isValidElement, useCallback, useId, useState, type ReactNode } from "react";
import type { UniversityDomain, UniversityRecord } from "@vv/contracts";
import { ApiClientError, getUniversityOperations, getUniversityRecord } from "../lib/api-client";
import { useApiResource } from "../hooks/use-api-resource";
import Icon from "../design-system/Icon.jsx";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(parsed);
};
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
const term = (value: string) => {
  const compact = /^(\d{4})(FA|SP|SU|WI)$/.exec(value);
  if (compact) return `${({ FA: "Fall", SP: "Spring", SU: "Summer", WI: "Winter" } as Record<string, string>)[compact[2]]} ${compact[1]}`;
  return label(value.replace(/^term[-_]/, "").replaceAll("-", " "));
};
const domains: { id: UniversityDomain; title: string; icon: string }[] = [
  { id: "overview", title: "Overview", icon: "home" },
  { id: "academics", title: "Academics", icon: "book" },
  { id: "account", title: "Account", icon: "wallet" },
  { id: "relationships", title: "People & support", icon: "users" },
  { id: "documents", title: "Documents", icon: "file" },
  { id: "history", title: "History", icon: "clock" },
];
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const time = (minute: number) => `${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${minute < 720 ? "AM" : "PM"}`;

function Status({ value }: { value: string }) {
  const tone = /^(completed|approved|accepted|settled|posted|active|enrolled|satisfied|released|resolved)$/.test(value) ? "done"
    : /^(rejected|denied|blocked|failed|overdue)$/.test(value) ? "stop"
    : /^(pending|in_progress|in_review|submitted|scheduled|waitlisted|open)$/.test(value) ? "wait" : "quiet";
  return <span className={`university-status university-status--${tone}`}>{label(value)}</span>;
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="university-empty">{children}</p>;
}
function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return <section className="university-section"><header><h3>{title}</h3>{note && <p>{note}</p>}</header>{children}</section>;
}
function Row({ title, detail, aside }: { title: ReactNode; detail?: ReactNode; aside?: ReactNode }) {
  return <div className="university-row"><div><strong>{title}</strong>{detail && <div className="university-row__detail">{detail}</div>}</div>{aside && <div className="university-row__aside">{aside}</div>}</div>;
}
function Metric({ label: title, value, note }: { label: string; value: ReactNode; note?: string }) {
  return <div className="university-metric"><span>{title}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}
function Table({ caption, headings, children }: { caption: string; headings: string[]; children: ReactNode }) {
  return <div className="university-table-scroll" role="region" aria-label={caption} tabIndex={0}><table className="university-table"><caption>{caption}</caption><thead><tr>{headings.map(heading => <th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{Children.map(children, row => isValidElement<{ children: ReactNode }>(row) ? cloneElement(row, {}, Children.map(row.props.children, (cell, index) => isValidElement<{ "data-label"?: string }>(cell) ? cloneElement(cell, { "data-label": headings[index] }) : cell)) : row)}</tbody></table></div>;
}
function RecordContent({ data, domain }: { data: UniversityRecord; domain: UniversityDomain }) {
  if (domain === "overview") {
    const holds = data.holds?.filter(item => !item.released_at) ?? [];
    return <>
      <div className="university-metrics">
        <Metric label="Student standing" value={label(data.student.status)} note={`${term(data.student.admit_term)} entry`} />
        <Metric label="Program" value={data.student.program_name} note={label(data.student.residency)} />
        <Metric label="Active holds" value={holds.length} note={holds.length ? "Review the owning office below" : "No active official holds"} />
      </div>
      <div className="university-grid">
        <Section title="Enrollment & account" note="Posted balances and registered credits, by term.">
          {data.applications?.map(item => <Row key={item.id} title="Application" detail={item.respond_by ? `Respond by ${date(item.respond_by)}` : `Submitted ${date(item.submitted_at)}`} aside={<Status value={item.status} />} />)}
          {data.loads?.map(item => <Row key={`load-${item.term_id}`} title={term(item.term_id)} detail="Registered course load" aside={`${item.credits} credits`} />)}
          {data.balances?.map(item => <Row key={item.term_id} title={term(item.term_id)} detail={item.balance_cents < 0 ? "Account credit · Refund settlement is separate" : "Posted account balance"} aside={money(item.balance_cents)} />)}
          {!data.applications?.length && !data.loads?.length && !data.balances?.length && <Empty>No enrollment or account records yet.</Empty>}
        </Section>
        <Section title="Registration holds" note="The office listed owns the next step.">
          {holds.length ? holds.map(item => <Row key={item.id} title={label(item.kind)} detail={<>{item.reason}<br /><span>{item.office_name ?? label(item.office_id)}</span></>} aside={<Status value="blocked" />} />) : <Empty>No active official holds recorded.</Empty>}
        </Section>
      </div>
      <Section title="Institutional dates" note="Dates supplied by the university. All times are New York time.">
        {data.deadlines?.length ? <>
          {data.deadlines.slice(0, 5).map(item => <Row key={item.id} title={item.title} detail={label(item.category)} aside={date(item.starts_at)} />)}
          {data.deadlines.length > 5 && <details className="university-disclosure"><summary><span><strong>View all institutional dates</strong><small>{data.deadlines.length - 5} more dates</small></span></summary><div>{data.deadlines.slice(5).map(item => <Row key={item.id} title={item.title} detail={label(item.category)} aside={date(item.starts_at)} />)}</div></details>}
        </> : <Empty>No institutional dates recorded.</Empty>}
      </Section>
    </>;
  }
  if (domain === "academics") return <>
    <div className="university-metrics">
      <Metric label="Current courses" value={data.attempts?.filter(item => item.status === "enrolled").length ?? 0} note="Registered course attempts" />
      <Metric label="Registered credits" value={data.attempts?.filter(item => item.status === "enrolled").reduce((sum, item) => sum + item.credits, 0) ?? 0} note="Current courses are not earned credit" />
      <Metric label="Course history" value={data.attempts?.length ?? 0} note="All recorded attempts" />
    </div>
    <Section title="Registrations & course history" note="Course status, grades, and meeting details in one place.">
      {data.attempts?.length ? <Table caption="Course registrations and history" headings={["Course", "Term", "Credits", "Status", "Grade", "Meeting"]}>{data.attempts.map(item => <tr key={item.id}><td><strong>{item.code}</strong><span>{item.title}</span></td><td>{term(item.term_id)}</td><td className="university-number">{item.credits}</td><td><Status value={item.status} /></td><td>{item.grade ?? "—"}</td><td>{item.status === "enrolled" ? <>{weekdays[item.weekday]}<span>{time(item.start_minute)}–{time(item.end_minute)}</span><span>{item.room} · {label(item.modality)}</span></> : "—"}</td></tr>)}</Table> : <Empty>No course attempts recorded.</Empty>}
    </Section>
    <p className="university-note">Current courses do not count as earned credit. Unresolved core and elective distributions still require an adviser review.</p>
  </>;
  if (domain === "account") return <>
    <Section title="Posted account ledger" note="Charges, settled payments, aid postings, reversals and refunds. Accepted annual awards and pending payments are separate.">
      {data.ledger?.length ? <Table caption="Posted account transactions" headings={["Posted", "Term", "Entry", "Amount"]}>{data.ledger.map(item => <tr key={item.id}><td>{date(item.posted_at)}</td><td>{term(item.term_id)}</td><td><strong>{item.description}</strong><span>{label(item.kind)}{item.due_at ? ` · Due ${date(item.due_at)}` : ""}</span></td><td className={`university-number${item.amount_cents < 0 ? " university-credit" : ""}`}>{money(item.amount_cents)}</td></tr>)}</Table> : <Empty>No posted transactions recorded.</Empty>}
    </Section>
    <div className="university-grid">
      <Section title="Payments & settlement" note="A submission is separate from a settled payment.">{data.payments?.length ? data.payments.map(item => <Row key={item.id} title={money(item.amount_cents)} detail={<>{term(item.term_id)} · {label(item.method)}<br />Submitted {date(item.submitted_at)}</>} aside={<Status value={item.status} />} />) : <Empty>No payments recorded.</Empty>}</Section>
      <Section title="Aid installments" note="Scheduled amounts and their current posting status.">{data.disbursements?.length ? data.disbursements.map(item => <Row key={item.id} title={item.name} detail={<>{term(item.term_id)} · {money(item.amount_cents)}<br />Scheduled {date(item.scheduled_at)}{item.reason && <><br />{item.reason}</>}</>} aside={<Status value={item.status} />} />) : <Empty>No aid installments recorded.</Empty>}</Section>
    </div>
  </>;
  if (domain === "relationships") return <>
    <div className="university-grid">
      <Section title="Your people & offices" note="Current assignments and the people supporting you.">
        {data.assignments?.some(item => !item.ends_at) ? data.assignments.filter(item => !item.ends_at).map(item => <Row key={item.id} title={item.name} detail={<>{label(item.role)} · {item.office_name}<br /><a href={`mailto:${item.email}`}>{item.email}</a></>} />) : <Empty>No current staff assignments recorded.</Empty>}
        {data.coverage?.map(item => <Row key={item.id} title={`${item.covering_name} · Leave coverage`} detail={<>{date(item.starts_at)}–{date(item.ends_at)}<br /><a href={`mailto:${item.covering_email}`}>{item.covering_email}</a></>} />)}
      </Section>
      <Section title="Housing">{data.housing?.length ? data.housing.map(item => <Row key={item.id} title={item.residence_name ?? "Housing assignment"} detail={<>{item.room && <>Room {item.room}<br /></>}{item.reason}</>} aside={<Status value={item.status} />} />) : <Empty>No housing assignment recorded.</Empty>}</Section>
    </div>
    <Section title="Permissions & exceptions" note="Current and historical permissions retain their scope and expiry.">
      {data.consents?.map(item => <Row key={item.id} title={item.delegate_name} detail={`${label(item.scope)} · ${item.revoked_at ? `Revoked ${date(item.revoked_at)}` : `Expires ${date(item.expires_at)}`}`} />)}
      {data.portalAuthorizations?.map(item => <Row key={item.id} title={item.full_name} detail={item.scopes.map(label).join(", ")} aside={<Status value={item.active && item.authorization_status === "completed" ? "active" : "inactive"} />} />)}
      {data.exceptions?.map(item => <Row key={item.id} title={label(item.kind)} detail={<>{item.reason}<br />{date(item.starts_at)}–{date(item.ends_at)}</>} aside={<Status value={item.status} />} />)}
      {!data.consents?.length && !data.portalAuthorizations?.length && !data.exceptions?.length && <Empty>No permissions or exceptions recorded.</Empty>}
    </Section>
    <Section title="Coordinated support">{data.workflows?.length ? data.workflows.map(item => <details className="university-disclosure" key={item.id}><summary><span><strong>{item.title}</strong><small>{item.owner_name} · Due {date(item.due_at)}</small></span><Status value={item.status} /></summary><div>{data.steps?.filter(step => step.workflow_id === item.id).map(step => <Row key={step.id} title={step.title} detail={step.evidence} aside={<Status value={step.status} />} />)}</div></details>) : <Empty>No coordinated support workflows recorded.</Empty>}</Section>
  </>;
  if (domain === "documents") return <Section title="Documents & review evidence" note="Open a document to see the recorded decisions and review history.">
    {data.documents?.length ? data.documents.map(item => <details className="university-disclosure" key={item.id}><summary><span><strong>{label(item.category)}</strong><small>{item.office_name}</small></span><Status value={item.status} /></summary><div>{data.revisions?.some(revision => revision.document_id === item.id) ? data.revisions.filter(revision => revision.document_id === item.id).map(revision => <Row key={revision.id} title={label(revision.status)} detail={<>{revision.reason}<br />Recorded {date(revision.recorded_at)}<br />Effective {date(revision.effective_at)}</>} />) : <Empty>No review history recorded.</Empty>}</div></details>) : <Empty>No university documents recorded.</Empty>}
  </Section>;
  return <Section title="University history" note="Recording time can differ from when a change took effect. All times are New York time.">
    {data.events?.length ? <ol className="university-timeline">{data.events.map(item => <li key={item.id}><strong>{item.description}</strong><p>Effective {date(item.effective_at)}<br />Recorded {date(item.recorded_at)}</p>{item.to_state && <Status value={item.to_state} />}</li>)}</ol> : <Empty>No university history recorded.</Empty>}
  </Section>;
}

export function UniversityRecordPanel({ studentId, initialDomain = "overview" }: { studentId?: string; initialDomain?: UniversityDomain }) {
  const [domain, setDomain] = useState<UniversityDomain>(initialDomain);
  const id = useId();
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await getUniversityRecord(domain, studentId, signal); }
    catch (error) { if (error instanceof ApiClientError && error.status === 404) return null; throw error; }
  }, [domain, studentId]);
  const resource = useApiResource(load, { refreshOnAmbient: false });
  const data = resource.data;
  if (resource.status === "ready" && !data) return null;
  const matching = data?.domain === domain && (!studentId || data.student.id === studentId);
  return <section className="university-record" aria-label="University record">
    <header className="university-record__header"><div className="university-record__identity"><span className="university-record__icon" aria-hidden="true"><Icon name="book" size={22} /></span><div><h2>{studentId && matching ? `${data.student.name} · University record` : "My university record"}</h2><p>{matching ? `${data.student.external_ref} · ${data.student.program_name}` : "Your academic, financial, and support records"}</p></div></div>{matching && <span className="university-record__snapshot">As of {date(data.snapshotAt)}<small>New York time</small></span>}</header>
    <nav className="university-record__tabs" aria-label="University record sections">{domains.map(item => <button key={item.id} type="button" aria-pressed={domain === item.id} aria-controls={`${id}-content`} onClick={() => setDomain(item.id)}><Icon name={item.icon} size={16} />{item.title}</button>)}</nav>
    <div id={`${id}-content`} className="university-record__content" aria-busy={resource.isRefreshing || resource.status === "loading"}>
      {resource.status === "error" || (!matching && resource.refreshError) ? <div className="university-empty" role="alert"><p>University record could not be loaded.</p><button className="university-button" type="button" onClick={resource.reload}>Try again</button></div> : !matching ? <p className="university-empty" role="status">Loading {domains.find(item => item.id === domain)?.title.toLowerCase()}…</p> : <>
        {resource.refreshError && <p className="university-note" role="status">The latest update could not be loaded. Showing the last available record. <button type="button" className="university-button" onClick={resource.reload}>Retry</button></p>}
        <RecordContent data={data} domain={domain} />
      </>}
    </div>
  </section>;
}

export function UniversityOperationsPanel() {
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await getUniversityOperations(signal); }
    catch (error) { if (error instanceof ApiClientError && error.status === 404) return null; throw error; }
  }, []);
  const resource = useApiResource(load);
  if (resource.status === "loading") return <div className="university-record"><p className="university-empty" role="status">Loading university operations…</p></div>;
  if (resource.status === "error") return <div className="university-record university-empty" role="alert"><p>University operations could not be loaded.</p><button className="university-button" type="button" onClick={resource.reload}>Try again</button></div>;
  const data = resource.data;
  if (!data) return null;
  return <section className="university-record" aria-label="University operations">
    <header className="university-record__header"><div className="university-record__identity"><span className="university-record__icon" aria-hidden="true"><Icon name="users" size={22} /></span><div><h2>My university operations</h2><p>{data.staff.name} · {data.staff.title}</p></div></div><span className="university-record__snapshot">Schedule & responsibilities<small>New York time</small></span></header>
    <div className="university-record__content">
      {resource.refreshError && <p className="university-note" role="status">Showing the last available operations. <button className="university-button" type="button" onClick={resource.reload}>Retry update</button></p>}
      <div className="university-metrics"><Metric label="Caseload capacity" value={data.staff.capacity} note="Staff assignment capacity" /><Metric label="Accountable cases" value={data.cases.length} note="Cases assigned to you" /><Metric label="Scheduled meetings" value={data.calendar.length} note="On your university calendar" /></div>
      <div className="university-grid">
        <Section title="Your caseload" note="Assignments by role; a student can have more than one relationship.">{data.caseload.length ? data.caseload.map(item => <Row key={item.role} title={label(item.role)} aside={`${item.count} students`} />) : <Empty>No current student assignments.</Empty>}</Section>
        <Section title="Weekly availability">{data.availability.length ? weekdays.map((day, index) => {
          const slots = data.availability.filter(item => item.weekday === index).sort((a, b) => a.start_minute - b.start_minute);
          return slots.length ? <Row key={day} title={day} detail={slots.map(item => <div key={item.id}><strong>{time(item.start_minute)}–{time(item.end_minute)}</strong> · {item.location}{item.timezone !== "America/New_York" ? ` · ${item.timezone}` : ""}</div>)} /> : null;
        }) : <Empty>No weekly availability recorded.</Empty>}</Section>
      </div>
      <div className="university-grid">
        <Section title="University calendar">{data.calendar.length ? data.calendar.map(item => <Row key={item.id} title={item.title} detail={<>{item.location}<br />{date(item.starts_at)}–{date(item.ends_at)}</>} />) : <Empty>No meetings recorded.</Empty>}</Section>
        <Section title="Leave & coverage">{data.absences.length ? data.absences.map(item => <Row key={item.id} title={item.reason} detail={<>{date(item.starts_at)}–{date(item.ends_at)}<br />Covered by {item.covering_name}</>} />) : <Empty>No leave or coverage changes recorded.</Empty>}</Section>
      </div>
      <Section title="Accountable cases" note="Case ownership, student context, and due dates.">{data.cases.length ? <Table caption="Assigned university cases" headings={["Case", "Student", "Status", "Due"]}>{data.cases.map(item => <tr key={item.id}><td><strong>{item.title}</strong></td><td>{item.student_name}<span>{item.external_ref}</span></td><td><Status value={item.status} /></td><td>{date(item.due_at)}</td></tr>)}</Table> : <Empty>No university cases assigned.</Empty>}</Section>
    </div>
  </section>;
}

/** The housing page shows the official assignment beside the preference form. */
export function UniversityHousingPanel() {
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await getUniversityRecord("relationships", undefined, signal); }
    catch (error) { if (error instanceof ApiClientError && error.status === 404) return null; throw error; }
  }, []);
  const resource = useApiResource(load, { refreshOnAmbient: false });
  if (resource.status === "ready" && !resource.data) return null;
  return <section className="university-record" aria-label="Official housing assignment">
    <header className="university-record__header"><div className="university-record__identity"><span className="university-record__icon" aria-hidden="true"><Icon name="home" size={22} /></span><div><h2>Your housing assignment</h2><p>The university’s recorded placement, separate from your preferences.</p></div></div></header>
    <div className="university-record__content">
      {resource.status === "loading" ? <p role="status" className="university-empty">Loading your housing assignment…</p> : resource.status === "error" ? <div role="alert"><p>Your housing assignment could not be loaded.</p><button className="university-button" type="button" onClick={resource.reload}>Try again</button></div> : resource.data?.housing?.length ? resource.data.housing.map(item => <Row key={item.id} title={item.residence_name ?? "Housing assignment"} detail={<>{item.room && <>Room {item.room}<br /></>}{item.reason}</>} aside={<Status value={item.status} />} />) : <Empty>No official assignment recorded yet. Your housing preferences appear below.</Empty>}
    </div>
  </section>;
}
