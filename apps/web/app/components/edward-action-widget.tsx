"use client";

import type { EdwardActionWidget } from "@vv/contracts";
import { useEffect, useState } from "react";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { createDepositPayment } from "../lib/api-client";
import { TenantLink as Link } from "./tenant-link";

/**
 * A platform action widget attached to an Edward answer — the deposit payment,
 * the document upload route, the appointment route. Shared by the floating
 * window and the `/edward` workspace so the secure action renders once.
 */
export function ActionWidget({
  widget,
  onCompleted,
}: {
  widget: EdwardActionWidget;
  onCompleted: (message: string) => void;
}) {
  const { track } = useActivityTracking();
  const [status, setStatus] = useState<
    "idle" | "submitting" | "complete" | "error"
  >(widget.type === "deposit_payment" && widget.status === "completed"
    ? "complete"
    : "idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track("ui.edward_action_widget_viewed.v1", {
      widget_type: widget.type,
      page_context: window.location.pathname,
    });
  }, [track, widget.type]);

  if (widget.type === "deposit_payment") {
    const pay = async () => {
      if (!["idle", "error"].includes(status)) return;
      setStatus("submitting");
      setError(null);
      try {
        await createDepositPayment(
          { offerId: widget.offerId },
          crypto.randomUUID(),
        );
        setStatus("complete");
        track("ui.edward_action_completed.v1", {
          widget_type: widget.type,
          outcome: "succeeded",
        });
        onCompleted(
          "Your enrollment deposit is recorded. Enrollment and financial balances have been refreshed.",
        );
      } catch (caught) {
        setStatus("error");
        setError(
          caught instanceof Error
            ? caught.message
            : "The deposit could not be recorded.",
        );
        track("ui.edward_action_completed.v1", {
          widget_type: widget.type,
          outcome: "failed",
        });
      }
    };

    return (
      <section className="edward-widget" aria-label={widget.title}>
        <div className="edward-widget__heading">
          <span aria-hidden="true">$</span>
          <div>
            <strong>{widget.title}</strong>
            <small>Secure action</small>
          </div>
          <b>
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(widget.amountCents / 100)}
          </b>
        </div>
        <p>{widget.description}</p>
        {error ? <p className="edward-widget__error">{error}</p> : null}
        <button
          className="button button--accent"
          type="button"
          disabled={status === "submitting" || status === "complete"}
          onClick={() => void pay()}
        >
          {status === "submitting"
            ? "Recording deposit…"
            : status === "complete"
              ? "✓ Deposit recorded"
              : status === "error"
                ? "Try again"
                : "Pay deposit"}
        </button>
        <small>No real card is charged in this development environment.</small>
      </section>
    );
  }

  return (
    <section className="edward-widget" aria-label={widget.title}>
      <div className="edward-widget__heading">
        <span aria-hidden="true">{widget.type === "document_upload" ? "↑" : "◷"}</span>
        <div>
          <strong>{widget.title}</strong>
          <small>
            {widget.type === "document_upload" ? "Document workflow" : "Live support"}
          </small>
        </div>
      </div>
      <p>{widget.description}</p>
      <Link className="button button--accent" href={widget.href}>
        {widget.type === "document_upload" ? "Choose a document" : "Choose a time"}
      </Link>
    </section>
  );
}
