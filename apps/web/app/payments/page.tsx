"use client";

import type {
  StudentDashboard,
  StudentPaymentList,
} from "@vv/contracts";
import { useCallback, useRef } from "react";
import { PortalShell } from "../components/portal-shell";
import {
  ActionFeedback,
  ErrorState,
  LoadingState,
  PageCard,
  StatusPill,
} from "../components/portal-ui";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  createDepositPayment,
  getStudentDashboard,
  getStudentPayments,
} from "../lib/api-client";

type PaymentPageData = {
  payments: StudentPaymentList;
  dashboard: StudentDashboard;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function PaymentWorkspace({
  data,
  reload,
}: {
  data: PaymentPageData;
  reload: () => void;
}) {
  const intentKey = useRef<string | null>(null);
  const payDepositAction = useCallback(
    (offerId: string, key: string) =>
      createDepositPayment({ offerId }, key),
    [],
  );
  const payDeposit = useApiAction(payDepositAction);
  const successfulDeposit = data.payments.items.find(
    (payment) => payment.status === "succeeded",
  );

  const submitDeposit = async () => {
    const key = intentKey.current ?? (intentKey.current = crypto.randomUUID());
    try {
      await payDeposit.run(data.dashboard.offer.id, key);
      intentKey.current = null;
      reload();
    } catch {
      // The same payment intent key is retained for a safe retry.
    }
  };

  return (
    <div className="resource-layout">
      <PageCard
        eyebrow="Enrollment deposit"
        title={formatMoney(data.dashboard.offer.depositAmountCents)}
        action={
          <StatusPill value={successfulDeposit ? "succeeded" : "due"} />
        }
      >
        <div className="payment-summary">
          <p>
            The enrollment deposit secures your place in{" "}
            <strong>{data.dashboard.offer.programName}</strong>. The amount is
            confirmed by Aster and cannot be edited in the portal.
          </p>
          <dl className="detail-grid">
            <div>
              <dt>Offer</dt>
              <dd>{data.dashboard.offer.termName}</dd>
            </div>
            <div>
              <dt>Campus</dt>
              <dd>{data.dashboard.offer.campusName}</dd>
            </div>
            {successfulDeposit ? (
              <>
                <div>
                  <dt>Paid</dt>
                  <dd>
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "long",
                    }).format(new Date(successfulDeposit.createdAt))}
                  </dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd>{successfulDeposit.processorReference}</dd>
                </div>
              </>
            ) : null}
          </dl>
          <ActionFeedback
            status={payDeposit.status}
            error={payDeposit.message}
            success="Your enrollment deposit was recorded."
          />
          {successfulDeposit ? (
            <p className="confirmed-line" role="status">
              <span aria-hidden="true">✓</span>
              Deposit received. Your payment record is confirmed.
            </p>
          ) : (
            <button
              className="button button--primary"
              type="button"
              disabled={payDeposit.status === "loading"}
              onClick={() => void submitDeposit()}
            >
              {payDeposit.status === "loading"
                ? "Processing deposit…"
                : payDeposit.status === "error"
                  ? "Retry deposit"
                  : `Pay ${formatMoney(data.dashboard.offer.depositAmountCents)} deposit`}
            </button>
          )}
        </div>
      </PageCard>
      <aside className="resource-aside">
        <div className="aside-note">
          <span aria-hidden="true">$</span>
          <h2>Secure payment</h2>
          <p>
            This development environment uses Aster’s dummy processor. No card
            details are collected by the portal.
          </p>
        </div>
        <PageCard title={`Payment history (${data.payments.total})`}>
          {data.payments.items.length > 0 ? (
            <ul className="compact-list">
              {data.payments.items.map((payment) => (
                <li key={payment.id}>
                  <span>
                    <strong>{formatMoney(payment.amountCents)}</strong>
                    <small>{payment.processorReference}</small>
                  </span>
                  <StatusPill value={payment.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="compact-empty">No payments recorded yet.</p>
          )}
        </PageCard>
      </aside>
    </div>
  );
}

export default function PaymentsPage() {
  const loadPayments = useCallback(
    async (signal: AbortSignal): Promise<PaymentPageData> => {
      const [payments, dashboard] = await Promise.all([
        getStudentPayments(signal),
        getStudentDashboard(signal),
      ]);
      return { payments, dashboard };
    },
    [],
  );
  const paymentData = useApiResource(loadPayments);

  return (
    <PortalShell
      active="payments"
      eyebrow="Student account"
      title="Payments"
      description="Review the authoritative amount and secure your place with an enrollment deposit."
    >
      {paymentData.status === "loading" ? (
        <LoadingState label="Loading your payment details" />
      ) : paymentData.status === "error" ? (
        <ErrorState message={paymentData.error} onRetry={paymentData.reload} />
      ) : (
        <PaymentWorkspace data={paymentData.data} reload={paymentData.refresh} />
      )}
    </PortalShell>
  );
}
