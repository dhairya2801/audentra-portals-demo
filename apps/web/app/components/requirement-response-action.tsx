"use client";

import type {
  CreateStudentAppointmentInput,
  StudentAppointment,
  StudentAppointmentType,
  StudentRequirementFormDefinition,
  StudentRequirementDetail,
  StudentRequirementInputField,
  StudentRequirementResponsePayload,
  StudentRequirementResponseValue,
  SubmitStudentRequirementResponseInput,
} from "@vv/contracts";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import {
  createStudentRequirementAppointment,
  getStudentRequirementAppointments,
  submitStudentRequirementResponse,
} from "../lib/api-client";
import {
  getApiErrorMessage,
  useApiAction,
  useApiResource,
} from "../hooks/use-api-resource";
import { visibleConfiguredFields } from "./requirement-response-model";
import { useTenant } from "./tenant-provider";

type SubmitResponse = (payload: StudentRequirementResponsePayload) => Promise<void>;

/** The reference `Field` anatomy around an uncontrolled control — the forms
 *  here read `FormData` on submit, so the primitive's controlled input is the
 *  wrong half; the classes are the same and so is the way an error is said. */
export function FieldShell({
  label,
  hint,
  optional = false,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {optional ? <em className="field-optional"> · optional</em> : null}
      </span>
      <span className="field-control">{children}</span>
      {hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}

export function ChoiceOption({
  name,
  value,
  type,
  title,
  note,
  required,
  defaultChecked,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  type: "radio" | "checkbox";
  title: ReactNode;
  note?: ReactNode;
  required?: boolean;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const [localChecked, setLocalChecked] = useState(Boolean(defaultChecked));
  const chosen = checked ?? localChecked;
  return (
    <label className={chosen ? "chosen" : ""}>
      <input
        type={type}
        name={name}
        value={value}
        required={required}
        checked={checked}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        onChange={(event) => {
          if (checked === undefined) setLocalChecked(event.target.checked);
          onChange?.(event.target.checked);
        }}
      />
      <span>
        <strong>{title}</strong>
        {note ? <small>{note}</small> : null}
      </span>
      <span className="radio-mark">
        <Icon name="check" size={14} />
      </span>
    </label>
  );
}

function configuredFields(requirement: StudentRequirementDetail) {
  const fields =
    requirement.interactionType === "selection_flow"
      ? requirement.inputConfig.flow
      : requirement.inputConfig.fields;
  return fields ?? [];
}

function configuredForm(requirement: StudentRequirementDetail): StudentRequirementFormDefinition {
  const publishedForm = requirement.inputConfig.form;
  if (publishedForm?.version === 1 && publishedForm.pages.length > 0) {
    return publishedForm;
  }
  return {
    version: 1,
    pages: [{
      id: "student_details",
      title: "Your response",
      description: "Complete the questions below.",
      fields: configuredFields(requirement),
    }],
  };
}

function ConfiguredField({
  field,
  currentValue,
}: {
  field: StudentRequirementInputField;
  currentValue?: StudentRequirementResponseValue;
}) {
  if (field.field_type === "checkbox") {
    return (
      <div className="choice-panel tight" role="group" aria-label={field.title}>
        <ChoiceOption
          type="checkbox"
          name={field.id}
          value="true"
          required={field.required}
          title={field.title}
          defaultChecked={currentValue === true}
        />
      </div>
    );
  }
  if (field.field_type === "single_select") {
    return (
      <FieldShell label={field.title} optional={!field.required}>
        <select name={field.id} required={field.required} defaultValue={typeof currentValue === "string" ? currentValue : ""}>
          <option value="" disabled>
            Choose one
          </option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }
  if (field.field_type === "multiple_select") {
    const selected = Array.isArray(currentValue) ? currentValue.map(String) : [];
    return (
      <fieldset className="choice-fieldset">
        <legend className="field-label">
          {field.title}
          {field.maximum_selections ? ` · up to ${field.maximum_selections}` : ""}
        </legend>
        <div className="choice-panel tight" role="group" aria-label={field.title}>
          {(field.options ?? []).map((option) => (
            <ChoiceOption
              key={option}
              type="checkbox"
              name={field.id}
              value={option}
              title={option}
              defaultChecked={selected.includes(option)}
            />
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <FieldShell label={field.title} optional={!field.required}>
      <input
        name={field.id}
        type={field.field_type === "phone" ? "tel" : field.field_type}
        required={field.required}
        min={field.minimum}
        max={field.maximum}
        step={field.step}
        defaultValue={
          typeof currentValue === "string" || typeof currentValue === "number"
            ? currentValue
            : ""
        }
      />
    </FieldShell>
  );
}

function valuesFromForm(
  form: FormData,
  fields: StudentRequirementInputField[],
  validateSelections = true,
) {
  const values: Record<string, StudentRequirementResponseValue> = {};
  for (const field of fields) {
    if (field.field_type === "checkbox") {
      values[field.id] = form.has(field.id);
    } else if (field.field_type === "multiple_select") {
      const selected = form.getAll(field.id).map(String);
      if (
        validateSelections &&
        field.maximum_selections &&
        selected.length > field.maximum_selections
      ) {
        throw new Error(
          `${field.title} allows up to ${field.maximum_selections} selections.`,
        );
      }
      values[field.id] = selected;
    } else if (field.field_type === "number") {
      const rawValue = String(form.get(field.id) ?? "").trim();
      const parsedValue = Number(rawValue);
      if (rawValue && !Number.isFinite(parsedValue)) {
        throw new Error(`${field.title} must be a valid number.`);
      }
      values[field.id] = rawValue ? parsedValue : null;
    } else {
      values[field.id] = String(form.get(field.id) ?? "");
    }
  }
  return values;
}

function GenericValuesForm({
  requirement,
  submit,
  loading,
  onValidationError,
}: {
  requirement: StudentRequirementDetail;
  submit: SubmitResponse;
  loading: boolean;
  onValidationError: (message: string | null) => void;
}) {
  const form = configuredForm(requirement);
  const fields = form.pages.flatMap((page) => page.fields);
  const [pageIndex, setPageIndex] = useState(0);
  const [currentValues, setCurrentValues] = useState<
    Record<string, StudentRequirementResponseValue>
  >({});
  const page = form.pages[Math.min(pageIndex, form.pages.length - 1)];
  const visibleFields = visibleConfiguredFields(page?.fields ?? [], currentValues);
  if (fields.length === 0) {
    return (
      <div className="requirement-form">
        <p className="form-help">No additional information is needed for this step.</p>
        <Button
          kind="primary"
          icon="arrow"
          full
          pending={loading}
          onClick={() => void submit({ values: {} }).catch(() => undefined)}
        >
          Complete this step
        </Button>
      </div>
    );
  }
  const valuesForPage = (formData: FormData, validateSelections: boolean) => {
    const next = { ...currentValues };
    for (const field of page?.fields ?? []) delete next[field.id];
    return {
      ...next,
      ...valuesFromForm(formData, visibleFields, validateSelections),
    };
  };
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const values = valuesForPage(new FormData(event.currentTarget), true);
      onValidationError(null);
      if (pageIndex < form.pages.length - 1) {
        setCurrentValues(values);
        setPageIndex((current) => current + 1);
        return;
      }
      await submit({ values });
    } catch (error) {
      onValidationError(
        error instanceof Error ? error.message : "Review the response and try again.",
      );
    }
  };
  const last = pageIndex === form.pages.length - 1;
  return (
    <form
      className="requirement-form"
      onChange={(event) =>
        setCurrentValues(valuesForPage(new FormData(event.currentTarget), false))
      }
      onSubmit={(event) => void onSubmit(event)}
    >
      <div className="form-page-head">
        {form.pages.length > 1 ? (
          <span className="field-label" aria-label={`Step ${pageIndex + 1} of ${form.pages.length}`}>
            Step {pageIndex + 1} of {form.pages.length}
          </span>
        ) : null}
        <h3>{page?.title}</h3>
        {page?.description ? <p className="form-help">{page.description}</p> : null}
      </div>
      {visibleFields.map((field) => (
        <ConfiguredField key={field.id} field={field} currentValue={currentValues[field.id]} />
      ))}
      <Button kind="primary" icon="arrow" full pending={loading} type="submit">
        {last ? "Submit my response" : "Continue"}
      </Button>
      {pageIndex > 0 ? (
        <button
          className="skip-link"
          type="button"
          disabled={loading}
          onClick={() => setPageIndex((current) => current - 1)}
        >
          Back to step {pageIndex}
        </button>
      ) : null}
    </form>
  );
}

function Unavailable() {
  const { tenant } = useTenant();
  return (
    <Notice tone="working" icon="clock" title="This choice is temporarily unavailable">
      {tenant.shortName} is updating it. You do not need to do anything yet.
    </Notice>
  );
}

function SingleSelectForm({
  requirement,
  submit,
  loading,
}: {
  requirement: StudentRequirementDetail;
  submit: SubmitResponse;
  loading: boolean;
}) {
  const options = requirement.inputConfig.options ?? [];
  const [chosen, setChosen] = useState<string | null>(null);
  if (options.length < 2) return <Unavailable />;
  return (
    <form
      className="requirement-form"
      onSubmit={(event) => {
        event.preventDefault();
        const selectedOption = String(
          new FormData(event.currentTarget).get("selectedOption") ?? "",
        );
        void submit({ selectedOption }).catch(() => undefined);
      }}
    >
      <p className="field-label">Choose one</p>
      <div className="choice-panel" role="radiogroup" aria-label={requirement.title}>
        {options.map((option) => (
          <ChoiceOption
            key={option}
            type="radio"
            name="selectedOption"
            value={option}
            required
            title={option}
            checked={chosen === option}
            onChange={() => setChosen(option)}
          />
        ))}
      </div>
      <Button kind="primary" icon="arrow" full pending={loading} type="submit" disabled={!chosen}>
        Save my choice
      </Button>
    </form>
  );
}

function MultipleSelectForm({
  requirement,
  submit,
  loading,
  onValidationError,
}: {
  requirement: StudentRequirementDetail;
  submit: SubmitResponse;
  loading: boolean;
  onValidationError: (message: string | null) => void;
}) {
  const options = requirement.inputConfig.options ?? [];
  const maximum = requirement.inputConfig.maximumSelections ?? options.length;
  const [chosen, setChosen] = useState<string[]>([]);
  if (options.length < 2) return <Unavailable />;
  return (
    <form
      className="requirement-form"
      onSubmit={(event) => {
        event.preventDefault();
        const selectedOptions = new FormData(event.currentTarget)
          .getAll("selectedOptions")
          .map(String);
        if (selectedOptions.length === 0 || selectedOptions.length > maximum) {
          onValidationError(`Choose between 1 and ${maximum} options.`);
          return;
        }
        onValidationError(null);
        void submit({ selectedOptions }).catch(() => undefined);
      }}
    >
      <p className="field-label">Choose up to {maximum}</p>
      <div className="choice-panel" role="group" aria-label={requirement.title}>
        {options.map((option) => (
          <ChoiceOption
            key={option}
            type="checkbox"
            name="selectedOptions"
            value={option}
            title={option}
            checked={chosen.includes(option)}
            onChange={(checked) =>
              setChosen((current) =>
                checked
                  ? [...current.filter((value) => value !== option), option]
                  : current.filter((value) => value !== option),
              )
            }
          />
        ))}
      </div>
      <p className="form-help">
        {chosen.length === 0
          ? "Nothing chosen yet."
          : `${chosen.length} of ${maximum} chosen.`}
      </p>
      <Button kind="primary" icon="arrow" full pending={loading} type="submit">
        Save my choices
      </Button>
    </form>
  );
}

function BuiltInSignatureForm({
  submit,
  loading,
}: {
  submit: SubmitResponse;
  loading: boolean;
}) {
  const { tenant } = useTenant();
  const [accepted, setAccepted] = useState(false);
  return (
    <form
      className="requirement-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void submit({
          accepted: true,
          signerName: String(form.get("signerName") ?? "").trim(),
          signatureMethod: String(form.get("signatureMethod")) as "typed" | "drawn",
        }).catch(() => undefined);
      }}
    >
      <FieldShell label="Full legal name" hint="Exactly as it appears on your application.">
        <input name="signerName" required autoComplete="name" />
      </FieldShell>
      <FieldShell label="How you sign">
        <select name="signatureMethod" defaultValue="typed">
          <option value="typed">Typed signature</option>
          <option value="drawn">Drawn signature acknowledgement</option>
        </select>
      </FieldShell>
      <div className="choice-panel tight" role="group" aria-label="Signature confirmation">
        <ChoiceOption
          type="checkbox"
          name="accepted"
          value="true"
          required
          title="I confirm this electronic signature represents me."
          note={`${tenant.shortName} records it with today’s date.`}
          checked={accepted}
          onChange={setAccepted}
        />
      </div>
      <Button kind="primary" icon="pen" full pending={loading} type="submit" disabled={!accepted}>
        Sign and complete
      </Button>
    </form>
  );
}

function SchedulingForm({
  requirementId,
  submit,
  loading,
}: {
  requirementId: string;
  submit: SubmitResponse;
  loading: boolean;
}) {
  const { tenant } = useTenant();
  const appointmentForm = useRef<HTMLFormElement>(null);
  const appointmentKey = useRef<string | null>(null);
  const pendingAppointmentRef = useRef<StudentAppointment | null>(null);
  const [pendingAppointment, setPendingAppointment] =
    useState<StudentAppointment | null>(null);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState<boolean | null>(null);
  const loadAppointments = useCallback(
    (signal: AbortSignal) =>
      getStudentRequirementAppointments(requirementId, signal),
    [requirementId],
  );
  const appointments = useApiResource(loadAppointments);
  const createAppointment = useApiAction(
    useCallback(
      (input: CreateStudentAppointmentInput, key: string) =>
        createStudentRequirementAppointment(requirementId, input, key),
      [requirementId],
    ),
  );
  const scheduleAndAttach = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppointmentError(null);
    setScheduleStatus("loading");
    setScheduleMessage(null);
    let appointment = pendingAppointmentRef.current;
    try {
      if (!appointment) {
        createAppointment.reset();
        const values = new FormData(event.currentTarget);
        const startsAt = new Date(String(values.get("startsAt") ?? ""));
        if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
          setAppointmentError("Choose an appointment time in the future.");
          setScheduleStatus("idle");
          return;
        }
        const notes = String(values.get("notes") ?? "").trim();
        const key = appointmentKey.current ??
          (appointmentKey.current = crypto.randomUUID());
        appointment = await createAppointment.run(
          {
            type: String(values.get("type")) as StudentAppointmentType,
            startsAt: startsAt.toISOString(),
            ...(notes ? { notes } : {}),
          },
          key,
        );
        pendingAppointmentRef.current = appointment;
        setPendingAppointment(appointment);
      }

      await submit({ appointmentId: appointment.id });
      pendingAppointmentRef.current = null;
      setPendingAppointment(null);
      appointmentKey.current = null;
      appointmentForm.current?.reset();
      appointments.refresh();
      setScheduleStatus("success");
    } catch (cause) {
      const pendingAppointment = pendingAppointmentRef.current;
      setScheduleStatus("error");
      setScheduleMessage(
        pendingAppointment
          ? "Your appointment is scheduled, but it could not be attached to this step. Try again to attach the existing appointment."
          : getApiErrorMessage(cause),
      );
    }
  };
  if (appointments.status === "loading") {
    return (
      <Notice tone="working" icon="clock">
        Checking your appointments…
      </Notice>
    );
  }
  if (appointments.status === "error") {
    return (
      <Notice
        tone="urgent"
        icon="alert"
        title="Your appointments could not be loaded"
        action={{ label: "Try again", icon: "refresh", onClick: appointments.reload }}
      >
        {appointments.error}
      </Notice>
    );
  }
  const scheduled = appointments.data.items.filter(
    (appointment: StudentAppointment) => appointment.status === "scheduled",
  );
  const showNew = newOpen ?? scheduled.length === 0;
  return (
    <div className="requirement-form">
      {scheduled.length > 0 ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const appointmentId = String(
              new FormData(event.currentTarget).get("appointmentId") ?? "",
            );
            void submit({ appointmentId }).catch(() => undefined);
          }}
        >
          <FieldShell label="Use an appointment you already have">
            <select name="appointmentId" required defaultValue="">
              <option value="" disabled>Choose an appointment</option>
              {scheduled.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {new Date(appointment.startsAt).toLocaleString()} · {appointment.type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </FieldShell>
          <Button kind="primary" icon="arrow" full pending={loading} type="submit">
            Attach this appointment
          </Button>
        </form>
      ) : (
        <p className="form-help">
          You have no scheduled appointment yet. Choose a time below and{" "}
          {tenant.shortName} holds it for you.
        </p>
      )}

      {scheduled.length > 0 ? (
        <button
          className="skip-link"
          type="button"
          aria-expanded={showNew}
          onClick={() => setNewOpen(!showNew)}
        >
          {showNew ? "Keep an existing appointment instead" : "Schedule a new appointment instead"}
        </button>
      ) : null}

      {showNew ? (
        <form ref={appointmentForm} className="requirement-form" onSubmit={(event) => void scheduleAndAttach(event)}>
          <FieldShell label="What it is about">
            <select name="type" defaultValue="enrollment_support" required>
              <option value="enrollment_support">Enrollment support</option>
              <option value="admissions_counseling">Admissions counseling</option>
              <option value="financial_aid">Financial aid</option>
            </select>
          </FieldShell>
          <FieldShell label="Date and time">
            <input name="startsAt" type="datetime-local" required />
          </FieldShell>
          <FieldShell label="What you would like to discuss" optional>
            <textarea name="notes" rows={3} maxLength={500} />
          </FieldShell>
          {appointmentError ? (
            <p className="field-error" role="alert">
              <Icon name="alert" size={13} /> {appointmentError}
            </p>
          ) : null}
          {scheduleStatus === "error" && scheduleMessage ? (
            <Notice tone="urgent" icon="alert">{scheduleMessage}</Notice>
          ) : scheduleStatus === "success" ? (
            <Notice tone="done" icon="check">Your appointment is scheduled and attached to this step.</Notice>
          ) : null}
          <Button
            kind="primary"
            icon="calendar"
            full
            type="submit"
            disabled={loading}
            pending={scheduleStatus === "loading"}
          >
            {scheduleStatus === "error"
              ? pendingAppointment
                ? "Try attaching again"
                : "Try scheduling again"
              : "Schedule and attach"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function RequirementResponseContent({
  requirement,
  onSubmit,
  loading,
  onValidationError,
}: {
  requirement: StudentRequirementDetail;
  onSubmit: SubmitResponse;
  loading: boolean;
  onValidationError: (message: string | null) => void;
}) {
  switch (requirement.interactionType) {
    case "information":
      return (
        <div className="requirement-form">
          <p className="form-help">Confirm that you have read the information above.</p>
          <Button
            kind="primary"
            icon="check"
            full
            pending={loading}
            onClick={() => void onSubmit({ acknowledged: true }).catch(() => undefined)}
          >
            I have read this
          </Button>
        </div>
      );
    case "approval":
      return (
        <div className="requirement-form">
          <p className="form-help">Review the details above before approving this step.</p>
          <Button
            kind="primary"
            icon="check"
            full
            pending={loading}
            onClick={() => void onSubmit({ approved: true }).catch(() => undefined)}
          >
            Approve and continue
          </Button>
        </div>
      );
    case "form":
    case "selection_flow":
      return (
        <GenericValuesForm
          requirement={requirement}
          submit={onSubmit}
          loading={loading}
          onValidationError={onValidationError}
        />
      );
    case "single_select":
      return (
        <SingleSelectForm
          requirement={requirement}
          submit={onSubmit}
          loading={loading}
        />
      );
    case "multiple_select":
      return (
        <MultipleSelectForm
          requirement={requirement}
          submit={onSubmit}
          loading={loading}
          onValidationError={onValidationError}
        />
      );
    case "signature":
      if (requirement.inputConfig.signatureProvider === "docusign") {
        return (
          <Notice tone="working" icon="pen" title="Signing is not open yet">
            Your institution chose DocuSign for this step, but the live
            connection is not configured. Enrollment Services can offer an
            updated way to sign.
          </Notice>
        );
      }
      return <BuiltInSignatureForm submit={onSubmit} loading={loading} />;
    case "scheduling":
      return (
        <SchedulingForm
          requirementId={requirement.id}
          submit={onSubmit}
          loading={loading}
        />
      );
    default:
      return null;
  }
}

export function RequirementResponseAction({
  requirement,
  onSaved,
}: {
  requirement: StudentRequirementDetail;
  onSaved: () => void;
}) {
  const idempotencyKeyRef = useRef<string | null>(null);
  const submissionInFlightRef = useRef(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const submitAction = useApiAction(
    useCallback(
      (input: SubmitStudentRequirementResponseInput, idempotencyKey: string) =>
        submitStudentRequirementResponse(requirement.id, input, idempotencyKey),
      [requirement.id],
    ),
  );
  const submit: SubmitResponse = async (response) => {
    if (submissionInFlightRef.current) {
      throw new Error("This response is already being submitted.");
    }
    submissionInFlightRef.current = true;
    setValidationError(null);
    const intentKey = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = intentKey;
    try {
      await submitAction.run(
        { expectedVersion: requirement.version, response },
        intentKey,
      );
      idempotencyKeyRef.current = null;
      onSaved();
    } finally {
      submissionInFlightRef.current = false;
    }
  };

  if (["completed", "waived", "not_applicable", "expired"].includes(requirement.status)) {
    return (
      <Notice tone="done" icon="check" title="Your response is recorded">
        Nothing more is needed for this step.
      </Notice>
    );
  }

  if (
    ![
      "information",
      "approval",
      "form",
      "single_select",
      "multiple_select",
      "selection_flow",
      "signature",
      "scheduling",
    ].includes(requirement.interactionType)
  ) {
    return null;
  }

  return (
    <div className="requirement-response" aria-label="Your response">
      <RequirementResponseContent
        requirement={requirement}
        onSubmit={submit}
        loading={submitAction.status === "loading"}
        onValidationError={setValidationError}
      />
      {validationError ? (
        <p className="field-error" role="alert">
          <Icon name="alert" size={13} /> {validationError}
        </p>
      ) : null}
      {submitAction.status === "error" ? (
        <Notice tone="urgent" icon="alert" title="That did not save">
          {submitAction.message}
        </Notice>
      ) : submitAction.status === "success" ? (
        <Notice tone="done" icon="check" title="Recorded">
          Your response is saved and your checklist has been refreshed.
        </Notice>
      ) : null}
    </div>
  );
}
