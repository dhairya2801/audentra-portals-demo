"use client";

import { useEffect } from "react";

export type ApprovedBoardDestination =
  | "morning_brew" | "students" | "student_360" | "messages" | "institution_profile"
  | "academics" | "campus_life" | "knowledge";

const destinations = new Set<ApprovedBoardDestination>([
  "morning_brew", "students", "student_360", "messages", "institution_profile",
  "academics", "campus_life", "knowledge",
]);

/** The approved mock owns its entire viewport; portal CSS must not restyle it. */
export function ApprovedTaskBoard({ onNavigate }: {
  onNavigate: (destination: ApprovedBoardDestination) => void;
}) {
  useEffect(() => {
    // The prototype owns scrolling; an outer portal scrollbar would narrow the
    // iframe and subtly change every approved column and dialog measurement.
    const previousOverflow = document.documentElement.style.overflow;
    const previousGutter = document.documentElement.style.scrollbarGutter;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.scrollbarGutter = "auto";
    const receive = (event: MessageEvent) => {
      const frame = document.querySelector<HTMLIFrameElement>("#approved-task-board");
      if (event.origin !== window.location.origin || event.source !== frame?.contentWindow) return;
      if (event.data?.type === "audentra:approved-board:navigate" && destinations.has(event.data.destination)) {
        const url = new URL(window.location.href);
        url.searchParams.delete("actionTask");
        window.history.replaceState(null, "", url);
        onNavigate(event.data.destination);
      }
    };
    window.addEventListener("message", receive);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      document.documentElement.style.scrollbarGutter = previousGutter;
      window.removeEventListener("message", receive);
    };
  }, [onNavigate]);

  return (
    <iframe
      id="approved-task-board"
      title="Audentra Action Center — approved Task Board"
      src="/action-center-approved/index.html"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100dvh", border: 0, zIndex: 20, background: "#fff" }}
      onLoad={(event) => {
        const frame = event.currentTarget;
        const doc = frame.contentDocument;
        if (!doc || doc.getElementById("portal-navigation-adapter")) return;
        const task = new URL(window.location.href).searchParams.get("actionTask");
        if (task && /^[A-Z]+-\d+$/.test(task) && frame.contentWindow) frame.contentWindow.location.hash = task;
        const bridge = doc.createElement("script");
        bridge.id = "portal-navigation-adapter";
        bridge.type = "module";
        bridge.src = "/action-center-approved/portal-bridge.js";
        doc.body.appendChild(bridge);
      }}
    />
  );
}
