"use client";

import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useState,
} from "react";
import { useApiAction } from "../hooks/use-api-resource";
import {
  getStudentBootstrap,
  signInStudent,
  signUpStudent,
} from "../lib/api-client";
import { ActionFeedback, PortalMark } from "../components/portal-ui";

type AuthMode = "sign_in" | "sign_up";

export function SignInClient() {
  const [mode, setMode] = useState<AuthMode>("sign_in");
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
  const signIn = useApiAction(signInAction);
  const signUp = useApiAction(signUpAction);
  const activeAction = mode === "sign_in" ? signIn : signUp;
  const isBusy =
    signIn.status === "loading" || signUp.status === "loading";

  const chooseMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    signIn.reset();
    signUp.reset();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");

    try {
      if (mode === "sign_up") {
        await signUp.run({
          email,
          phone: String(values.get("phone") ?? "").trim(),
          password,
        });
        window.location.assign("/onboarding");
        return;
      }
      const bootstrap = await signIn.run({ email, password });
      window.location.assign(bootstrap.initialRoute);
    } catch {
      // Keep the submitted form available for a corrected retry.
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="sign-in-title">
        <Link className="brand" href="/sign-in" aria-label="Aster University sign in">
          <PortalMark />
          <span>
            <strong>Aster</strong>
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

        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span>Email address</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="you@example.com"
            />
          </label>
          {mode === "sign_up" ? (
            <label className="field">
              <span>Mobile phone</span>
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                maxLength={32}
                placeholder="+1 555 123 4567"
              />
              <small>Include your country code. Verification will be enabled later.</small>
            </label>
          ) : null}
          <label className="field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "sign_up" ? "new-password" : "current-password"
              }
              required
              minLength={mode === "sign_up" ? 12 : 1}
              maxLength={128}
            />
            {mode === "sign_up" ? (
              <small>At least 12 characters, including a letter and number.</small>
            ) : null}
          </label>
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
        <p className="auth-support">
          Trouble signing in?{" "}
          <a href="mailto:enrollment@aster.edu">Contact student support</a>
        </p>
      </section>
      <aside className="auth-story" aria-label="Aster University student experience">
        <div>
          <span className="auth-story__index">AU · 1891</span>
          <blockquote>
            “Every Aster journey begins with a single, thoughtful step.”
          </blockquote>
          <p>Office of Student Enrollment</p>
        </div>
      </aside>
    </main>
  );
}
