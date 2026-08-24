"use client";

import type { CreateStudentAppointmentInput, StudentAppointment } from "@vv/contracts";
import { useId, useRef, useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import Field from "../design-system/primitives/Field.jsx";
import { useApiAction } from "../hooks/use-api-resource";
import { createStudentAppointment } from "../lib/api-client";
import type { TenantConfig } from "../lib/tenant";
import { type ConversationType, articled, clockTime, longDate } from "./appointments-logic";

/**
 * Booking, in one drawer — the reference's `BookingDrawer`. The drawer is always about one topic;
 * the topic comes from the row that opened it and is not editable inside. The backend publishes
 * no slot list — the student chooses the start time — so the picker over published times is a
 * real date/time field in the design system's `Field` shape. One attempt, one honest state: the
 * result replaces the body of the sheet, and a retry reuses the idempotency key of the attempt it
 * repeats.
 */
export function AppointmentsBookingDrawer({
  type,
  tenant,
  now,
  prefill = null,
  onBooked,
  onClose,
}: {
  type: ConversationType;
  tenant: TenantConfig;
  now: number;
  prefill?: { subject?: string } | null;
  onBooked: (appointment: StudentAppointment) => void;
  onClose: () => void;
}) {
  const ids = useId();
  const attempt = useRef<string | null>(null);
  const action = useApiAction(createStudentAppointment);

  const [when, setWhen] = useState("");
  const [touched, setTouched] = useState(false);
  const [subject, setSubject] = useState(prefill?.subject ?? "");
  const [result, setResult] = useState<{ kind: "booked"; appointment: StudentAppointment } | { kind: "failed" } | null>(null);

  const startsAt = when ? new Date(when) : null;
  const whenError =
    touched && (!startsAt || Number.isNaN(startsAt.getTime()))
      ? "Choose a date and a time."
      : touched && startsAt && startsAt.getTime() <= now
        ? "Choose a time that is still ahead."
        : null;
  const validWhen = Boolean(startsAt && !Number.isNaN(startsAt.getTime()) && startsAt.getTime() > now);
  const canBook = validWhen && subject.trim().length > 0 && action.status !== "loading";

  async function book() {
    setTouched(true);
    if (!canBook || !startsAt) return;
    const input: CreateStudentAppointmentInput = {
      type: type.id,
      startsAt: startsAt.toISOString(),
      notes: subject.trim(),
    };
    if (!attempt.current) attempt.current = crypto.randomUUID();
    try {
      const appointment = await action.run(input, attempt.current);
      attempt.current = null;
      setResult({ kind: "booked", appointment });
      onBooked(appointment);
    } catch {
      // The idempotency key and the form stay for a safe retry.
      setResult({ kind: "failed" });
    }
  }

  const chosen = startsAt && validWhen ? `${longDate(startsAt.toISOString(), tenant)} · ${clockTime(startsAt.toISOString(), tenant)}` : null;

  const foot = !result && (
    <div className="booking-foot">
      <div className="booking-chosen">
        <span className="panel-label">You are booking</span>
        <strong>{chosen ?? "Choose a date and time above"}</strong>
        <span>{type.team}</span>
      </div>
      <div className="drawer-actions">
        <Button kind="primary" full icon="arrow" disabled={!canBook} pending={action.status === "loading"} onClick={book}>
          Book this time
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
      label={[type.category]}
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
              ? `Booked · ${longDate(result.appointment.startsAt, tenant)}`
              : `This didn’t reach ${articled(type.team)}`}
          </h2>

          <p>
            {result.kind === "booked"
              ? `${clockTime(result.appointment.startsAt, tenant)} with ${articled(type.team)}.`
              : action.message ??
                "Nothing is booked. Until this goes through, the conversation does not exist."}
          </p>

          <div className="result-facts">
            {result.kind === "booked" ? (
              <>
                <p>
                  <Icon name="calendar" size={15} />
                  <span>The time lands on your list and on the team’s, at the same moment.</span>
                </p>
                <p>
                  <Icon name="send" size={15} />
                  <span>What you wrote goes with the booking, so the team arrives prepared: “{subject.trim()}”</span>
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
          <h2 id="booking-drawer-title">{type.label}</h2>
          <p className="drawer-description">
            {type.blurb} {type.team}.
          </p>

          <div className="action-panel">
            <div onBlur={() => setTouched(true)}>
              <Field
                label="When?"
                type="datetime-local"
                value={when}
                hint={`${type.team} confirms the time you choose. Pick one that is still ahead.`}
                error={whenError}
                onChange={setWhen}
              />
            </div>

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
                One line is enough. It goes to the team with your booking, so nobody starts from nothing.
              </span>
            </label>
          </div>
        </>
      )}
    </Drawer>
  );
}
