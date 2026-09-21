"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PortalShell, type PortalSection } from "../portal-shell";
import { openEdward } from "../../design-lib/door.js";
import { getFinancialPlan, saveFinancialPlanInputs, simulateFinancialPlan } from "../../lib/api-client";
import { useTenant } from "../tenant-provider";
import {
  conceptRoutes,
  conceptSection,
  isConceptSection,
  type ConceptSection,
} from "./routes";

const documentUrl = "/financial-plan/concept-4-plan-studio.html";
/** Keep Concept 4 content isolated from portal styles while using the standard
 * shell, route navigation and live Edward assistant. */
export function ConceptFinancialPlan() {
  const pathname = usePathname() || "/financials";
  const { href } = useTenant();
  const frame = useRef<HTMLIFrameElement>(null);
  const detach = useRef<(() => void) | null>(null);
  // Keep one document alive across financial routes so the concept retains its state.
  const [source] = useState(() => `${documentUrl}#${conceptSection(pathname)}`);
  const section = conceptSection(pathname);
  const active: PortalSection =
    section === "payments" || section === "timeline"
      ? "payments"
      : section === "aid"
        ? "financial_aid"
        : section === "overview"
          ? "financials"
          : "financial_expenses";

  function synchronizeFrame() {
    const target = frame.current?.contentWindow;
    if (!target || target.location.pathname !== documentUrl) return;
    const next = conceptSection(window.location.pathname, window.location.hash);
    if (target.location.hash !== `#${next}`)
      target.location.replace(`${documentUrl}#${next}`);
  }

  useEffect(() => {
    synchronizeFrame();
  }, [pathname]);
  useEffect(() => {
    const openAssistant = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow
      )
        return;
      if (event.data?.type === "financial-plan:request" && typeof event.data.id === "string") {
        const send = (result: unknown, error?: string) => frame.current?.contentWindow?.postMessage(
          {type: "financial-plan:response", id: event.data.id, result, error}, window.location.origin);
        const operation = event.data.operation === "read" ? getFinancialPlan()
          : event.data.operation === "simulate" ? simulateFinancialPlan(event.data.payload)
          : event.data.operation === "save-inputs" ? saveFinancialPlanInputs(event.data.payload, event.data.idempotencyKey)
          : Promise.reject(new Error("This planning operation is unavailable"));
        void operation.then(result => send(result)).catch(() => send(null, "Unable to load or save your plan. Refresh to check your session or a newer version; your draft is retained."));
        return;
      }
      if (
        event.data?.type === "financial-plan:ask-edward" &&
        typeof event.data.question === "string"
      ) {
        openEdward({ question: event.data.question.slice(0, 4000) });
      }
    };
    window.addEventListener("message", openAssistant);
    window.addEventListener("popstate", synchronizeFrame);
    window.addEventListener("hashchange", synchronizeFrame);
    return () => {
      window.removeEventListener("message", openAssistant);
      window.removeEventListener("popstate", synchronizeFrame);
      window.removeEventListener("hashchange", synchronizeFrame);
      detach.current?.();
    };
  }, []);

  function connectDocument() {
    detach.current?.();
    const target = frame.current?.contentWindow;
    const doc = frame.current?.contentDocument;
    if (!target || !doc) return;
    synchronizeFrame();
    const financialHref = (hash: ConceptSection) => href(conceptRoutes[hash]);
    const onHashChange = () => {
      const hash = target.location.hash.slice(1);
      if (!isConceptSection(hash)) return;
      const destination = financialHref(hash);
      if (
        `${window.location.pathname}${window.location.hash}` !== destination
      ) {
        window.history.replaceState(null, "", destination);
      }
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        "a",
      );
      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const hash = link.getAttribute("href")?.replace(/^#/, "") || "";
      if (isConceptSection(hash)) {
        event.preventDefault();
        const destination = financialHref(hash);
        if (
          `${window.location.pathname}${window.location.hash}` !== destination
        )
          window.history.pushState(null, "", destination);
        target.location.replace(`${documentUrl}#${hash}`);
      }
    };
    doc.addEventListener("click", onClick);
    target.addEventListener("hashchange", onHashChange);
    detach.current = () => {
      doc.removeEventListener("click", onClick);
      target.removeEventListener("hashchange", onHashChange);
    };
  }

  return (
    <PortalShell active={active} bareContent>
      <iframe
        ref={frame}
        src={source}
        onLoad={connectDocument}
        title="My Financials · Concept 4 Plan Studio"
        style={{
          width: "100%",
          height: "calc(100dvh - var(--topbar-height, 70px))",
          border: 0,
          display: "block",
          background: "#f5f5fa",
        }}
      />
    </PortalShell>
  );
}
