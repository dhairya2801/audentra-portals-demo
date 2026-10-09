"use client";

import { StaffAvatar } from "./staff-avatar";

import type {
  AppointmentAvailabilityStaff,
  AppointmentSlot,
  CreateStudentAppointmentInput,
  StudentAppointment,
} from "@vv/contracts";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import Field from "../design-system/primitives/Field.jsx";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  ApiClientError,
  createStudentAppointment,
  getAppointmentAvailability,
  getStudentAdvising,
  rescheduleStudentAppointment,
} from "../lib/api-client";
import type { TenantConfig } from "../lib/tenant";
import {
  type ConversationType,
  articled,
  bookingRefusal,
  clockTime,
  groupSlotsByDay,
  longDate,
} from "./appointments-logic";

/**
 * Booking, in one drawer — the reference's `BookingDrawer`. The drawer is always about one topic;
 * the topic comes from the row that opened it and is not editable inside.
 *
 * The platform now publishes *who* takes this kind of conversation for the student (their
 * assigned adviser or counsellor, or the people who offer it) and *when* that person is free:
 * the picker is that person's open slots, and the platform refuses anything else — a taken
 * slot, a time outside their hours, a person on leave. When nobody publishes hours for a topic
 * the student still chooses a time, as before.
 *
 * In `reschedule` mode the same drawer moves an existing conversation: the old time is released
 * and the new one booked in one step on the server.
 */
export function AppointmentsBookingDrawer({
  type,
  tenant,
  now,
  prefill = null,
  reschedule = null,
  onBooked,
  onClose,
}: {
  type: ConversationType;
  tenant: TenantConfig;
  now: number;
  prefill?: { subject?: string; staffMemberId?: string } | null;
  reschedule?: StudentAppointment | null;
  onBooked: (appointment: StudentAppointment) => void;
  onClose: () => void;
}) {
  const ids = useId();
  const attempt = useRef<string | null>(null);
  // The name the refusal copy addresses; kept in a ref so the error mapper below can read
  // whichever person is selected when the platform answers.
  const personName = useRef(type.team);
  const availability = useApiResource(
    useCallback(
      async (signal: AbortSignal) => {
        const [calendar, advising] = await Promise.all([
          getAppointmentAvailability({ type: type.id, staffMemberId: reschedule?.staff?.id ?? undefined }, signal),
          getStudentAdvising(signal).catch(() => null),
        ]);
        const role = type.id === "academic_advising" ? "primary_advisor" : type.id === "financial_aid" ? "financial_aid_counselor" : type.id === "enrollment_support" || type.id === "admissions_counseling" ? "admissions_counselor" : "international_adviser";
        return {...calendar, assignedStaffId: reschedule?.staff?.id ?? advising?.advisers.find(entry => entry.role === role)?.staff.id};
      },
      [type.id, reschedule?.staff?.id],
    ),
    { refreshOnAmbient: false },
  );
  const [refusal, setRefusal] = useState<string | null>(null);
  const action = useApiAction(
    async (input: CreateStudentAppointmentInput, key: string) =>
      reschedule
        ? rescheduleStudentAppointment(
            reschedule.id,
            { startsAt: input.startsAt, staffMemberId: input.staffMemberId, notes: input.notes },
            key,
          )
        : createStudentAppointment(input, key),
    (error) => {
      if (error instanceof ApiClientError) {
        return bookingRefusal(error.code, personName.current) ?? error.message;
      }
      return "Nothing was booked. Trying again is safe.";
    },
  );
  const people = useMemo(() => availability.data?.staff ?? [], [availability.data]);
  const [showOthers, setShowOthers] = useState(false);
  const sortedPeople = [...people].sort((a, b) => (a.nextOpenSlotAt ? Date.parse(a.nextOpenSlotAt) : Infinity) - (b.nextOpenSlotAt ? Date.parse(b.nextOpenSlotAt) : Infinity) || a.name.localeCompare(b.name));
  const [personId, setPersonId] = useState<string | null>(prefill?.staffMemberId ?? null);
  const person: AppointmentAvailabilityStaff | null =
    people.find((entry) => entry.id === personId) ?? people.find(entry => entry.id === availability.data?.assignedStaffId) ?? people.find(entry => entry.relationship === (type.id === "academic_advising" ? "primary_advisor" : type.id === "financial_aid" ? "financial_aid_counselor" : type.id === "enrollment_support" || type.id === "admissions_counseling" ? "admissions_counselor" : "international_adviser")) ?? people[0] ?? null;
  useEffect(() => {
    personName.current = person?.name ?? type.team;
  }, [person, type.team]);
  const freeTime = availability.status === "ready" && people.length === 0;

  const [slot, setSlot] = useState<AppointmentSlot | null>(null);
  const [when, setWhen] = useState("");
  const [touched, setTouched] = useState(false);
  const [subject, setSubject] = useState(prefill?.subject ?? reschedule?.notes ?? "");
  const [result, setResult] = useState<{ kind: "booked"; appointment: StudentAppointment } | { kind: "failed" } | null>(null);

  const typedStart = when ? new Date(when) : null;
  const whenError =
    touched && freeTime && (!typedStart || Number.isNaN(typedStart.getTime()))
      ? "Choose a date and a time."
      : touched && freeTime && typedStart && typedStart.getTime() <= now
        ? "Choose a time that is still ahead."
        : null;
  const startsAt = freeTime
    ? typedStart && !Number.isNaN(typedStart.getTime()) && typedStart.getTime() > now
      ? typedStart
      : null
    : slot
      ? new Date(slot.startsAt)
      : null;
  const canBook = Boolean(startsAt) && subject.trim().length > 0 && action.status !== "loading";

  async function book() {
    setTouched(true);
    if (!canBook || !startsAt) return;
    const input: CreateStudentAppointmentInput = {
      type: type.id,
      startsAt: startsAt.toISOString(),
      notes: subject.trim(),
      ...(person && !freeTime ? { staffMemberId: person.id } : {}),
    };
    if (!attempt.current) attempt.current = crypto.randomUUID();
    setRefusal(null);
    try {
      const appointment = await action.run(input, attempt.current);
      attempt.current = null;
      setResult({ kind: "booked", appointment });
      onBooked(appointment);
    } catch (error) {
      // A refused slot is not a failed request: the calendar moved. Reload it and let the
      // student pick again with the same subject; the idempotency key is retired because the
      // next attempt is a different booking.
      if (error instanceof ApiClientError && error.status === 409 && !freeTime) {
        attempt.current = null;
        setSlot(null);
        setRefusal(bookingRefusal(error.code, personName.current) ?? error.message);
        availability.refresh();
        return;
      }
      setResult({ kind: "failed" });
    }
  }

  const who = person?.name ?? type.team;
  const chosen = startsAt ? `${longDate(startsAt.toISOString(), tenant)} · ${clockTime(startsAt.toISOString(), tenant)}` : null;

  const foot = !result && (
    <div className="booking-foot">
      <div className="booking-chosen">
        <span className="panel-label">{reschedule ? "Moving to" : "You are booking"}</span>
        <strong>{chosen ?? (freeTime ? "Choose a date and time above" : "Choose a time above")}</strong>

      </div>
      <div className="drawer-actions">
        <Button kind="primary" full icon="arrow" disabled={!canBook} pending={action.status === "loading"} onClick={book}>
          {reschedule ? "Move to this time" : "Book this time"}
        </Button>
        <Button kind="secondary" full onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <Drawer
      variant="booking booking-modal"
      label={[type.category, ...(reschedule ? ["Reschedule"] : [])]}
      titleId="booking-drawer-title"
      closeLabel="Close"
      onClose={onClose}
      foot={foot}
    >
      {result ? (
        <div className={`booking-result ${result.kind}`}>
          <span className="result-icon" aria-hidden="true">
            <Icon name={result.kind === "booked" ? "check" : "alert"} size={24} />
          </span>

          <h2 id="booking-drawer-title">
            {result.kind === "booked"
              ? `${reschedule ? "Moved" : "Booked"} · ${longDate(result.appointment.startsAt, tenant)}`
              : `This didn’t reach ${articled(who)}`}
          </h2>

          <p>
            {result.kind === "booked"
              ? `${clockTime(result.appointment.startsAt, tenant)} with ${result.appointment.staff?.name ?? articled(type.team)}${
                  result.appointment.location ? `, ${result.appointment.location}` : ""
                }.`
              : action.message ?? "Nothing is booked. Until this goes through, the conversation does not exist."}
          </p>

          <div className="result-facts">
            {result.kind === "booked" ? (
              <>
                <p>
                  <Icon name="calendar" size={15} />
                  <span>The time lands on your list and on {result.appointment.staff ? `${result.appointment.staff.name}’s calendar` : "the team’s"}, at the same moment.</span>
                </p>
                <p>
                  <Icon name="send" size={15} />
                  <span>What you wrote goes with the booking, so they arrive prepared: “{subject.trim()}”</span>
                </p>
              </>
            ) : (
              <p>
                <Icon name="alert" size={15} />
                <span>
                  Nothing was saved and nothing is shown as <strong>Confirmed</strong>. Trying again is safe.
                </span>
              </p>
            )}
          </div>

          <div className="result-actions">
            {result.kind === "failed" ? (
              <>
                <Button kind="primary" full icon="refresh" onClick={() => setResult(null)}>
                  Try again
                </Button>
                <Button kind="secondary" full onClick={onClose}>
                  Close
                </Button>
              </>
            ) : (
              <Button kind="primary" full icon="check" onClick={onClose}>
                Done
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="drawer-icon appointment" aria-hidden="true">
            <Icon name="calendar" size={25} weight="duotone" />
          </div>
          <h2 id="booking-drawer-title">{reschedule ? `Move: ${type.label}` : type.label}</h2>
          <p className="drawer-description">
            {reschedule
              ? `Currently ${longDate(reschedule.startsAt, tenant)} at ${clockTime(reschedule.startsAt, tenant)}. Pick the new time; the old one is released when the new one is confirmed.`
              : type.blurb}
          </p>

          <div className="action-panel">
            {availability.status === "loading" ? (
              <p className="form-help">Checking who can see you and when…</p>
            ) : availability.status === "error" ? (
              <p className="field-error" role="alert">
                We couldn’t load the calendar. {availability.error}
              </p>
            ) : freeTime ? (
              <div onBlur={() => setTouched(true)}>
                <Field
                  label="When?"
                  type="datetime-local"
                  value={when}
                  hint={`Nobody publishes hours for this yet, so ${type.team} confirms the time you choose. Pick one that is still ahead.`}
                  error={whenError}
                  onChange={setWhen}
                />
              </div>
            ) : (
              <>
                {person ? (
                  <div className="booking-contact">
                    <StaffAvatar person={person} size="md"/>
                    <div><span className="panel-label">{person.relationship || person.id === availability.data?.assignedStaffId ? "Your assigned contact" : "Your selected contact"}</span>
                    <strong>{person.name}</strong><span>{person.title || person.component}</span>
                    {person.email && <a href={`mailto:${person.email}`}>{person.email}</a>}
                    <small>{person.nextOpenSlotAt ? `Next available · ${longDate(person.nextOpenSlotAt, tenant)} at ${clockTime(person.nextOpenSlotAt, tenant)}` : "No open times in the next two weeks"}</small></div>
                    {people.length > 1 && <button type="button" className="text-button" aria-expanded={showOthers} aria-controls={`${ids}-people`} onClick={() => setShowOthers(!showOthers)}>{showOthers ? "Hide alternatives" : "See others"}</button>}
                  </div>
                ) : null}
                {showOthers && <div id={`${ids}-people`} className="booking-people" role="radiogroup" aria-label="Who to see, ordered by next availability">
                  {sortedPeople.map(entry => <button key={entry.id} type="button" role="radio" aria-checked={entry.id === person?.id} className={`booking-person${entry.id === person?.id ? " is-selected" : ""}`} onClick={() => {setPersonId(entry.id);setSlot(null);setShowOthers(false);}}>
                    <StaffAvatar person={entry} size="sm"/><strong>{entry.name}</strong><small>{entry.title || entry.component}</small>
                    <small>{entry.nextOpenSlotAt ? `Next · ${longDate(entry.nextOpenSlotAt, tenant)} at ${clockTime(entry.nextOpenSlotAt, tenant)}` : "No open times"}</small>
                  </button>)}
                </div>}
                {refusal ? (
                  <p className="field-error" role="alert">
                    {refusal}
                  </p>
                ) : null}
                {person && person.reason ? (
                  <p className="form-help booking-reason" role="status">
                    {person.reason === "on_leave"
                      ? `${person.name} is on leave${person.leaveUntil ? ` until ${person.leaveUntil}` : ""}, so nothing can be booked with them right now.`
                      : person.reason === "departed"
                        ? `${person.name} is no longer at ${tenant.shortName}. A new adviser has not been assigned yet — ask Edward or ${articled(type.team)} who can see you.`
                        : person.reason === "no_open_slots"
                          ? `${person.name} has no open slot in the next two weeks. Check back, or ask ${articled(type.team)} for another time.`
                          : `${person.name} does not take this kind of conversation.`}
                  </p>
                ) : person ? (
                  <SlotPicker key={person.id} person={person} tenant={tenant} selected={slot} onSelect={setSlot} />
                ) : null}
              </>
            )}

            <label className="drawer-field" htmlFor={`${ids}-about`}>
              <span className="drawer-field-label">What’s it about?</span>
              <textarea
                id={`${ids}-about`}
                rows={2}
                required
                aria-required="true"
                aria-describedby={`${ids}-about-help`}
                value={subject}
                maxLength={500}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Whether the transcript I uploaded is the one Admissions needs."
              />
              <span className="form-help" id={`${ids}-about-help`}>
                One line is enough. It goes to {person ? person.name : "the team"} with your booking, so nobody starts from nothing.
              </span>
            </label>
          </div>
        </>
      )}
    </Drawer>
  );
}

function SlotPicker({ person, tenant, selected, onSelect }: {
  person: AppointmentAvailabilityStaff;
  tenant: TenantConfig;
  selected: AppointmentSlot | null;
  onSelect: (slot: AppointmentSlot | null) => void;
}) {
  const days = useMemo(() => groupSlotsByDay(person.slots, tenant), [person.slots, tenant]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const activeDay = days.find(day => day.day === openDay) ?? days[0];
  const visibleDays = days.slice(page * 5, page * 5 + 5);
  if (!days.length) return null;

  function changePage(next: number) {
    setPage(next);
    setOpenDay(days[next * 5].day);
    onSelect(null);
  }

  return (
    <div className="booking-calendar-layout">
      <div className="booking-date-panel">
        <div className="calendar-panel-title">
          <span>Choose a day</span>
          <div>
            <button type="button" aria-label="Previous dates" disabled={!page} onClick={() => changePage(page - 1)}>‹</button>
            <button type="button" aria-label="Next dates" disabled={(page + 1) * 5 >= days.length} onClick={() => changePage(page + 1)}>›</button>
          </div>
        </div>
        <div className="booking-date-grid" aria-label="Available days">
          {visibleDays.map(day => (
            <button type="button" key={day.day} aria-pressed={day.day === activeDay.day}
              onClick={() => { setOpenDay(day.day); onSelect(null); }}>
              <span>{day.day.split(",")[0]}</span>
              <strong>{new Intl.DateTimeFormat("en-US", {
                month: "short", day: "numeric", timeZone: tenant.localization.timeZone,
              }).format(new Date(day.slots[0].startsAt))}</strong>
              <small>{day.slots.length} times available</small>
            </button>
          ))}
        </div>
        <p className="calendar-timezone"><Icon name="clock" size={14} /> {tenant.localization.timeZone.replaceAll("_", " ")}</p>
      </div>
      <div className="booking-time-panel">
        <span className="calendar-panel-title">{activeDay.day}</span>
        <p>Pick the time that fits your day.</p>
        <div className="booking-time-grid" role="group" aria-label="Available times">
          {activeDay.slots.map(entry => (
            <button type="button" key={entry.startsAt} aria-pressed={selected?.startsAt === entry.startsAt} onClick={() => onSelect(entry)}>
              {clockTime(entry.startsAt, tenant)}
              {selected?.startsAt === entry.startsAt ? <Icon name="check" size={14} /> : null}
            </button>
          ))}
        </div>
        {selected ? (
          <p className="selected-slot-location">
            <Icon name="check" size={15} />
            {selected.modality === "either" ? "In person or online" : selected.modality.replaceAll("_", " ")}
            {selected.location ? ` · ${selected.location}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
