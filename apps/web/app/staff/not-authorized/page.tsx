import type { Metadata } from "next";
import Link from "next/link";
import { PortalMark } from "../../components/portal-ui";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Staff access not active",
  description: "Your institutional identity is verified, but it is not approved for staff access yet.",
};

export default function StaffNotAuthorizedPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="staff-access-title">
        <header className={styles.header}>
          <PortalMark />
          <span className={styles.eyebrow}>Institutional access</span>
        </header>

        <div className={styles.signal} aria-hidden="true">
          <span>!</span>
        </div>

        <div className={styles.copy}>
          <p className={styles.kicker}>Google verified your identity</p>
          <h1 id="staff-access-title">Staff access is not active yet.</h1>
          <p className={styles.lede}>
            Your institutional account is valid, but Audentra only opens the staff workspace
            for people approved by an institution administrator.
          </p>
        </div>

        <div className={styles.explainer}>
          <strong>Nothing was changed.</strong>
          <span>
            No staff profile, session, mailbox permission, or product role was created by this
            sign-in attempt.
          </span>
        </div>

        <ol className={styles.steps}>
          <li>
            <span>1</span>
            <div>
              <strong>Confirm the exact email</strong>
              <p>Ask your Audentra administrator to verify the Google address you used.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Request staff activation</strong>
              <p>The administrator must activate a staff profile or an exact provisioning grant.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Try Google again</strong>
              <p>Once approved, return to staff sign-in and use the same institutional account.</p>
            </div>
          </li>
        </ol>

        <div className={styles.actions}>
          <Link className={styles.primaryAction} href="/staff">
            Return to staff sign in
          </Link>
          <p>Belonging to an approved domain never grants staff access by itself.</p>
        </div>
      </section>
    </main>
  );
}
