"use client";

import { useMemo, useState } from "react";
import InfoModal from "../../design-system/patterns/InfoModal.jsx";
import { FinancialsFrame, FinancialsPending, buildLedger, useFinancials } from "../../components/financials-frame";
import { AidOpportunityCard, AidSources, ProgressPreview } from "../../components/financials-aid";

/**
 * My Financials · Financial aid — where each source is itemised, where a pending
 * award keeps its own row, and where the academic progress preview lives.
 */
export default function FinancialAidPage() {
  const financials = useFinancials();
  const data = financials.status === "ready" ? financials.data : null;
  const ledger = useMemo(() => (data ? buildLedger(data) : null), [data]);
  const [progressModal, setProgressModal] = useState(false);

  if (!data || !ledger) {
    return (
      <FinancialsPending
        leaf="financials-aid"
        status={financials.status === "error" ? "error" : "loading"}
        label="your aid package"
        onRetry={financials.reload}
      />
    );
  }

  return (
    <FinancialsFrame leaf="financials-aid" data={data} ledger={ledger}>
      <AidSources awards={data.awards} ledger={ledger} />

      <section className="opportunity-section" aria-labelledby="opportunity-title">
        <h2 id="opportunity-title" className="sr-only">
          Possible additional aid
        </h2>
        <AidOpportunityCard awards={data.awards} total={ledger.additionalTotal} />
      </section>

      <ProgressPreview sap={data.sap} onExplain={() => setProgressModal(true)} />

      {progressModal && <InfoModal variant="progress" onClose={() => setProgressModal(false)} />}
    </FinancialsFrame>
  );
}
