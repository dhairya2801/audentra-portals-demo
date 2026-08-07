"use client";

import type {
  HousingPreference,
  StaffActionCenter,
  StaffWorkItem,
  StaffWorkItemStatus,
} from "@vv/contracts";
import {
  type DragEventHandler,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  ApiClientError,
  getStaffActionCenter,
  getStaffStudentRecord,
  reviewStaffDocument,
  signInStaff,
  signOutStaff,
  signUpStaff,
  updateStaffStudentPreferences,
  updateStaffWorkItem,
} from "../lib/api-client";
import { TenantLink as Link } from "../components/tenant-link";
import { PortalMark } from "../components/portal-ui";
import { useTenant } from "../components/tenant-provider";
import {
  STAFF_DEMO_EMAIL,
  STAFF_DEMO_PASSWORD,
  staffDemoEnabled,
} from "../lib/demo-staff-transport";

const columns: Array<{
  status: StaffWorkItemStatus;
  title: string;
  description: string;
}> = [
  {
    status: "todo",
    title: "To do",
    description: "Ready for a staff owner",
  },
  {
    status: "in_progress",
    title: "In progress",
    description: "Actively being worked",
  },
  {
    status: "done",
    title: "Done",
    description: "Resolved work",
  },
];

const housingOptions: Array<{ value: HousingPreference; label: string }> = [
  { value: "on_campus", label: "On campus" },
  { value: "off_campus", label: "Off campus" },
  { value: "commuting", label: "Commuting" },
  { value: "family", label: "Living with family" },
  { value: "undecided", label: "Undecided" },
];

type StaffAuthMode = "sign_in" | "sign_up";
type StaffAuthField =
  | "email"
  | "password"
  | "passwordConfirmation"
  | "institutionAccessCode";
type StaffAuthFieldErrors = Partial<Record<StaffAuthField, string>>;

const staffEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const staffAuthErrorMessage = (error: unknown) =>
  error instanceof ApiClientError
    ? error.message
    : "We couldn't access your staff account. Check your connection and try again.";

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function WorkItemCard({
  item,
  selected,
  onSelect,
  draggable = false,
  onDragStart,
  onDragEnd,
}: {
  item: StaffWorkItem;
  selected: boolean;
  onSelect: () => void;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLButtonElement>;
  onDragEnd?: DragEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      className={`staff-work-card${selected ? " staff-work-card--selected" : ""}`}
      type="button"
      data-work-item-key={item.key}
      aria-pressed={selected}
      onClick={onSelect}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <span className="staff-work-card__topline">
        <strong>{item.key}</strong>
        <span className={`staff-priority staff-priority--${item.priority}`}>
          {item.priority}
        </span>
      </span>
      <span className="staff-work-card__title">{item.title}</span>
      <span className="staff-work-card__student">
        {item.student.name} · {item.student.programName}
      </span>
      <span className="staff-work-card__meta">
        <span>{item.component}</span>
        <span>Due {formatDate(item.dueAt)}</span>
      </span>
      <span className="staff-work-card__footer">
        <span>{item.assignee?.name ?? "Unassigned"}</span>
        {item.escalated ? <strong>Escalated</strong> : null}
      </span>
    </button>
  );
}

export function StaffSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const tenantRuntime = useTenant();
  const [mode, setMode] = useState<StaffAuthMode>("sign_in");
  const [fieldErrors, setFieldErrors] = useState<StaffAuthFieldErrors>({});
  const signIn = useApiAction(signInStaff, staffAuthErrorMessage);
  const signUp = useApiAction(signUpStaff, staffAuthErrorMessage);
  const activeAction = mode === "sign_in" ? signIn : signUp;
  const isBusy = signIn.status === "loading" || signUp.status === "loading";

  const chooseMode = (nextMode: StaffAuthMode) => {
    setMode(nextMode);
    setFieldErrors({});
    signIn.reset();
    signUp.reset();
  };

  const enterDemo = async () => {
    try {
      await signIn.run({
        email: STAFF_DEMO_EMAIL,
        password: STAFF_DEMO_PASSWORD,
      });
      onSignedIn();
    } catch {
      // The action exposes an accessible error and remains retryable.
    }
  };

  const enter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(
      form.get("passwordConfirmation") ?? "",
    );
    const institutionAccessCode = String(
      form.get("institutionAccessCode") ?? "",
    );
    const errors = validateStaffAuthFields({
      mode,
      email,
      password,
      passwordConfirmation,
      institutionAccessCode,
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstInvalidField = (
        [
          "email",
          "password",
          "passwordConfirmation",
          "institutionAccessCode",
        ] as const
      ).find((field) => errors[field]);
      if (firstInvalidField) {
        const field = event.currentTarget.elements.namedItem(firstInvalidField);
        if (field instanceof HTMLElement) field.focus();
      }
      return;
    }
    setFieldErrors({});
    try {
      if (mode === "sign_up") {
        await signUp.run({ email, password, institutionAccessCode });
      } else {
        await signIn.run({ email, password });
      }
      onSignedIn();
    } catch {
      // Keep the submitted form available for a corrected retry.
    }
  };

  return (
    <main className="staff-entry">
      <section className="staff-entry__card" aria-labelledby="staff-auth-title">
        <PortalMark />
        <p className="eyebrow">{tenantRuntime.tenant.name}</p>
        <h1 id="staff-auth-title">
          {mode === "sign_up" ? "Create staff account" : "Staff sign in"}
        </h1>
        <p>
          {mode === "sign_up"
            ? "Claim your pre-approved university staff identity and choose your own password."
            : "Sign in to coordinate enrollment work, manage student experiences, and review assigned student decisions."}
        </p>
        <div className="staff-entry__notice">
          <strong>University-approved access</strong>
          <span>
            New accounts require an active staff record and the private
            institution access code supplied by your administrator.
          </span>
        </div>
        <div
          className="auth-mode-switch staff-auth-mode-switch"
          role="tablist"
          aria-label="Staff account access"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sign_in"}
            className={mode === "sign_in" ? "is-active" : undefined}
            onClick={() => chooseMode("sign_in")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sign_up"}
            className={mode === "sign_up" ? "is-active" : undefined}
            onClick={() => chooseMode("sign_up")}
          >
            Create account
          </button>
        </div>
        <form key={mode} className="staff-auth-form" noValidate onSubmit={enter}>
          <label>
            Staff email
            <input
              aria-describedby={fieldErrors.email ? "staff-email-error" : undefined}
              aria-invalid={fieldErrors.email ? true : undefined}
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="you@university.edu"
              onChange={() =>
                setFieldErrors((current) => ({ ...current, email: undefined }))
              }
            />
            {fieldErrors.email ? (
              <small className="field-error" id="staff-email-error" role="alert">
                {fieldErrors.email}
              </small>
            ) : null}
          </label>
          <label>
            Password
            <input
              aria-describedby={
                mode === "sign_up"
                  ? fieldErrors.password
                    ? "staff-password-help staff-password-error"
                    : "staff-password-help"
                  : fieldErrors.password
                    ? "staff-password-error"
                    : undefined
              }
              aria-invalid={fieldErrors.password ? true : undefined}
              name="password"
              type="password"
              autoComplete={mode === "sign_up" ? "new-password" : "current-password"}
              required
              minLength={mode === "sign_up" ? 12 : 1}
              maxLength={128}
              onChange={() =>
                setFieldErrors((current) => ({
                  ...current,
                  password: undefined,
                  passwordConfirmation: undefined,
                }))
              }
            />
            {mode === "sign_up" ? (
              <small id="staff-password-help">
                At least 12 characters, including a letter and number.
              </small>
            ) : null}
            {fieldErrors.password ? (
              <small className="field-error" id="staff-password-error" role="alert">
                {fieldErrors.password}
              </small>
            ) : null}
          </label>
          {mode === "sign_up" ? (
            <>
              <label>
                Confirm password
                <input
                  aria-describedby={
                    fieldErrors.passwordConfirmation
                      ? "staff-password-confirmation-error"
                      : undefined
                  }
                  aria-invalid={
                    fieldErrors.passwordConfirmation ? true : undefined
                  }
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  onChange={() =>
                    setFieldErrors((current) => ({
                      ...current,
                      passwordConfirmation: undefined,
                    }))
                  }
                />
                {fieldErrors.passwordConfirmation ? (
                  <small
                    className="field-error"
                    id="staff-password-confirmation-error"
                    role="alert"
                  >
                    {fieldErrors.passwordConfirmation}
                  </small>
                ) : null}
              </label>
              <label>
                Institution access code
                <input
                  aria-describedby={
                    fieldErrors.institutionAccessCode
                      ? "staff-access-code-help staff-access-code-error"
                      : "staff-access-code-help"
                  }
                  aria-invalid={
                    fieldErrors.institutionAccessCode ? true : undefined
                  }
                  name="institutionAccessCode"
                  type="password"
                  autoComplete="off"
                  required
                  minLength={16}
                  maxLength={256}
                  onChange={() =>
                    setFieldErrors((current) => ({
                      ...current,
                      institutionAccessCode: undefined,
                    }))
                  }
                />
                <small id="staff-access-code-help">
                  This code is provided privately by your university administrator.
                </small>
                {fieldErrors.institutionAccessCode ? (
                  <small
                    className="field-error"
                    id="staff-access-code-error"
                    role="alert"
                  >
                    {fieldErrors.institutionAccessCode}
                  </small>
                ) : null}
              </label>
            </>
          ) : null}
          {activeAction.message ? (
            <p className="field-error" role="alert">
              {activeAction.message}
            </p>
          ) : null}
          <button
            className="button button--primary"
            type="submit"
            disabled={isBusy}
          >
            {activeAction.status === "loading"
              ? mode === "sign_up"
                ? "Creating account..."
                : "Signing in..."
              : mode === "sign_up"
                ? "Create staff account"
                : "Sign in"}
          </button>
        </form>
        {staffDemoEnabled && mode === "sign_in" ? (
          <div className="staff-demo-login">
            <span>or</span>
            <button
              className="button button--secondary"
              type="button"
              disabled={isBusy}
              onClick={() => void enterDemo()}
            >
              <strong>Explore the Audentra demo</strong>
              <small>No backend or account required</small>
            </button>
            <p>
              Creates a browser-only staff session using synthetic institutional data.
            </p>
          </div>
        ) : null}
        <small className="staff-auth-boundary">
          Passwords and access codes are never displayed or prefilled. {staffDemoEnabled
            ? "Demo access is isolated to this browser and can be replaced by the production identity service."
            : "Passwords are stored as one-way hashes and authentication uses an HTTP-only, revocable staff session."}
        </small>
        <Link className="text-link" href="/sign-in">
          Return to student sign in
        </Link>
      </section>
    </main>
  );
}

function validateStaffAuthFields(input: {
  mode: StaffAuthMode;
  email: string;
  password: string;
  passwordConfirmation: string;
  institutionAccessCode: string;
}): StaffAuthFieldErrors {
  const errors: StaffAuthFieldErrors = {};
  if (!input.email) {
    errors.email = "Enter your university staff email address.";
  } else if (!staffEmailPattern.test(input.email.normalize("NFKC"))) {
    errors.email = "Enter a valid university email address.";
  }

  if (input.mode === "sign_up") {
    if (input.password.length < 12 || input.password.length > 128) {
      errors.password = "Use a password between 12 and 128 characters.";
    } else if (
      !/[A-Za-z]/.test(input.password) ||
      !/[0-9]/.test(input.password)
    ) {
      errors.password = "Include at least one letter and one number.";
    }
    if (!input.passwordConfirmation) {
      errors.passwordConfirmation = "Enter your password again.";
    } else if (input.passwordConfirmation !== input.password) {
      errors.passwordConfirmation = "The passwords do not match.";
    }
    if (input.institutionAccessCode.length < 16) {
      errors.institutionAccessCode = "Enter the institution access code you received.";
    }
  } else if (!input.password) {
    errors.password = "Enter your password.";
  }
  return errors;
}

export function StudentInspector({
  item,
  center,
  onBoardChanged,
}: {
  item: StaffWorkItem;
  center: StaffActionCenter;
  onBoardChanged: () => void;
}) {
  const loadStudent = useCallback(
    (signal: AbortSignal) =>
      getStaffStudentRecord(item.student.id, signal),
    [item.student.id],
  );
  const student = useApiResource(loadStudent);
  const updateItem = useApiAction(updateStaffWorkItem);
  const updatePreferences = useApiAction(updateStaffStudentPreferences);
  const decideDocument = useApiAction(reviewStaffDocument);
  const [note, setNote] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [notifyStudent, setNotifyStudent] = useState(true);

  const mutateWorkItem = async (input: {
    status?: StaffWorkItemStatus;
    assigneeId?: string | null;
    escalated?: boolean;
    note?: string;
  }) => {
    try {
      await updateItem.run(item.id, {
        expectedVersion: item.version,
        ...input,
      });
      setNote("");
      onBoardChanged();
    } catch {
      onBoardChanged();
    }
  };

  const savePreferences = async (event: FormEvent) => {
    event.preventDefault();
    if (student.status !== "ready") return;
    const form = new FormData(event.currentTarget as HTMLFormElement);
    try {
      await updatePreferences.run(item.student.id, {
        expectedOnboardingVersion: student.data.onboarding.version,
        expectedProfileVersion: student.data.profile.version,
        communicationPreference: form.get("communicationPreference") as
          | "email"
          | "sms",
        housingPreference: form.get("housingPreference") as HousingPreference,
        accommodationInterest: form.get("accommodationInterest") as
          | "not_now"
          | "housing"
          | "academic"
          | "both",
        residencyVerificationPath: form.get("residencyVerificationPath") as
          | "home_address_review"
          | "document_upload"
          | "advisor_review",
        notifyStudent,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setNote("");
      student.refresh();
      onBoardChanged();
    } catch {
      student.refresh();
      onBoardChanged();
    }
  };

  const decide = async (
    documentId: string,
    documentWorkItem: StaffWorkItem,
    decision: "accepted" | "rejected",
  ) => {
    if (!reviewNote.trim()) return;
    try {
      await decideDocument.run(documentId, {
        workItemId: documentWorkItem.id,
        expectedWorkItemVersion: documentWorkItem.version,
        decision,
        note: reviewNote.trim(),
        notifyStudent,
      });
      setReviewNote("");
      student.refresh();
      onBoardChanged();
    } catch {
      student.refresh();
      onBoardChanged();
    }
  };

  return (
    <aside className="staff-inspector" aria-label="Selected work item">
      <header className="staff-inspector__header">
        <div>
          <span>{item.key}</span>
          <h2>{item.title}</h2>
        </div>
        <span className={`staff-priority staff-priority--${item.priority}`}>
          {item.priority}
        </span>
      </header>
      <p>{item.description}</p>

      <section className="staff-inspector__section">
        <h3>Work item</h3>
        <label>
          Status
          <select
            value={item.status}
            disabled={updateItem.status === "loading"}
            onChange={(event) =>
              void mutateWorkItem({
                status: event.target.value as StaffWorkItemStatus,
              })
            }
          >
            {columns.map((column) => (
              <option value={column.status} key={column.status}>
                {column.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assignee
          <select
            value={item.assignee?.id ?? ""}
            disabled={updateItem.status === "loading"}
            onChange={(event) =>
              void mutateWorkItem({
                assigneeId: event.target.value || null,
              })
            }
          >
            <option value="">Unassigned</option>
            {center.staff.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name} · {member.component}
              </option>
            ))}
          </select>
        </label>
        <label className="staff-checkbox">
          <input
            type="checkbox"
            checked={item.escalated}
            disabled={updateItem.status === "loading"}
            onChange={(event) =>
              void mutateWorkItem({ escalated: event.target.checked })
            }
          />
          Escalation flag
        </label>
      </section>

      {student.status === "loading" ? (
        <p className="staff-inline-state">Loading the shared student record…</p>
      ) : student.status === "error" ? (
        <div className="staff-inline-state" role="alert">
          <p>{student.error}</p>
          <button type="button" onClick={student.reload}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <section className="staff-student-summary">
            <div>
              <span>{student.data.student.preferredName.slice(0, 1)}</span>
              <div>
                <h3>{student.data.student.name}</h3>
                <p>
                  {student.data.student.programName} · Class of{" "}
                  {student.data.student.classYear}
                </p>
              </div>
            </div>
            <dl>
              <div>
                <dt>Onboarding</dt>
                <dd>{student.data.onboarding.status.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Requirements</dt>
                <dd>{student.data.requirements.total}</dd>
              </div>
              <div>
                <dt>Documents</dt>
                <dd>{student.data.documents.total}</dd>
              </div>
            </dl>
            {student.data.syntheticTestRecord ? (
              <small>Test-seed operations record</small>
            ) : (
              <Link href="/enrollment">Open student view</Link>
            )}
          </section>

          {student.data.syntheticTestRecord ? (
            <section className="staff-inspector__section staff-seed-boundary">
              <h3>Deterministic test student</h3>
              <p>
                This record exists to exercise assignment, prioritization, and
                task workflows at cohort scale. Student profile mutations are
                intentionally disabled for seeded test identities.
              </p>
            </section>
          ) : (
          <form
            className="staff-inspector__section staff-preferences"
            onSubmit={savePreferences}
          >
            <div className="staff-section-heading">
              <div>
                <h3>Operational preferences</h3>
                <p>
                  Shared with the student enrollment page. Signed consent and
                  legal identity fields remain read-only.
                </p>
              </div>
              <span>v{student.data.onboarding.version}</span>
            </div>
            <div className="staff-form-grid">
              <label>
                Communication
                <select
                  name="communicationPreference"
                  defaultValue={student.data.profile.communicationPreference}
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </label>
              <label>
                Housing
                <select
                  name="housingPreference"
                  defaultValue={
                    student.data.onboarding.data.housingPreference ??
                    "undecided"
                  }
                >
                  {housingOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Accommodation follow-up
                <select
                  name="accommodationInterest"
                  defaultValue={
                    student.data.onboarding.data.accommodationInterest ??
                    "not_now"
                  }
                >
                  <option value="not_now">No follow-up</option>
                  <option value="housing">Housing</option>
                  <option value="academic">Academic</option>
                  <option value="both">Housing and academic</option>
                </select>
              </label>
              <label>
                Residency review
                <select
                  name="residencyVerificationPath"
                  defaultValue={
                    student.data.onboarding.data.residencyVerificationPath ??
                    "home_address_review"
                  }
                >
                  <option value="home_address_review">Address review</option>
                  <option value="document_upload">Document upload</option>
                  <option value="advisor_review">Advisor review</option>
                </select>
              </label>
            </div>
            <label>
              Staff note
              <textarea
                value={note}
                maxLength={500}
                placeholder="Optional audit note or student-facing explanation"
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <label className="staff-checkbox">
              <input
                type="checkbox"
                checked={notifyStudent}
                onChange={(event) => setNotifyStudent(event.target.checked)}
              />
              Send an inbox notification to the student
            </label>
            {updatePreferences.message ? (
              <p className="field-error" role="alert">
                {updatePreferences.message}
              </p>
            ) : null}
            <button
              className="button button--primary"
              type="submit"
              disabled={updatePreferences.status === "loading"}
            >
              {updatePreferences.status === "loading"
                ? "Saving shared record…"
                : "Save student preferences"}
            </button>
          </form>
          )}

          <section className="staff-inspector__section">
            <div className="staff-section-heading">
              <div>
                <h3>Document review</h3>
                <p>Official decisions update the checklist atomically.</p>
              </div>
              <span>{student.data.documents.total}</span>
            </div>
            {student.data.documents.items.length === 0 ? (
              <p className="staff-empty-copy">
                No student documents are waiting in this preview.
              </p>
            ) : (
              <>
                <label>
                  Decision note
                  <textarea
                    value={reviewNote}
                    maxLength={500}
                    placeholder="Required for acceptance or requested changes"
                    onChange={(event) => setReviewNote(event.target.value)}
                  />
                </label>
                <div className="staff-document-list">
                  {student.data.documents.items.map((document) => {
                    const documentWorkItem = center.items.find(
                      (candidate) =>
                        candidate.source?.type === "document" &&
                        candidate.source.id === document.id,
                    );
                    const reviewable =
                      documentWorkItem &&
                      ["needs_review", "under_review"].includes(document.status);
                    return (
                      <article key={document.id}>
                        <div>
                          <strong>{document.fileName}</strong>
                          <span>
                            {document.category.replaceAll("_", " ")} ·{" "}
                            {document.status.replaceAll("_", " ")}
                          </span>
                        </div>
                        {reviewable ? (
                          <div>
                            <button
                              type="button"
                              disabled={
                                !reviewNote.trim() ||
                                decideDocument.status === "loading"
                              }
                              onClick={() =>
                                void decide(
                                  document.id,
                                  documentWorkItem,
                                  "accepted",
                                )
                              }
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              disabled={
                                !reviewNote.trim() ||
                                decideDocument.status === "loading"
                              }
                              onClick={() =>
                                void decide(
                                  document.id,
                                  documentWorkItem,
                                  "rejected",
                                )
                              }
                            >
                              Request changes
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </>
            )}
            {decideDocument.message ? (
              <p className="field-error" role="alert">
                {decideDocument.message}
              </p>
            ) : null}
          </section>
        </>
      )}

      <section className="staff-inspector__section">
        <h3>Activity</h3>
        <ol className="staff-history">
          {item.history.map((entry) => (
            <li key={entry.id}>
              <span aria-hidden="true" />
              <div>
                <strong>{entry.actorName}</strong>
                <p>{entry.message}</p>
                <time dateTime={entry.occurredAt}>
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "UTC",
                  }).format(new Date(entry.occurredAt))}{" "}
                  UTC
                </time>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

function StaffWorkspace({
  center,
  refresh,
}: {
  center: StaffActionCenter;
  refresh: () => void;
}) {
  const tenantRuntime = useTenant();
  const [selectedId, setSelectedId] = useState(
    () => center.items[0]?.id ?? null,
  );
  const [query, setQuery] = useState("");
  const [component, setComponent] = useState("all");
  const selected =
    center.items.find((item) => item.id === selectedId) ??
    center.items[0] ??
    null;
  const components = useMemo(
    () => Array.from(new Set(center.items.map((item) => item.component))).sort(),
    [center.items],
  );
  const filtered = center.items.filter((item) => {
    const search = query.trim().toLowerCase();
    return (
      (component === "all" || item.component === component) &&
      (!search ||
        `${item.key} ${item.title} ${item.student.name} ${item.component}`
          .toLowerCase()
          .includes(search))
    );
  });

  const signOut = async () => {
    await signOutStaff();
    window.location.reload();
  };

  return (
    <div className="staff-shell">
      <header className="staff-topbar">
        <div className="staff-brand">
          <PortalMark />
          <div>
            <strong>{tenantRuntime.tenant.shortName} University</strong>
            <span>Enrollment operations</span>
          </div>
        </div>
        <div className="staff-topbar__actions">
          <span>
            Synced{" "}
            {new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            }).format(new Date(center.generatedAt))}
          </span>
          <button type="button" onClick={refresh}>
            Refresh
          </button>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <aside className="staff-sidebar">
        <p>Staff workspace</p>
        <nav aria-label="Staff workspace">
          <a className="staff-sidebar__active" href="#action-center">
            <span aria-hidden="true">◆</span>
            Action center
          </a>
          <a href="#student-record">
            <span aria-hidden="true">○</span>
            Student record
          </a>
          <a href="#documents">
            <span aria-hidden="true">□</span>
            Documents
          </a>
          <a href="#activity">
            <span aria-hidden="true">↻</span>
            Activity
          </a>
        </nav>
        <div className="staff-sidebar__note">
          <strong>Shared state V1</strong>
          <p>
            The board refreshes every five seconds. Writes use record versions
            to prevent lost updates.
          </p>
        </div>
      </aside>
      <main className="staff-main" id="action-center">
        <header className="staff-page-heading">
          <div>
            <p className="eyebrow">Enrollment action center</p>
            <h1>Who needs attention today?</h1>
            <p>
              Coordinate student work, make official review decisions, and
              keep every staff view on the same server-owned record.
            </p>
          </div>
          <Link className="button button--secondary" href="/dashboard">
            Open student portal
          </Link>
        </header>

        <section className="staff-kpis" aria-label="Action center totals">
          <article>
            <span>Open work</span>
            <strong>{center.counts.todo + center.counts.inProgress}</strong>
            <small>{center.counts.inProgress} actively in progress</small>
          </article>
          <article>
            <span>Urgent</span>
            <strong>{center.counts.urgent}</strong>
            <small>Highest-priority queue</small>
          </article>
          <article>
            <span>Escalated</span>
            <strong>{center.counts.escalated}</strong>
            <small>Status flag, not a separate task type</small>
          </article>
          <article>
            <span>Resolved</span>
            <strong>{center.counts.done}</strong>
            <small>Available in work history</small>
          </article>
        </section>

        <section className="staff-filters" aria-label="Action center filters">
          <label>
            <span className="sr-only">Search work items</span>
            <input
              type="search"
              value={query}
              placeholder="Search student, task, or key"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Filter by component</span>
            <select
              value={component}
              onChange={(event) => setComponent(event.target.value)}
            >
              <option value="all">All components</option>
              {components.map((value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <span aria-live="polite">{filtered.length} matching work items</span>
        </section>

        <div className="staff-workspace">
          <div className="staff-board" aria-label="Enrollment work board">
            {columns.map((column) => {
              const items = filtered.filter(
                (item) => item.status === column.status,
              );
              return (
                <section className="staff-board-column" key={column.status}>
                  <header>
                    <div>
                      <h2>{column.title}</h2>
                      <p>{column.description}</p>
                    </div>
                    <span>{items.length}</span>
                  </header>
                  <div>
                    {items.map((item) => (
                      <WorkItemCard
                        item={item}
                        selected={selected?.id === item.id}
                        onSelect={() => setSelectedId(item.id)}
                        key={item.id}
                      />
                    ))}
                    {items.length === 0 ? (
                      <p className="staff-column-empty">No work here.</p>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
          {selected ? (
            <StudentInspector
              item={selected}
              center={center}
              onBoardChanged={refresh}
              key={selected.id}
            />
          ) : (
            <aside className="staff-inspector staff-inspector--empty">
              <h2>No work items</h2>
              <p>New enrollment and document-review work will appear here.</p>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LegacyStaffActionCenter() {
  const loadCenter = useCallback(
    (signal: AbortSignal) => getStaffActionCenter(signal),
    [],
  );
  const center = useApiResource(loadCenter, {
    refreshOnAmbient: false,
  });
  const refresh = center.refresh;

  useEffect(() => {
    if (center.status !== "ready") return;
    const interval = window.setInterval(refresh, 5_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [center.status, refresh]);

  if (
    center.status === "error" &&
    (center.errorStatus === 401 || center.errorStatus === 403)
  ) {
    return <StaffSignIn onSignedIn={center.reload} />;
  }
  if (center.status === "loading") {
    return (
      <main className="staff-entry">
        <section className="staff-entry__card" aria-live="polite">
          <PortalMark />
          <p className="eyebrow">Staff workspace</p>
          <h1>Opening the action center</h1>
          <p>Loading the latest shared enrollment work…</p>
          <span className="loader" aria-hidden="true" />
        </section>
      </main>
    );
  }
  if (center.status === "error") {
    return (
      <main className="staff-entry">
        <section className="staff-entry__card" role="alert">
          <PortalMark />
          <h1>The staff workspace could not load</h1>
          <p>{center.error}</p>
          <button
            className="button button--primary"
            type="button"
            onClick={center.reload}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }
  return <StaffWorkspace center={center.data} refresh={center.refresh} />;
}
