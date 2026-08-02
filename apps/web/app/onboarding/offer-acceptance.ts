import type { AcceptOfferResponse } from "@vv/contracts";

type OfferAcceptanceRouting = Pick<
  AcceptOfferResponse,
  "initialRoute" | "onboardingRequired"
>;

export function getPostAcceptanceRoute(
  acceptance: OfferAcceptanceRouting,
): "/dashboard" | null {
  if (
    acceptance.onboardingRequired === false ||
    acceptance.initialRoute === "/dashboard"
  ) {
    return "/dashboard";
  }

  return null;
}
