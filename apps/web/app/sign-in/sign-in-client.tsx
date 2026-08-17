"use client";

import {
  type FormEvent,
  useCallback,
  useState,
} from "react";
import Image from "next/image";
import { useApiAction } from "../hooks/use-api-resource";
import {
  ApiClientError,
  getStudentBootstrap,
  signInDemoStudent,
  signInStudent,
  signUpStudent,
} from "../lib/api-client";
import {
  demoStudentLoginEnabled,
  normalizeStudentReference,
  validateStudentReference,
} from "../lib/demo-student-login";
import { ActionFeedback, PortalMark } from "../components/portal-ui";
import { TenantLink as Link } from "../components/tenant-link";
import { useTenant } from "../components/tenant-provider";

type AuthMode = "sign_in" | "sign_up";
type AuthField = "email" | "phone" | "password" | "passwordConfirmation";
type AuthFieldErrors = Partial<Record<AuthField, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phonePattern = /^\+[1-9][0-9]{7,14}$/;
const signInErrorMessage = (error: unknown) =>
  error instanceof ApiClientError
    ? error.message
    : "We couldn’t sign you in. Check your connection and try again.";

export function SignInClient() {
  const tenantRuntime = useTenant();
  const { tenant } = tenantRuntime;
  const support = tenant.contacts.support;
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const signInAction = useCallback(
    async (input: { email: string; password: string }) => {
      await signInStudent(input);
      return getStudentBootstrap();
    },
    [],
  );
  const signUpAction = useCallback(
    (input: { email: string; phone: string; password: string }) =>
      signUpStudent(input),
    [],
  );
  const signIn = useApiAction(signInAction, signInErrorMessage);
  const signUp = useApiAction(signUpAction);
  const activeAction = mode === "sign_in" ? signIn : signUp;
  const isBusy = signIn.status === "loading" || signUp.status === "loading";

  const chooseMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setFieldErrors({});
    signIn.reset();
    signUp.reset();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const phone = String(values.get("phone") ?? "").trim();
    const password = String(values.get("password") ?? "");
    const passwordConfirmation = String(
      values.get("passwordConfirmation") ?? "",
    );
    const errors = validateAuthFields({
      mode,
      email,
      phone,
      password,
      passwordConfirmation,
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstInvalidField = (
        ["email", "phone", "password", "passwordConfirmation"] as const
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
        await signUp.run({
          email,
          phone,
          password,
        });
        window.location.assign(tenantRuntime.href("/onboarding"));
        return;
      }
      const bootstrap = await signIn.run({ email, password });
      window.location.assign(tenantRuntime.href(bootstrap.initialRoute));
    } catch {
      // Keep the submitted form available for a corrected retry.
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="sign-in-title">
        <Link className="brand" href="/sign-in" aria-label={`${tenant.name} sign in`}>
          <PortalMark />
          <span>
            <strong>{tenant.shortName}</strong>
            <small>University</small>
          </span>
        </Link>
        <div className="auth-panel__copy">
          <p className="eyebrow">Student portal</p>
          <h1 id="sign-in-title">
            {mode === "sign_up"
              ? "Create your student account."
              : "Welcome back."}
          </h1>
          <p>
            {mode === "sign_up"
              ? "Start with secure contact credentials. Your name, program details, and supporting records are collected during onboarding."
              : "Sign in to continue onboarding or return to your student dashboard."}
          </p>
        </div>

        <div className="auth-mode-switch" role="tablist" aria-label="Account access">
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

        <form className="auth-form" noValidate onSubmit={submit}>
          <label className="field">
            <span>Email address</span>
            <input
              aria-describedby={
                fieldErrors.email ? "auth-email-error" : undefined
              }
              aria-invalid={fieldErrors.email ? true : undefined}
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              onChange={() =>
                setFieldErrors((current) => ({
                  ...current,
                  email: undefined,
                }))
              }
              placeholder="you@example.com"
            />
            {fieldErrors.email ? (
              <small className="field-error" id="auth-email-error" role="alert">
                {fieldErrors.email}
              </small>
            ) : null}
          </label>
          {mode === "sign_up" ? (
            <label className="field">
              <span>Mobile phone</span>
              <input
                aria-describedby={
                  fieldErrors.phone
                    ? "auth-phone-help auth-phone-error"
                    : "auth-phone-help"
                }
                aria-invalid={fieldErrors.phone ? true : undefined}
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                maxLength={32}
                onChange={() =>
                  setFieldErrors((current) => ({
                    ...current,
                    phone: undefined,
                  }))
                }
                placeholder="+1 555 123 4567"
              />
              <small id="auth-phone-help">
                Include your country code. Verification will be enabled later.
              </small>
              {fieldErrors.phone ? (
                <small
                  className="field-error"
                  id="auth-phone-error"
                  role="alert"
                >
                  {fieldErrors.phone}
                </small>
              ) : null}
            </label>
          ) : null}
          <label className="field">
            <span>Password</span>
            <input
              aria-describedby={
                mode === "sign_up"
                  ? fieldErrors.password
                    ? "auth-password-help auth-password-error"
                    : "auth-password-help"
                  : fieldErrors.password
                    ? "auth-password-error"
                    : undefined
              }
              aria-invalid={fieldErrors.password ? true : undefined}
              name="password"
              type="password"
              autoComplete={
                mode === "sign_up" ? "new-password" : "current-password"
              }
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
              <small id="auth-password-help">
                At least 12 characters, including a letter and number.
              </small>
            ) : null}
            {fieldErrors.password ? (
              <small
                className="field-error"
                id="auth-password-error"
                role="alert"
              >
                {fieldErrors.password}
              </small>
            ) : null}
          </label>
          {mode === "sign_up" ? (
            <label className="field">
              <span>Confirm password</span>
              <input
                aria-describedby={
                  fieldErrors.passwordConfirmation
                    ? "auth-password-confirmation-error"
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
                  id="auth-password-confirmation-error"
                  role="alert"
                >
                  {fieldErrors.passwordConfirmation}
                </small>
              ) : null}
            </label>
          ) : null}
          <button
            className="button button--primary auth-button"
            type="submit"
            disabled={isBusy}
          >
            {activeAction.status === "loading"
              ? mode === "sign_up"
                ? "Creating account…"
                : "Signing in…"
              : mode === "sign_up"
                ? "Create account and start onboarding"
                : "Sign in"}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <ActionFeedback
          status={activeAction.status}
          error={activeAction.message}
          success={
            mode === "sign_up"
              ? "Account created. Opening onboarding…"
              : "Signed in. Opening your portal…"
          }
        />
        <div className="auth-security-note">
          <strong>Account verification</strong>
          <p>
            Email and SMS verification statuses are already tracked. Delivery
            will be connected when those providers are configured.
          </p>
        </div>
        {support.email || support.url ? (
          <p className="auth-support">
            Trouble signing in?{" "}
            <a
              href={
                support.url
                  ? tenantRuntime.href(support.url)
                  : `mailto:${support.email}`
              }
            >
              Contact {support.label.toLowerCase()}
            </a>
          </p>
        ) : null}
        <DemoStudentSignIn />
      </section>
      <aside className="auth-story" aria-label={`${tenant.name} student experience`}>
        {tenant.branding.heroImageUrl ? (
          <Image
            className="auth-story__image"
            src={tenant.branding.heroImageUrl}
            alt={tenant.branding.heroImageAlt || ""}
            height={1200}
            unoptimized
            width={900}
          />
        ) : null}
        <div>
          <span className="auth-story__index">
            {tenant.academicContext.currentTermLabel || "Student portal"}
          </span>
          <blockquote>
            “Your next step starts here.”
          </blockquote>
          <p>{tenant.academicContext.defaultCampusName || tenant.name}</p>
        </div>
      </aside>
    </main>
  );
}

/**
 * "Log in as demo student" — a developer affordance, not a product feature.
 *
 * The demo campus has thousands of students in genuinely different states, so
 * the useful question is "show me *this* student", not "show me a student".
 * Signing in reads their stored state and changes nothing about it, which is
 * what makes the demo usable for stateful testing: pay a deposit, sign out,
 * sign back in, and the deposit is still paid.
 *
 * Rendered only when the flag allows it, and backed by a platform route that
 * 404s outside development and preview. The gate below is convenience; the
 * one that matters is server-side.
 */
function DemoStudentSignIn() {
  const tenantRuntime = useTenant();
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const demoSignIn = useApiAction(
    async (studentRef: string) => {
      const session = await signInDemoStudent({ studentRef });
      setResolvedName(session.student.preferredName);
      return getStudentBootstrap();
    },
    (error) =>
      error instanceof ApiClientError
        ? error.message
        : "We couldn’t open that student. Check the ID and try again.",
  );

  const enabled = demoStudentLoginEnabled({
    NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED:
      process.env.NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED,
    NODE_ENV: process.env.NODE_ENV,
  });
  if (!enabled) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get("studentRef") ?? "");
    const invalid = validateStudentReference(raw);
    setFieldError(invalid);
    if (invalid) return;
    setResolvedName(null);
    try {
      const bootstrap = await demoSignIn.run(normalizeStudentReference(raw));
      window.location.assign(tenantRuntime.href(bootstrap.initialRoute));
    } catch {
      // The typed id stays in the field so it can be corrected.
    }
  };

  return (
    <section className="auth-demo-student" aria-labelledby="demo-student-title">
      <p className="eyebrow">Development only</p>
      <h2 id="demo-student-title">Log in as demo student</h2>
      <p>
        Open any student in this university’s demo population by ID. Their
        saved progress is shown as-is; signing in never resets it.
      </p>
      <form className="auth-demo-student__form" noValidate onSubmit={submit}>
        <label className="field">
          <span>Student ID</span>
          <input
            aria-describedby={
              fieldError ? "demo-student-help demo-student-error" : "demo-student-help"
            }
            aria-invalid={fieldError ? true : undefined}
            name="studentRef"
            type="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
            onChange={() => setFieldError(null)}
            placeholder="SYN-000042"
          />
          <small id="demo-student-help">
            The institution reference or the student’s UUID.
          </small>
          {fieldError ? (
            <small className="field-error" id="demo-student-error" role="alert">
              {fieldError}
            </small>
          ) : null}
        </label>
        <button
          className="button button--secondary"
          type="submit"
          disabled={demoSignIn.status === "loading"}
        >
          {demoSignIn.status === "loading" ? "Opening…" : "Continue"}
        </button>
      </form>
      <ActionFeedback
        status={demoSignIn.status}
        error={demoSignIn.message}
        success={
          resolvedName
            ? `Opening ${resolvedName}’s portal…`
            : "Opening the student’s portal…"
        }
      />
    </section>
  );
}

function validateAuthFields(input: {
  mode: AuthMode;
  email: string;
  phone: string;
  password: string;
  passwordConfirmation: string;
}): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (!input.email) {
    errors.email = "Enter your email address.";
  } else if (!emailPattern.test(input.email.normalize("NFKC"))) {
    errors.email = "Enter a valid email address, such as you@example.com.";
  }

  if (input.mode === "sign_up") {
    const compactPhone = input.phone.replace(/[ ()-]/g, "");
    const normalizedPhone = compactPhone.startsWith("+")
      ? compactPhone
      : `+${compactPhone}`;
    if (!input.phone) {
      errors.phone = "Enter your mobile phone number.";
    } else if (!phonePattern.test(normalizedPhone)) {
      errors.phone =
        "Use an international phone number, such as +15551234567.";
    }
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
  } else if (!input.password) {
    errors.password = "Enter your password.";
  }
  return errors;
}
