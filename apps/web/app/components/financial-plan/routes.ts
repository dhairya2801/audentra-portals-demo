/** URL adapter only. Financial facts and planning behavior come from the canonical Financial Plan service. */
export const conceptRoutes = {
  overview: "/financials",
  payments: "/financials/payments",
  expenses: "/financials/expenses",
  aid: "/financials/aid",
  housing: "/financials/expenses/housing",
  meals: "/financials/expenses/meals",
  simulator: "/financials/expenses/simulator",
  coverage: "/financials/expenses#coverage",
  timeline: "/financials/payments#timeline",
} as const;
export type ConceptSection = keyof typeof conceptRoutes;
export function isConceptSection(value: string): value is ConceptSection {
  return Object.hasOwn(conceptRoutes, value);
}
export function conceptSection(pathname: string, hash = ""): ConceptSection {
  const fragment = hash.replace(/^#/, "");
  if (isConceptSection(fragment)) return fragment;
  const path = pathname.replace(/^\/parent(?=\/)/, "");
  return (Object.entries(conceptRoutes).find(
    ([, route]) => route === path,
  )?.[0] || "overview") as ConceptSection;
}
