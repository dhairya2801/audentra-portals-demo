"use client";

import type { ReactNode } from "react";

export function PortalMark() {
  return (
    <span className="portal-mark" aria-hidden="true">
      A
    </span>
  );
}

export function LoadingState({ label = "Loading your information" }) {
  return (
    <div className="resource-state" aria-busy="true" aria-live="polite">
      <span className="loader" aria-hidden="true" />
      <h2>{label}</h2>
      <p>This should only take a moment.</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="resource-state resource-state--error" role="alert">
      <span className="state-symbol" aria-hidden="true">
        !
      </span>
      <h2>Something interrupted this page</h2>
      <p>{message}</p>
      <button className="button button--primary" type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="resource-state resource-state--empty">
      <span className="state-symbol state-symbol--soft" aria-hidden="true">
        A
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ActionFeedback({
  status,
  error,
  success,
}: {
  status: "idle" | "loading" | "success" | "error";
  error?: string | null;
  success: string;
}) {
  if (status === "idle" || status === "loading") return null;

  return (
    <p
      className={`action-feedback action-feedback--${status}`}
      role={status === "error" ? "alert" : "status"}
    >
      <span aria-hidden="true">{status === "success" ? "✓" : "!"}</span>
      {status === "success" ? success : error}
    </p>
  );
}

export function StatusPill({ value }: { value: string }) {
  const label = value.replaceAll("_", " ");
  return (
    <span className={`resource-status resource-status--${value}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

export function PageCard({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card page-card ${className}`}>
      <div className="page-card__heading">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
