"use client";

import type {
  StudentAppointment,
  StudentRequirementFormDefinition,
  StudentRequirementDetail,
  StudentRequirementInputField,
  StudentRequirementResponsePayload,
  StudentRequirementResponseValue,
  SubmitStudentRequirementResponseInput,
} from "@vv/contracts";
import {
  type FormEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { getStudentAppointments, submitStudentRequirementResponse } from "../lib/api-client";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import { TenantLink as Link } from "./tenant-link";
import { ActionFeedback } from "./portal-ui";
import { visibleConfiguredFields } from "./requirement-response-model";

type SubmitResponse = (payload: StudentRequirementResponsePayload) => Promise<void>;

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
      <label className="requirement-response__checkbox">
        <input name={field.id} type="checkbox" required={field.required} defaultChecked={currentValue === true} />
        {field.title}
      </label>
    );
  }
  if (field.field_type === "single_select") {
    return (
      <label>
        {field.title}
        <select name={field.id} required={field.required} defaultValue={typeof currentValue === "string" ? currentValue : ""}>
          <option value="" disabled>
            Select an option
          </option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.field_type === "multiple_select") {
    return (
      <label>
        {field.title}
        <select name={field.id} required={field.required} multiple defaultValue={Array.isArray(currentValue) ? currentValue.map(String) : []}>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {field.maximum_selections ? (
          <small>Select up to {field.maximum_selections}.</small>
        ) : null}
      </label>
    );
  }
  return (
    <label>
      {field.title}
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
    </label>
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
      <div>
        <p>No additional information is required for this step.</p>
        <button
          className="button button--primary"
          type="button"
          disabled={loading}
          onClick={() => void submit({ values: {} })}
        >
          {loading ? "Submitting..." : "Complete step"}
        </button>
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
  return (
    <form
      className="requirement-response__multipage-form"
      onChange={(event) =>
        setCurrentValues(valuesForPage(new FormData(event.currentTarget), false))
      }
      onSubmit={(event) => void onSubmit(event)}
    >
      {form.pages.length > 1 ? (
        <div className="requirement-response__page-progress" aria-label={`Step ${pageIndex + 1} of ${form.pages.length}`}>
          <span>Step {pageIndex + 1} of {form.pages.length}</span>
          <div>{form.pages.map((candidate, index) => <i className={index <= pageIndex ? "is-complete" : undefined} key={candidate.id} />)}</div>
        </div>
      ) : null}
      <header className="requirement-response__page-heading">
        <h3>{page?.title}</h3>
        {page?.description ? <p>{page.description}</p> : null}
      </header>
      {visibleFields.map((field) => (
        <ConfiguredField key={field.id} field={field} currentValue={currentValues[field.id]} />
      ))}
      <div className="requirement-response__page-actions">
        {pageIndex > 0 ? <button className="button button--secondary" type="button" disabled={loading} onClick={() => setPageIndex((current) => current - 1)}>Back</button> : null}
        <button className="button button--primary" type="submit" disabled={loading}>
          {loading ? "Submitting..." : pageIndex === form.pages.length - 1 ? "Submit response" : "Continue"}
        </button>
      </div>
    </form>
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
  if (options.length < 2) {
    return (
      <div className="requirement-next-action" role="status">
        <span aria-hidden="true">i</span>
        <div>
          <strong>This choice is temporarily unavailable.</strong>
          <p>The university is updating it. You do not need to take action yet.</p>
        </div>
      </div>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const selectedOption = String(
          new FormData(event.currentTarget).get("selectedOption") ?? "",
        );
        void submit({ selectedOption });
      }}
    >
      <fieldset>
        <legend>Choose one option</legend>
        {options.map((option) => (
          <label key={option} className="requirement-response__choice">
            <input name="selectedOption" type="radio" value={option} required />
            {option}
          </label>
        ))}
      </fieldset>
      <button className="button button--primary" type="submit" disabled={loading}>
        {loading ? "Submitting..." : "Save selection"}
      </button>
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
  if (options.length < 2) {
    return (
      <div className="requirement-next-action" role="status">
        <span aria-hidden="true">i</span>
        <div>
          <strong>This choice is temporarily unavailable.</strong>
          <p>The university is updating it. You do not need to take action yet.</p>
        </div>
      </div>
    );
  }
  return (
    <form
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
        void submit({ selectedOptions });
      }}
    >
      <fieldset>
        <legend>Choose up to {maximum}</legend>
        {options.map((option) => (
          <label key={option} className="requirement-response__choice">
            <input name="selectedOptions" type="checkbox" value={option} />
            {option}
          </label>
        ))}
      </fieldset>
      <button className="button button--primary" type="submit" disabled={loading}>
        {loading ? "Submitting..." : "Save selections"}
      </button>
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
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void submit({
          accepted: true,
          signerName: String(form.get("signerName") ?? "").trim(),
          signatureMethod: String(form.get("signatureMethod")) as "typed" | "drawn",
        });
      }}
    >
      <label>
        Full legal name
        <input name="signerName" required autoComplete="name" />
      </label>
      <label>
        Signature method
        <select name="signatureMethod" defaultValue="typed">
          <option value="typed">Typed signature</option>
          <option value="drawn">Drawn signature acknowledgement</option>
        </select>
      </label>
      <label className="requirement-response__checkbox">
        <input name="accepted" type="checkbox" required />
        I confirm this electronic signature represents me.
      </label>
      <button className="button button--primary" type="submit" disabled={loading}>
        {loading ? "Signing..." : "Sign and complete"}
      </button>
    </form>
  );
}

function SchedulingForm({
  submit,
  loading,
}: {
  submit: SubmitResponse;
  loading: boolean;
}) {
  const loadAppointments = useCallback(
    (signal: AbortSignal) => getStudentAppointments(signal),
    [],
  );
  const appointments = useApiResource(loadAppointments);
  if (appointments.status === "loading") return <p>Loading your appointments...</p>;
  if (appointments.status === "error") {
    return (
      <div>
        <p role="alert">{appointments.error}</p>
        <button className="button button--secondary" type="button" onClick={appointments.reload}>
          Try again
        </button>
      </div>
    );
  }
  const scheduled = appointments.data.items.filter(
    (appointment: StudentAppointment) => appointment.status === "scheduled",
  );
  if (scheduled.length === 0) {
    return (
      <div>
        <p>Schedule an appointment first, then return here to attach it.</p>
        <Link className="button button--secondary" href="/appointments">
          Open appointments
        </Link>
      </div>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const appointmentId = String(
          new FormData(event.currentTarget).get("appointmentId") ?? "",
        );
        void submit({ appointmentId });
      }}
    >
      <label>
        Scheduled appointment
        <select name="appointmentId" required defaultValue="">
          <option value="" disabled>
            Choose an appointment
          </option>
          {scheduled.map((appointment) => (
            <option key={appointment.id} value={appointment.id}>
              {new Date(appointment.startsAt).toLocaleString()} · {appointment.type.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <button className="button button--primary" type="submit" disabled={loading}>
        {loading ? "Submitting..." : "Attach appointment"}
      </button>
    </form>
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
        <div>
          <p>Confirm that you have read this information.</p>
          <button
            className="button button--primary"
            type="button"
            disabled={loading}
            onClick={() => void onSubmit({ acknowledged: true })}
          >
            {loading ? "Recording..." : "Mark as read"}
          </button>
        </div>
      );
    case "approval":
      return (
        <div>
          <p>Review the details above before approving this step.</p>
          <button
            className="button button--primary"
            type="button"
            disabled={loading}
            onClick={() => void onSubmit({ approved: true })}
          >
            {loading ? "Approving..." : "Approve and continue"}
          </button>
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
          <div>
            <p>
              Your institution selected DocuSign for this step, but the live
              connection is not configured yet.
            </p>
            <Link className="button button--secondary" href="/help">
              Get enrollment help
            </Link>
          </div>
        );
      }
      return <BuiltInSignatureForm submit={onSubmit} loading={loading} />;
    case "scheduling":
      return <SchedulingForm submit={onSubmit} loading={loading} />;
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
    if (submissionInFlightRef.current) return;
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
    } catch {
      // Keep the key stable so a retry cannot create a duplicate response.
    } finally {
      submissionInFlightRef.current = false;
    }
  };

  if (["completed", "waived", "not_applicable", "expired"].includes(requirement.status)) {
    return (
      <div className="requirement-next-action" role="status">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>This response is recorded.</strong>
          <p>No further action is required for this step.</p>
        </div>
      </div>
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
    <section className="requirement-response-card" aria-label="Requirement response">
      <RequirementResponseContent
        requirement={requirement}
        onSubmit={submit}
        loading={submitAction.status === "loading"}
        onValidationError={setValidationError}
      />
      {validationError ? (
        <p className="field-error" role="alert">
          {validationError}
        </p>
      ) : null}
      <ActionFeedback
        status={submitAction.status}
        error={submitAction.message}
        success="Your response is recorded and your enrollment checklist has been refreshed."
      />
    </section>
  );
}
