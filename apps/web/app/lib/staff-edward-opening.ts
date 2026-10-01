import type { StaffAssistantPageContext } from "@vv/contracts";

export interface StaffEdwardOpening {
  context?: StaffAssistantPageContext;
  greeting?: string;
  question?: string;
}
/** Open the one portal assistant. Opening never submits a turn. */
export function openStaffEdward(detail: StaffEdwardOpening) {
  window.dispatchEvent(new CustomEvent<StaffEdwardOpening>("audentra:staff-edward:open", { detail }));
}
