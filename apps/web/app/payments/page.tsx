"use client";

import type { StudentDashboard, StudentFinancials, StudentPaymentList } from "@vv/contracts";
import { useCallback, useMemo, useRef } from "react";
import Icon from "../design-system/Icon.jsx";
import { PortalShell } from "../components/portal-shell";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  createDepositPayment,
  getStudentBootstrap,
  getStudentDashboard,
  getStudentFinancials,
  getStudentPayments,
} from "../lib/api-client";
import { useTenant } from "../components/tenant-provider";
import { formatTenantDate } from "../lib/tenant";
import { FinancialsFrame, FinancialsPending, buildLedger } from "../components/financials-frame";
import { PayCta, ScheduleList } from "../components/financials-payments";

type PaymentDashboard = Omit<StudentDashboard, "offer"> & { offer?: StudentDashboard["offer"] };
type ReadyData = {
  restricted: false;
  financials: StudentFinancials;
  payments: StudentPaymentList;
  dashboard: PaymentDashboard;
};
type PageData = ReadyData | { restricted: true };

/**
 * My Financials · Payments — the schedule that follows from what is billed,
 * and the one payment this portal takes: the enrollment deposit.
 */
function PaymentWorkspace({ data, reload }: { data: ReadyData; reload: () => void }) {
  const { tenant } = useTenant();
  const ledger = useMemo(() => buildLedger(data.financials, data.payments.items), [data.financials, data.payments.items]);
  const intent = useRef<string | null>(null);
  const pay = useApiAction(useCallback((offerId: string, key: string) => createDepositPayment({ offerId }, key), []));
  const offer = data.dashboard.offer;
  const successful = data.payments.items.find((item) => item.status === "succeeded");

  const submit = async () => {
    if (!offer) return;
    const key = intent.current ?? (intent.current = crypto.randomUUID());
    try {
      await pay.run(offer.id, key);
      intent.current = null;
      reload();
    } catch {
      /* retain the intent for retry */
    }
  };

  return (
    <FinancialsFrame leaf="financials-payments" data={data.financials} ledger={ledger}>
      <ScheduleList data={data.financials} ledger={ledger} onPlanChanged={reload} />

      {successful ? (
        <div className="pay-cta">
          <div>
            <strong>Deposit received</strong>
            <span>
              Recorded {formatTenantDate(successful.createdAt, tenant, { dateStyle: "long" })} · reference{" "}
              {successful.processorReference}
            </span>
          </div>
          <span className="status-pill done">
            <Icon name="check" size={13} /> Paid
          </span>
        </div>
      ) : offer ? (
        <PayCta amountCents={offer.depositAmountCents} status={pay.status} error={pay.message} onPay={() => void submit()} />
      ) : null}
    </FinancialsFrame>
  );
}

export default function PaymentsPage() {
  const data = useApiResource(
    useCallback(async (signal: AbortSignal): Promise<PageData> => {
      const bootstrap = await getStudentBootstrap(signal);
      if (bootstrap.actor?.type === "delegate" && !bootstrap.actor.scopes.includes("payments")) return { restricted: true };
      const [financials, payments, dashboard] = await Promise.all([
        getStudentFinancials(signal),
        getStudentPayments(signal),
        getStudentDashboard(signal),
      ]);
      return { restricted: false, financials, payments, dashboard: dashboard as PaymentDashboard };
    }, []),
  );

  if (data.status !== "ready") {
    return (
      <FinancialsPending
        leaf="financials-payments"
        status={data.status === "error" ? "error" : "loading"}
        label="your payment details"
        onRetry={data.reload}
      />
    );
  }
  if (data.data.restricted) {
    return (
      <PortalShell active="payments">
        <div aria-hidden="true" />
      </PortalShell>
    );
  }
  return <PaymentWorkspace data={data.data} reload={data.refresh} />;
}
