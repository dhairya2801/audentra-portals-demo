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
  getStudentBootstrap,
  getStudentDashboard,
  getStudentPayments,
} from "../lib/api-client";
import { useTenant } from "../components/tenant-provider";
import { formatTenantDate, formatTenantMoney } from "../lib/tenant";

type PaymentDashboard = Omit<StudentDashboard, "offer"> & {
  offer?: StudentDashboard["offer"];
};

type ReadyPaymentPageData = {
  restricted: false;
  payments: StudentPaymentList;
  dashboard: PaymentDashboard;
};

type PaymentPageData = ReadyPaymentPageData | { restricted: true };

function PaymentWorkspace({
  data,
  reload,
}: {
  data: ReadyPaymentPageData;
  reload: () => void;
}) {
  const { tenant } = useTenant();
  const formatMoney = (cents: number) => formatTenantMoney(cents, tenant);
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
  const offer = data.dashboard.offer;

  const submitDeposit = async () => {
    if (!offer) return;
    const key = intentKey.current ?? (intentKey.current = crypto.randomUUID());
    try {
      await payDeposit.run(offer.id, key);
      intentKey.current = null;
      reload();
    } catch {
      // The same payment intent key is retained for a safe retry.
    }
  };

  if (!offer) {
    return (
      <PageCard
        eyebrow="Enrollment deposit"
        title="Payment details are unavailable"
      >
        <p>
          This delegated session does not include the offer details needed to
          review or submit an enrollment deposit.
        </p>
      </PageCard>
    );
  }

  return (
    <div className="resource-layout">
      <PageCard
        eyebrow="Enrollment deposit"
        title={formatMoney(offer.depositAmountCents)}
        action={
          <StatusPill value={successfulDeposit ? "succeeded" : "due"} />
        }
      >
        <div className="payment-summary">
          <p>
            The enrollment deposit secures your place in{" "}
            <strong>{offer.programName}</strong>. The amount is
            confirmed by {tenant.shortName} and cannot be edited in the portal.
          </p>
          <dl className="detail-grid">
            <div>
              <dt>Offer</dt>
              <dd>{offer.termName}</dd>
            </div>
            <div>
              <dt>Campus</dt>
              <dd>{offer.campusName}</dd>
            </div>
            {successfulDeposit ? (
              <>
                <div>
                  <dt>Paid</dt>
                  <dd>
                    {formatTenantDate(successfulDeposit.createdAt, tenant, {
                      dateStyle: "long",
                    })}
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
                  : `Pay ${formatMoney(offer.depositAmountCents)} deposit`}
            </button>
          )}
        </div>
      </PageCard>
      <aside className="resource-aside">
        <div className="aside-note">
          <span aria-hidden="true">$</span>
          <h2>Secure payment</h2>
          <p>
            This development environment uses {tenant.shortName}’s dummy processor. No card
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
      const bootstrap = await getStudentBootstrap(signal);
      if (
        bootstrap.actor?.type === "delegate" &&
        !bootstrap.actor.scopes.includes("payments")
      ) {
        return { restricted: true };
      }
      const [payments, dashboard] = await Promise.all([
        getStudentPayments(signal),
        getStudentDashboard(signal),
      ]);
      return {
        restricted: false,
        payments,
        dashboard: dashboard as PaymentDashboard,
      };
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
      ) : paymentData.data.restricted ? (
        <div aria-hidden="true" />
      ) : (
        <PaymentWorkspace data={paymentData.data} reload={paymentData.refresh} />
      )}
    </PortalShell>
  );
}
