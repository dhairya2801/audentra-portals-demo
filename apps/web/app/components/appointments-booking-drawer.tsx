"use client";

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
  prefill?: { subject?: string } | null;
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
      (signal: AbortSignal) =>
        getAppointmentAvailability(
          { type: type.id, staffMemberId: reschedule?.staff?.id ?? undefined },
          signal,
        ),
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
  const [personId, setPersonId] = useState<string | null>(null);
  const person: AppointmentAvailabilityStaff | null =
    people.find((entry) => entry.id === (personId ?? people[0]?.id)) ?? null;
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
        <span>{person ? `${person.name}${person.title ? ` · ${person.title}` : ""}` : type.team}</span>
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
      variant="booking"
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
              : `${type.blurb} ${type.team}.`}
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
                {people.length > 1 ? (
                  <div className="booking-people" role="radiogroup" aria-label="Who to see">
                    {people.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        role="radio"
                        aria-checked={entry.id === person?.id}
                        className={`booking-person${entry.id === person?.id ? " is-selected" : ""}`}
                        onClick={() => {
                          setPersonId(entry.id);
                          setSlot(null);
                        }}
                      >
                        <strong>{entry.name}</strong>
                        <small>
                          {entry.title ?? entry.component}
                          {entry.relationship ? ` · your ${entry.relationship.replace(/_/g, " ").replace("advisor", "adviser")}` : ""}
                          {entry.nextOpenSlotAt ? ` · next ${longDate(entry.nextOpenSlotAt, tenant)}` : entry.reason ? ` · ${entry.reason.replace(/_/g, " ")}` : ""}
                        </small>
                      </button>
                    ))}
                  </div>
                ) : null}
                {person ? (
                  <div className="booking-with">
                    <span className="panel-label">
                      {person.relationship === "primary_advisor"
                        ? "Your academic adviser"
                        : person.relationship
                          ? `Your ${person.relationship.replace(/_/g, " ").replace("advisor", "adviser")}`
                          : "With"}
                    </span>
                    <strong>
                      {person.name}
                      {person.title ? <span> · {person.title}</span> : null}
                    </strong>
                  </div>
                ) : null}
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
                  <SlotPicker person={person} tenant={tenant} selected={slot} onSelect={setSlot} />
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

function SlotPicker({
  person,
  tenant,
  selected,
  onSelect,
}: {
  person: AppointmentAvailabilityStaff;
  tenant: TenantConfig;
  selected: AppointmentSlot | null;
  onSelect: (slot: AppointmentSlot) => void;
}) {
  const days = useMemo(() => groupSlotsByDay(person.slots, tenant), [person.slots, tenant]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const activeDay = openDay ?? days[0]?.day ?? null;
  if (days.length === 0) return null;
  return (
    <div className="booking-slots">
      <span className="drawer-field-label">When?</span>
      <div className="booking-days" role="tablist" aria-label="Day">
        {days.map((day) => (
          <button
            key={day.day}
            type="button"
            role="tab"
            aria-selected={day.day === activeDay}
            className={`booking-day${day.day === activeDay ? " is-active" : ""}`}
            onClick={() => setOpenDay(day.day)}
          >
            {day.day}
            <small>{day.slots.length} open</small>
          </button>
        ))}
      </div>
      <div className="booking-times" role="radiogroup" aria-label="Time">
        {days
          .find((day) => day.day === activeDay)
          ?.slots.map((entry) => {
            const isSelected = selected?.startsAt === entry.startsAt;
            return (
              <button
                key={entry.startsAt}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`booking-time${isSelected ? " is-selected" : ""}`}
                onClick={() => onSelect(entry)}
              >
                {clockTime(entry.startsAt, tenant)}
                <small>
                  {entry.modality === "either" ? "in person or online" : entry.modality.replace("_", " ")}
                  {entry.location ? ` · ${entry.location}` : ""}
                </small>
              </button>
            );
          })}
      </div>
    </div>
  );
}
