/**
 * The design system is vendored as the reference repository's own JSX. Its
 * components take loosely-typed props by design (plain JS, no TypeScript), so
 * they are declared here as untyped React components rather than inferred —
 * inference would mark every destructured prop as required.
 */
declare module "*.jsx" {
  import type { ComponentType } from "react";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Loose = ComponentType<any>;
  const component: Loose;
  export default component;
  export const IconButton: Loose;
  export const CardHead: Loose;
  export const CardRows: Loose;
  export const CardFoot: Loose;
  export const InfoTip: Loose;
  export const NavGroup: Loose;
  export const NavSkeleton: Loose;
  export const ProfileChip: Loose;
  export const Queue: Loose;
  export const QueueGroup: Loose;
  export const QueueRow: Loose;
  export const LogEntry: Loose;
  export const LogFold: Loose;
  export const WorkLog: Loose;
  export const ICON_NAMES: string[];
  export function initialsOf(name: string): string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useTip(tip: any, placement?: string): any;
}

declare module "*/design-lib/navigation.js" {
  export interface Destination {
    id: string;
    label: string;
    route: string;
    icon: string;
    badge?: string;
    lede?: string;
    group?: string;
    kind?: string;
    tab?: string;
    built?: boolean;
    hero?: { flag?: string; kicker?: string; title?: string; lede?: string; motif?: string };
  }
  export type NavEntry =
    | { kind: "link"; id: string }
    | { kind: "group"; id: string; label: string; items: string[] };
  export const GROUPS: Record<string, string>;
  export const GROUP_HEROES: Record<string, { kicker: string; title: string; lede: string; motif?: string }>;
  export const DESTINATIONS: Destination[];
  export const PANELS: Record<string, { id: string; owner: string; label: string; icon: string; lede: string }>;
  export const NAV: NavEntry[];
  export const DEFAULT_ROUTE: string;
  export const UTILITY_ID: string;
  export const PROFILE_ID: string;
  export function panelById(id: string): { id: string; owner: string; label: string; icon: string; lede: string } | null;
  export function destinationById(id: string): Destination | null;
  export function destinationByRoute(hash: string): Destination | null;
  export function heroFor(item: unknown): { kicker?: string; title?: string; lede?: string; motif?: string; flag?: string };
  export function groupLeaves(group: string): Destination[];
}

declare module "*/design-lib/overlay.js" {
  import type { RefObject } from "react";
  export const FOCUSABLE: string;
  export const SHEET_QUERY: string;
  export const RAIL_QUERY: string;
  export const TWO_PANE_QUERY: string;
  export function useOverlay(
    panel: RefObject<HTMLElement | null>,
    options: { onClose: () => void; suspended?: boolean; modal?: boolean; returnFocus?: boolean },
  ): void;
  export function useMedia(query: string): boolean;
  export function useIsSheet(): boolean;
}

declare module "*/design-lib/toast.js" {
  export interface ToastInput {
    tone?: "success" | "error" | "info" | "quiet";
    title: string;
    body?: string;
  }
  export interface ToastRecord extends ToastInput {
    id: string;
  }
  export function useToasts(): {
    toasts: ToastRecord[];
    push: (toast: ToastInput | string) => void;
    dismiss: (id: string) => void;
  };
  export function durationFor(toast: ToastRecord): number;
  export function toneOf(toast: ToastRecord): string;
}

declare module "*/design-lib/door.js" {
  export interface EdwardDoorContext {
    label?: string | null;
    intent?: string | null;
    taskId?: string | null;
    office?: string | null;
    topic?: string | null;
    clubId?: string | null;
    [key: string]: unknown;
  }
  export function openEdward(input?: { question?: string; context?: EdwardDoorContext | null }): void;
  export function onEdwardOpen(
    handler: (detail: { question?: string; context?: EdwardDoorContext | null }) => void,
  ): () => void;
  export function stashHandoff(handoff: Record<string, unknown>): void;
  export function announceHandoff(): void;
  export function onHandoff(handler: () => void): () => void;
  export function takeHandoff(kind?: string): Record<string, unknown> | null;
}
