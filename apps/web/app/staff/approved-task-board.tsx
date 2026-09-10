"use client";

import { useEffect, useState } from "react";
import styles from "./approved-task-board.module.css";

type BoardSpace = { id: string; name: string; color: string; boards: { id: string; name: string; count: number }[] };
type BoardNavigation = { board: string; spaces: BoardSpace[] };

function fromBoard(event: MessageEvent) {
  const frame = document.querySelector<HTMLIFrameElement>("#approved-task-board");
  return event.origin === window.location.origin && event.source === frame?.contentWindow;
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
export function ApprovedTaskBoard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    const previousGutter = document.documentElement.style.scrollbarGutter;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.scrollbarGutter = "auto";
    const receive = (event: MessageEvent) => {
      if (!fromBoard(event) || event.data?.type !== "audentra:approved-board:state") return;
      setReady(true);
      setDialogOpen(event.data.dialogOpen === true);
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      document.documentElement.style.overflow = previousOverflow;
      document.documentElement.style.scrollbarGutter = previousGutter;
    };
  }, []);
  return <iframe id="approved-task-board" title="Audentra Action Center — approved Task Board"
    src="/action-center-approved/index.html"
    className={`${styles.frame} ${dialogOpen ? styles.expanded : ""}`}
    style={{ visibility: ready ? "visible" : "hidden" }}
    onLoad={event => {
      const frame = event.currentTarget, doc = frame.contentDocument;
      if (!doc || doc.getElementById("portal-navigation-adapter")) return;
      const css = doc.createElement("style");
      css.textContent = ".app,.app.sidebar-hidden{grid-template-columns:minmax(0,1fr)!important}.sidebar,.main>.topbar{display:none!important}.main{height:100dvh!important}";
      doc.head.appendChild(css);
      const task = new URL(window.location.href).searchParams.get("actionTask");
      if (task && /^[A-Z]+-\d+$/.test(task) && frame.contentWindow) frame.contentWindow.location.hash = task;
      const bridge = doc.createElement("script");
      bridge.id = "portal-navigation-adapter"; bridge.type = "module";
      bridge.src = "/action-center-approved/portal-bridge.js"; doc.body.appendChild(bridge);
    }} />;
}
