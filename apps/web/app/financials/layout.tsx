import type { ReactNode } from "react";
import { ConceptFinancialPlan } from "../components/financial-plan/concept-frame";
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <ConceptFinancialPlan />
      {children}
    </>
  );
}
