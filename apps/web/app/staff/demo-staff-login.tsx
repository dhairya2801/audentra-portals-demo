"use client";

import type { DemoStaffDirectoryEntry } from "@vv/contracts";
import { useCallback, useMemo, useState } from "react";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  ApiClientError,
  getDemoStaffDirectory,
  signInDemoStaff,
} from "../lib/api-client";
import {
  type DemoStaffFilter,
  demoStaffLoginEnabled,
  groupDemoStaff,
} from "../lib/demo-staff-login";

/**
 * "Log in as synthetic staff" — the developer affordance under the staff
 * sign-in form. It lists the demo university's staff by department with the
 * facts that make a chair interesting (title, caseload against cap, open
 * work, reports, leave) and opens the portal as the chosen person with one
 * click. People who have left the university are shown but cannot be opened:
 * that state is a product fact worth seeing, not a login failure to hide.
 *
 * Gated by `demoStaffLoginEnabled`; the platform gates the routes themselves.
 */
export function DemoStaffLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const enabled = demoStaffLoginEnabled({
    NEXT_PUBLIC_DEMO_STAFF_LOGIN_ENABLED: process.env.NEXT_PUBLIC_DEMO_STAFF_LOGIN_ENABLED,
    NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED: process.env.NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED,
    NODE_ENV: process.env.NODE_ENV,
  });
  if (!enabled) return null;
  return <DemoStaffLoginPanel onSignedIn={onSignedIn} />;
}

const filters: Array<{ id: DemoStaffFilter; label: string }> = [
  { id: "all", label: "Everyone" },
  { id: "advisers", label: "Advisers" },
  { id: "leaders", label: "Directors & managers" },
  { id: "away", label: "On leave / departed" },
];

function DemoStaffLoginPanel({ onSignedIn }: { onSignedIn: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DemoStaffFilter>("all");
  const [opening, setOpening] = useState<string | null>(null);
  const directory = useApiResource(
    useCallback((signal: AbortSignal) => getDemoStaffDirectory("", signal), []),
    { refreshOnAmbient: false },
  );
  const signIn = useApiAction(
    async (entry: DemoStaffDirectoryEntry) => signInDemoStaff({ staffRef: entry.id }),
    (error) =>
      error instanceof ApiClientError
        ? error.message
        : "We couldn’t open that staff member. Try again.",
  );

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const entries = (directory.data?.items ?? []).filter(
      (entry) =>
        !needle ||
        [entry.name, entry.email, entry.title ?? "", entry.component, entry.externalRef ?? "", entry.roleCode]
          .join(" ")
          .toLowerCase()
          .includes(needle),
    );
    return groupDemoStaff(entries, filter);
  }, [directory.data, query, filter]);

  const open = async (entry: DemoStaffDirectoryEntry) => {
    setOpening(entry.id);
    try {
      await signIn.run(entry);
      onSignedIn();
    } catch {
      setOpening(null);
    }
  };

  const total = directory.data?.total ?? 0;
  const shown = groups.reduce((sum, group) => sum + group.people.length, 0);

  return (
    <section className="auth-demo-student staff-demo-login" aria-labelledby="demo-staff-title">
      <p className="eyebrow">Development only</p>
      <h2 id="demo-staff-title">Log in as synthetic staff</h2>
      <p>
        Open the staff portal as any person in this university’s demo staff directory. Their
        identity, team, caseload, calendar and work are shown as-is.
      </p>
      <div className="staff-demo-login__controls">
        <label className="field">
          <span className="sr-only">Search staff</span>
          <input
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search by name, title, department or SYN reference"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="staff-demo-login__filters" role="tablist" aria-label="Filter staff">
          {filters.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={filter === entry.id}
              className={filter === entry.id ? "is-active" : undefined}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      {directory.status === "loading" ? (
        <p className="staff-demo-login__status" aria-live="polite">Loading the staff directory…</p>
      ) : directory.status === "error" ? (
        <p className="field-error" role="alert">
          {directory.error ?? "The staff directory is not available."}
        </p>
      ) : (
        <>
          <p className="staff-demo-login__status" aria-live="polite">
            {shown} of {total} staff members
          </p>
          <div className="staff-demo-login__list">
            {groups.map((group) => (
              <section key={group.component} aria-label={group.component}>
                <h3>{group.component}</h3>
                <ul>
                  {group.people.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className="staff-demo-login__person"
                        disabled={!entry.canSignIn || signIn.status === "loading"}
                        aria-disabled={!entry.canSignIn ? true : undefined}
                        title={
                          entry.canSignIn
                            ? `Open the staff portal as ${entry.name}`
                            : `${entry.name} has left the university and cannot sign in`
                        }
                        onClick={() => void open(entry)}
                      >
                        <span className="staff-demo-login__avatar" aria-hidden="true">
                          {entry.name
                            .split(" ")
                            .map((part) => part.slice(0, 1))
                            .join("")
                            .slice(0, 2)}
                        </span>
                        <span className="staff-demo-login__copy">
                          <strong>
                            {entry.name}
                            {entry.employmentStatus !== "active" ? (
                              <em className={`staff-demo-login__state staff-demo-login__state--${entry.employmentStatus}`}>
                                {entry.employmentStatus === "on_leave"
                                  ? `on leave${entry.leaveUntil ? ` until ${entry.leaveUntil}` : ""}`
                                  : "departed"}
                              </em>
                            ) : null}
                          </strong>
                          <small>
                            {entry.title ?? entry.roleCode}
                            {entry.managerName ? ` · reports to ${entry.managerName}` : ""}
                          </small>
                          <small>
                            {entry.caseload.primaryAdvisees > 0
                              ? `${entry.caseload.primaryAdvisees}${entry.caseload.cap ? `/${entry.caseload.cap}` : ""} advisees · `
                              : ""}
                            {entry.openWorkItems} open items
                            {entry.directReports > 0 ? ` · ${entry.directReports} reports` : ""}
                            {entry.externalRef ? ` · ${entry.externalRef}` : ""}
                          </small>
                        </span>
                        <span className="staff-demo-login__action">
                          {opening === entry.id && signIn.status === "loading" ? "Opening…" : entry.canSignIn ? "Open" : "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {groups.length === 0 ? <p className="staff-demo-login__status">No staff member matches.</p> : null}
          </div>
        </>
      )}
      {signIn.message ? (
        <p className="field-error" role="alert">
          {signIn.message}
        </p>
      ) : null}
      <small className="staff-auth-boundary">
        Sessions opened here are real, revocable staff sessions minted by the platform’s
        development-only route; the route does not exist in production.
      </small>
    </section>
  );
}
