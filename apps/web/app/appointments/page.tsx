"use client";

import type { CreateStudentAppointmentInput, StudentAppointmentList, StudentAppointmentType } from "@vv/contracts";
import { type FormEvent, useCallback, useRef, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { StudentPortalIcon } from "../components/student-portal-icon";
import { TenantLink as Link } from "../components/tenant-link";
import { ActionFeedback, ErrorState, LoadingState } from "../components/portal-ui";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import { createStudentAppointment, getStudentAppointments } from "../lib/api-client";
import { useTenant } from "../components/tenant-provider";
import { formatTenantDate } from "../lib/tenant";

const labels: Record<StudentAppointmentType, string> = {
  admissions_counseling: "Admissions counseling",
  financial_aid: "Financial aid",
  enrollment_support: "Enrollment support",
};

const descriptions: Record<StudentAppointmentType, string> = {
  admissions_counseling: "Talk through your offer, enrollment timeline, or a decision that is holding you up.",
  financial_aid: "Review aid, required documents, your balance, or a payment question.",
  enrollment_support: "Get help with a requirement, form, upload, or next enrollment step.",
};

function AppointmentWorkspace({ list, reload }: { list: StudentAppointmentList; reload: () => void }) {
  const { tenant } = useTenant();
  const form = useRef<HTMLFormElement>(null);
  const intentKey = useRef<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<StudentAppointmentType>("enrollment_support");
  const action = useApiAction(useCallback((input: CreateStudentAppointmentInput, key: string) => createStudentAppointment(input, key), []));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    action.reset();
    const values = new FormData(event.currentTarget);
    const startsAt = new Date(String(values.get("startsAt")));
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setValidationError("Choose an appointment time in the future.");
      return;
    }
    const notes = String(values.get("notes") || "").trim();
    const input: CreateStudentAppointmentInput = { type: values.get("type") as StudentAppointmentType, startsAt: startsAt.toISOString(), ...(notes ? { notes } : {}) };
    const key = intentKey.current ?? (intentKey.current = crypto.randomUUID());
    try {
      await action.run(input, key);
      intentKey.current = null;
      form.current?.reset();
      setSelectedType("enrollment_support");
      reload();
    } catch {
      // The form and idempotency key remain for a safe retry.
    }
  };

  return (
    <>
      <section className="page-summary" aria-label="Appointments standing">
        <div className="summary-main">
          <div className="summary-figure"><div className="summary-figure-copy"><span className="panel-label">Your conversations</span><strong>{list.total ? `${list.total} ${list.total === 1 ? "appointment" : "appointments"}` : "Nothing booked yet"}</strong><p>{list.total ? "Every confirmed time is listed below with the team that owns it." : "The teams below are ready when you need them."}</p></div></div>
          <div className="advisor-bar"><img className="avatar avatar-md advisor-avatar" src="/people/tomas-okafor.webp" width="40" height="40" alt="" /><div className="advisor-bar-copy"><span className="panel-label">Your enrollment advisor</span><strong>Tomás Okafor <span>· Admissions Office</span></strong></div><div className="advisor-actions"><a className="advisor-action" href="mailto:admissions@aster.edu" aria-label="Email Tomás Okafor">✉</a><Link className="advisor-action" href="/messages" aria-label="Message Tomás Okafor"><StudentPortalIcon name="message" size={16} /></Link></div></div>
        </div>
      </section>

      <div className="page-body">
        <div className="page-main">
          <section className="section-card">
            <div className="status-heading"><span className="status-icon review"><StudentPortalIcon name="calendar" size={20} /></span><div><h2>Your conversations</h2><p>Booked with Aster teams</p></div>{list.total ? <span className="status-count">{list.total}</span> : null}</div>
            {list.items.length ? <div className="card-rows appointment-list">{list.items.map((appointment) => {
              const date = new Date(appointment.startsAt);
              return <article className={`appointment-row ${appointment.status}`} key={appointment.id}><div className="appointment-row-body"><span className="date-tile" aria-hidden="true"><small>{formatTenantDate(appointment.startsAt, tenant, { month: "short" })}</small><strong>{formatTenantDate(appointment.startsAt, tenant, { day: "numeric" })}</strong></span><div className="campus-row-copy"><span className="campus-row-when">{formatTenantDate(appointment.startsAt, tenant, { timeStyle: "short" })}</span><h3 className="campus-row-title">{labels[appointment.type]}</h3><span className="campus-row-meta"><span className="appointment-subject">{appointment.notes ? `About: ${appointment.notes}` : "No subject was added"}</span></span></div><div className="task-action"><span className={`appt-state ${appointment.status}`}>{appointment.status.replaceAll("_", " ")}</span><a className="secondary-button" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:${date.toISOString().replaceAll(/[-:]/g, "").replace(".000", "")}\nSUMMARY:${labels[appointment.type]}\nEND:VEVENT\nEND:VCALENDAR`)}`} download="aster-appointment.ics"><StudentPortalIcon name="calendar" size={15} /> Add to calendar</a></div></div></article>;
            })}</div> : <div className="state-card empty inset"><span className="state-icon"><StudentPortalIcon name="calendar" size={20} /></span><div><h3>No appointments booked</h3><p>Choose a conversation below whenever a team can help.</p></div></div>}
          </section>

          <section className="section-card" id="book-appointment">
            <div className="status-heading"><span className="status-icon accent"><StudentPortalIcon name="calendar" size={20} /></span><div><h2>Choose a conversation</h2><p>The subject decides which team receives it.</p></div></div>
            <div className="card-rows task-list">{(Object.keys(labels) as StudentAppointmentType[]).map((type, index) => <article className={`task-card topic-row${selectedType === type ? " recommended" : ""}`} key={type}>{selectedType === type && index === 0 ? <div className="action-band"><span className="action-band-label"><StudentPortalIcon name="spark" size={14} /> Start here</span></div> : null}<div className="task-card-body"><div className="task-type-icon meeting"><StudentPortalIcon name="calendar" size={21} /></div><div className="task-main"><div className="task-meta-row"><span>{type === "financial_aid" ? "Financial Aid Office" : "Admissions Office"}</span></div><h3>{labels[type]}</h3><p>{descriptions[type]}</p><div className="task-facts"><span><StudentPortalIcon name="calendar" size={15} /> You choose the time</span><span><StudentPortalIcon name="message" size={15} /> Add your question</span></div></div><div className="task-action"><button className={selectedType === type ? "primary-button" : "secondary-button"} type="button" onClick={() => { setSelectedType(type); document.getElementById("appointment-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Book a time <StudentPortalIcon name="chevron" size={15} /></button><Link className="edward-ask" href={`/edward?topic=${encodeURIComponent(type)}`}><span className="edward-ask-mark">E</span> Ask Edward</Link></div></div></article>)}</div>
          </section>

          <section className="section-card booking-card" id="appointment-form">
            <div className="status-heading"><span className="status-icon accent"><StudentPortalIcon name="calendar" size={20} /></span><div><h2>Book {labels[selectedType].toLowerCase()}</h2><p>Only a confirmed API response adds the appointment above.</p></div></div>
            <form ref={form} className="portal-form booking-form" onSubmit={submit}>
              <label className="field"><span>Conversation type</span><select name="type" value={selectedType} onChange={(event) => setSelectedType(event.target.value as StudentAppointmentType)}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label className="field"><span>Date and time</span><input name="startsAt" type="datetime-local" required /></label>
              <label className="field"><span>What would you like to discuss? <small>Optional</small></span><textarea name="notes" rows={4} maxLength={500} /></label>
              {validationError ? <p className="field-error" role="alert">{validationError}</p> : null}
              <ActionFeedback status={action.status} error={action.message} success="Your appointment is scheduled." />
              <button className="primary-button" type="submit" disabled={action.status === "loading"}>{action.status === "loading" ? "Scheduling…" : action.status === "error" ? "Retry appointment" : "Schedule appointment"}</button>
            </form>
          </section>
        </div>
        <aside className="page-rail"><div className="anchor-card booking-card"><span className="panel-label">How this works</span><p>Each team owns its conversations. A time only appears in your list after Aster confirms it.</p><div className="booking-provenance"><span><StudentPortalIcon name="calendar" size={13} /> Live student appointments</span><span>·</span><span>Canonical API record</span></div><Link className="learn-link" href="/help">Appointment help <StudentPortalIcon name="chevron" size={14} /></Link></div><div className="skipped-card"><span className="resume-badge">Need a different route?</span><h3>Edward can help choose the right team.</h3><p>Describe what is blocked and Edward will keep your question with the handoff.</p><Link href="/edward">Ask Edward <StudentPortalIcon name="chevron" size={16} /></Link></div></aside>
      </div>
    </>
  );
}

export default function AppointmentsPage() {
  const appointments = useApiResource(useCallback((signal: AbortSignal) => getStudentAppointments(signal), []));
  return <PortalShell active="appointments" eyebrow="Appointments · Times published by Aster teams" title="Appointments" description="Schedule focused time with a {institution} advisor for the questions that matter.">{appointments.status === "loading" ? <LoadingState label="Loading your appointments" /> : appointments.status === "error" ? <ErrorState message={appointments.error} onRetry={appointments.reload} /> : <AppointmentWorkspace list={appointments.data} reload={appointments.refresh} />}</PortalShell>;
}
