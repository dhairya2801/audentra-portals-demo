"use client";

import { useMemo } from "react";
import { FinancialsFrame, FinancialsPending, buildLedger, useFinancials } from "../components/financials-frame";
import { CostCard, CoverageBar, DocumentList, NextPaymentCard } from "../components/financials-overview";

/**
 * My Financials · Overview — ENR-166, serving ENR-159 and ENR-160. Reading
 * order: what is on fire (the band), what it costs, what still needs me.
 */
export default function FinancialsPage() {
  const financials = useFinancials();
  const data = financials.status === "ready" ? financials.data : null;
  const ledger = useMemo(() => (data ? buildLedger(data) : null), [data]);

  if (!data || !ledger) {
    return (
      <FinancialsPending
        leaf="financials-overview"
        status={financials.status === "error" ? "error" : "loading"}
        label="your financial picture"
        onRetry={financials.reload}
      />
    );
  }

  return (
    <FinancialsFrame leaf="financials-overview" data={data} ledger={ledger} rail={<NextPaymentCard ledger={ledger} />}>
      <CostCard data={data} ledger={ledger}>
        <CoverageBar ledger={ledger} />
      </CostCard>

      <DocumentList documents={data.requiredDocuments} />
    </FinancialsFrame>
  );
}
