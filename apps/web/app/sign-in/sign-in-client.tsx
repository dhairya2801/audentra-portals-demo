"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useApiAction } from "../hooks/use-api-resource";
import {
  getStudentBootstrap,
  signInDemoStudent,
} from "../lib/api-client";
import { ActionFeedback, PortalMark } from "../components/portal-ui";

export function SignInClient() {
  const signInAction = useCallback(async () => {
    await signInDemoStudent();
    return getStudentBootstrap();
  }, []);
  const signIn = useApiAction(signInAction);

  const continueWithDemo = async () => {
    signIn.reset();
    try {
      const bootstrap = await signIn.run();
      window.location.assign(bootstrap.initialRoute);
    } catch {
      // Keep the sign-in panel visible with a retry action.
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
          <h1 id="sign-in-title">Your next chapter starts here.</h1>
          <p>
            Sign in with your Aster University identity to review your admission
            offer and continue enrollment.
          </p>
        </div>
        <button
          className="button button--primary auth-button"
          type="button"
          disabled={signIn.status === "loading"}
          onClick={() => void continueWithDemo()}
        >
          {signIn.status === "loading"
            ? "Signing in…"
            : signIn.status === "error"
              ? "Retry demo sign in"
              : "Continue with demo student"}
          <span aria-hidden="true">→</span>
        </button>
        <ActionFeedback
          status={signIn.status}
          error={signIn.message}
          success="Signed in. Opening your portal…"
        />
        <div className="demo-notice">
          <strong>Development preview</strong>
          <p>
            This local environment uses a secured demo identity endpoint.
            Institutional single sign-on replaces it in production.
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
