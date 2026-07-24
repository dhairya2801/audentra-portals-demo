"use client";

import type {
  CreateStudentAppointmentInput,
  StudentAppointmentList,
  StudentAppointmentType,
} from "@vv/contracts";
import { type FormEvent, useCallback, useRef, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import {
  ActionFeedback,
  EmptyState,
  ErrorState,
  LoadingState,
  PageCard,
  StatusPill,
} from "../components/portal-ui";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  createStudentAppointment,
  getStudentAppointments,
} from "../lib/api-client";

const appointmentLabels: Record<StudentAppointmentType, string> = {
  admissions_counseling: "Admissions counseling",
  financial_aid: "Financial aid",
  enrollment_support: "Enrollment support",
};

function AppointmentWorkspace({
  list,
  reload,
}: {
  list: StudentAppointmentList;
  reload: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const intentKey = useRef<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const createAppointmentAction = useCallback(
    (input: CreateStudentAppointmentInput, key: string) =>
      createStudentAppointment(input, key),
    [],
  );
  const createAppointment = useApiAction(createAppointmentAction);

  const submitAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    createAppointment.reset();

    const values = new FormData(event.currentTarget);
    const startsAt = new Date(String(values.get("startsAt")));
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setValidationError("Choose an appointment time in the future.");
      return;
    }

    const notes = String(values.get("notes") || "").trim();
    const input: CreateStudentAppointmentInput = {
      type: values.get("type") as StudentAppointmentType,
      startsAt: startsAt.toISOString(),
      ...(notes ? { notes } : {}),
    };
    const key = intentKey.current ?? (intentKey.current = crypto.randomUUID());

    try {
      await createAppointment.run(input, key);
      intentKey.current = null;
      form.current?.reset();
      reload();
    } catch {
      // Retain the key and field values so the student can safely retry.
    }
  };

  return (
    <div className="resource-layout resource-layout--wide-aside">
      <PageCard
        eyebrow="Your schedule"
        title={`Appointments (${list.total})`}
      >
        {list.items.length === 0 ? (
          <EmptyState
            title="No appointments scheduled"
            description="Book time with an Aster advisor whenever you need a conversation."
          />
        ) : (
          <ul className="resource-list">
            {list.items.map((appointment) => (
              <li className="resource-list__item" key={appointment.id}>
                <time
                  className="appointment-date"
                  dateTime={appointment.startsAt}
                >
                  <strong>
                    {new Intl.DateTimeFormat("en-US", {
                      day: "numeric",
                    }).format(new Date(appointment.startsAt))}
                  </strong>
                  <span>
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                    }).format(new Date(appointment.startsAt))}
                  </span>
                </time>
                <div className="resource-list__content">
                  <div className="resource-list__title">
                    <h3>{appointmentLabels[appointment.type]}</h3>
                    <StatusPill value={appointment.status} />
                  </div>
                  <div className="resource-list__meta">
                    <span>
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "long",
                        timeStyle: "short",
                      }).format(new Date(appointment.startsAt))}
                    </span>
                  </div>
                  {appointment.notes ? <p>{appointment.notes}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageCard>

      <PageCard eyebrow="Advisor time" title="Book an appointment">
        <form ref={form} className="portal-form" onSubmit={submitAppointment}>
          <label className="field">
            <span>Conversation type</span>
            <select name="type" defaultValue="enrollment_support" required>
              {Object.entries(appointmentLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Date and time</span>
            <input name="startsAt" type="datetime-local" required />
          </label>
          <label className="field">
            <span>What would you like to discuss? <small>Optional</small></span>
            <textarea name="notes" rows={4} maxLength={500} />
          </label>
          {validationError ? (
            <p className="field-error" role="alert">
              {validationError}
            </p>
          ) : null}
          <ActionFeedback
            status={createAppointment.status}
            error={createAppointment.message}
            success="Your appointment is scheduled."
          />
          <button
            className="button button--primary"
            type="submit"
            disabled={createAppointment.status === "loading"}
          >
            {createAppointment.status === "loading"
              ? "Scheduling…"
              : createAppointment.status === "error"
                ? "Retry appointment"
                : "Schedule appointment"}
          </button>
        </form>
      </PageCard>
    </div>
  );
}

export default function AppointmentsPage() {
  const loadAppointments = useCallback(
    (signal: AbortSignal) => getStudentAppointments(signal),
    [],
  );
  const appointments = useApiResource(loadAppointments);

  return (
    <PortalShell
      active="appointments"
      eyebrow="Personal guidance"
      title="Appointments"
      description="Schedule focused time with an Aster advisor for the questions that matter."
    >
      {appointments.status === "loading" ? (
        <LoadingState label="Loading your appointments" />
      ) : appointments.status === "error" ? (
        <ErrorState
          message={appointments.error}
          onRetry={appointments.reload}
        />
      ) : (
        <AppointmentWorkspace
          list={appointments.data}
          reload={appointments.refresh}
        />
      )}
    </PortalShell>
  );
}
