"use client";

import type { StaffActionCenterQuery, StaffTaskBoardContext } from "@vv/contracts";
import { useEffect, useState } from "react";
import { ApiClientError, writeDemoTaskActivity, reviewDemoDocument, getDemoTaskBoard, getWorkBoard, getStaffDocumentReviewOptions, getStaffWorkItemDetail, updateStaffWorkItem, createStaffWorkComment, reviewStaffDocument, getStaffDocumentContent, startStaffInteraction, recordStaffCommunication, saveStaffOutreachDraft } from "../lib/api-client";
import styles from "./approved-task-board.module.css";

type BoardSpace = { id: string; name: string; color: string; boards: { id: string; name: string; count: number }[] };
type BoardNavigation = { board: string; spaces: BoardSpace[] };

function fromBoard(event: MessageEvent) {
  const frame = document.querySelector<HTMLIFrameElement>("#approved-task-board");
  return event.origin === window.location.origin && event.source === frame?.contentWindow;
}

export function useApprovedBoardOpenCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (fromBoard(event) && event.data?.type === "audentra:approved-board:state") {
        const navigation = event.data.navigation as BoardNavigation;
        setCount(navigation.spaces.reduce((total, space) => total + space.boards.reduce((sum, board) => sum + board.count, 0), 0));
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  return count;
}

/** Project navigation lives under Task board in the original staff sidebar. */
export function ApprovedBoardNavigation({ onSelect }: { onSelect: () => void }) {
  const [navigation, setNavigation] = useState<BoardNavigation | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ fa: true, en: true, cl: false });
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (fromBoard(event) && event.data?.type === "audentra:approved-board:state") {
        setNavigation(event.data.navigation);
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  return <div className={styles.tree} aria-label="Task Board projects">
    {navigation?.spaces.map(space => <div key={space.id}>
      <button type="button" className={styles.space} data-board-space={space.id}
        aria-expanded={!!expanded[space.id]} onClick={() => setExpanded(current => ({ ...current, [space.id]: !current[space.id] }))}>
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" style={{ transform: expanded[space.id] ? "rotate(90deg)" : undefined }}><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        <span className={styles.spaceIcon} data-color={space.color}><svg width="13" height="13" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5h6l2 2h8v10H2z M2 5V3h6l2 2h8v2" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg></span>
        <strong>{space.name}</strong>
      </button>
      <div hidden={!expanded[space.id]}>{space.boards.map(board => <button key={board.id} type="button"
        className={`${styles.board} ${navigation.board === board.id ? styles.selected : ""}`}
        data-approved-board={board.id} aria-current={navigation.board === board.id ? "page" : undefined}
        onClick={() => {
          document.querySelector<HTMLIFrameElement>("#approved-task-board")?.contentWindow?.postMessage({ type: "audentra:approved-board:select", board: board.id }, window.location.origin);
          onSelect();
        }}><span>{board.name}</span><small>{board.count}</small></button>)}</div>
    </div>)}
  </div>;
}

/** Keep the approved workspace isolated while retaining the portal's own shell. */
export function ApprovedTaskBoard({ onOpenWorkspace, demo = false, initialTask, initialQuery, onContextChange }: { onOpenWorkspace: (id?: string) => void; demo?: boolean; initialTask?: string | null; initialQuery?: StaffActionCenterQuery; onContextChange?: (context: StaffTaskBoardContext | null) => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!fromBoard(event) || event.data?.type !== "audentra:approved-board:state") return;
      const context = event.data.taskContext;
      if (context?.surface === "task_board") onContextChange?.(context);
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      onContextChange?.(null);
    };
  }, [onContextChange]);
  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    const previousGutter = document.documentElement.style.scrollbarGutter;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.scrollbarGutter = "auto";
    const receive = (event: MessageEvent) => {
      if (!fromBoard(event)) return;
      if (event.data?.type === "audentra:board:request" && typeof event.data.id === "string") {
        const {operation, payload, id} = event.data;
        const send = (result: unknown, error?: string, errorCode?: string) => document.querySelector<HTMLIFrameElement>("#approved-task-board")?.contentWindow?.postMessage({type: "audentra:board:response", id, result, error, errorCode}, window.location.origin);
        const call = demo ? (operation === "demo-identities" ? getDemoTaskBoard()
          : operation === "demo-document" && typeof payload?.path === "string" && /^\/v1\/staff\/documents\/[a-f0-9-]+\/content$/.test(payload.path) ? getStaffDocumentContent(payload.path)
          : operation === "demo-write" ? writeDemoTaskActivity(payload.workItemId, payload.input, payload.idempotencyKey)
          : operation === "demo-review" ? reviewDemoDocument(payload.documentId, payload.input, payload.idempotencyKey)
          : operation === "demo-review-options" ? getStaffDocumentReviewOptions()
          : Promise.reject(new Error("This action is still simulated")))
          : operation === "read" ? getWorkBoard(payload?.offset ?? 0, payload?.project, payload?.filters)
          : operation === "review-options" ? getStaffDocumentReviewOptions()
          : operation === "detail" ? getStaffWorkItemDetail(payload.workItemId)
          : operation === "update" ? updateStaffWorkItem(payload.workItemId, payload.input)
          : operation === "comment" ? createStaffWorkComment(payload.workItemId, payload.input, id)
          : operation === "review" ? reviewStaffDocument(payload.documentId, payload.input, payload.idempotencyKey ?? id)
          : operation === "start-interaction" ? startStaffInteraction(payload.workItemId, payload.input, payload.idempotencyKey)
          : operation === "save-draft" ? saveStaffOutreachDraft(payload.workItemId, payload.input, payload.idempotencyKey)
          : operation === "communicate" ? recordStaffCommunication(payload.interactionId, payload.input, payload.idempotencyKey)
          : Promise.reject(new Error("This operation is unavailable"));
        void call.then(result => send(result)).catch((error: unknown) => send(null, error instanceof ApiClientError && error.status < 500 ? error.message : "The operation could not complete. Your draft is retained; retry to check whether it saved.", error instanceof ApiClientError ? error.code : "REQUEST_FAILED"));
        return;
      }
      if (event.data?.type === "audentra:board:full-workspace") {
        if (demo) return;
        onOpenWorkspace(typeof event.data.studentId === "string" ? event.data.studentId : undefined);
        return;
      }
      if (event.data?.type === "audentra:board:original" && typeof event.data.path === "string" && /^\/v1\/.*documents\/[a-f0-9-]+\/content$/.test(event.data.path)) {
        if (demo) return;
        void getStaffDocumentContent(event.data.path).then(blob => {
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank", "noopener,noreferrer");
          window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        }).catch(() => document.querySelector<HTMLIFrameElement>("#approved-task-board")?.contentWindow?.postMessage({type: "audentra:board:notice", message: "The original file is unavailable in the configured document store."}, window.location.origin));
        return;
      }
      if (event.data?.type !== "audentra:approved-board:state") return;
      setReady(true);
      setDialogOpen(event.data.dialogOpen === true);
    };
    const invalidate = () => {
      document.querySelector<HTMLIFrameElement>("#approved-task-board")?.contentWindow?.postMessage({type:"audentra:board:invalidate"},window.location.origin);
    };
    window.addEventListener("vv:student-record-changed", invalidate);
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("vv:student-record-changed", invalidate);
      window.removeEventListener("message", receive);
      document.documentElement.style.overflow = previousOverflow;
      document.documentElement.style.scrollbarGutter = previousGutter;
    };
  }, [onOpenWorkspace, demo]);
  return <iframe id="approved-task-board" title="Audentra Task Board"
    src={demo
      ? `/action-center-demo/index.html${initialTask ? `#${encodeURIComponent(initialTask)}` : ""}`
      : `/action-center-approved/index.html?${new URLSearchParams({demo: "0", task: initialTask ?? "", scope: JSON.stringify(initialQuery ?? {})})}`}
    className={`${styles.frame} ${dialogOpen ? styles.expanded : ""}`}
    style={{ visibility: ready ? "visible" : "hidden" }}
    onLoad={event => {
      const frame = event.currentTarget, doc = frame.contentDocument;
      if (!doc || doc.getElementById("portal-navigation-adapter")) return;
      const css = doc.createElement("style");
      css.id = "portal-navigation-adapter";
      css.textContent = ".app,.app.sidebar-hidden{grid-template-columns:minmax(0,1fr)!important}.sidebar,.main>.topbar{display:none!important}.main{height:100dvh!important}";
      doc.head.appendChild(css);
      if (demo) {
        const bridge = doc.createElement("script");
        bridge.type = "module";
        bridge.src = "/action-center-demo/portal-bridge.js";
        doc.head.appendChild(bridge);
      }
      const task = new URL(window.location.href).searchParams.get("actionTask");
      if (task && /^[A-Z]+-\d+$/.test(task) && frame.contentWindow) frame.contentWindow.location.hash = task;

    }} />;
}
