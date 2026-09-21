"use client";

/**
 * Edward Lab — the ⓘ buttons.
 *
 * Two kinds of explanation, one control. `<Info concept="read_loop" />`
 * explains an architectural concept from the glossary; `<ToolName name=… />`
 * renders a tool name with an ⓘ that shows the description the planners are
 * actually prompted with, fetched once per Lab session from
 * /api/edward-lab/tools (which proxies the platform's catalogue). Nothing in
 * this file paraphrases the platform: if the catalogue has no entry for a
 * tool, the button says so.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { GLOSSARY, type LabToolCatalogue, type LabToolInfo } from "../lib/edward-lab";
import styles from "./edward-lab.module.css";

interface LabInfoContextValue {
  tools: LabToolCatalogue | null;
  toolsError: string | null;
  toolFor(name: string): LabToolInfo | null;
}

const LabInfoContext = createContext<LabInfoContextValue>({
  tools: null,
  toolsError: null,
  toolFor: () => null,
});

export function LabInfoProvider({
  assistantKind,
  children,
}: {
  assistantKind: "student" | "staff";
  children: ReactNode;
}) {
  const [tools, setTools] = useState<LabToolCatalogue | null>(null);
  const [toolsError, setToolsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/edward-lab/tools", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Tool catalogue unavailable (${response.status})`);
        }
        const body = (await response.json()) as LabToolCatalogue;
        if (!cancelled) setTools(body);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setToolsError(error instanceof Error ? error.message : "Tool catalogue unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toolFor = useCallback(
    (name: string): LabToolInfo | null => {
      if (!tools) return null;
      // Prefer the catalogue for the assistant this Lab drives, but a staff
      // trace can appear in the student Lab's recent list and vice versa.
      const primary = assistantKind === "staff" ? tools.staff : tools.student;
      const secondary = assistantKind === "staff" ? tools.student : tools.staff;
      return primary.find((tool) => tool.name === name) ??
        secondary.find((tool) => tool.name === name) ??
        null;
    },
    [tools, assistantKind],
  );

  return (
    <LabInfoContext.Provider value={{ tools, toolsError, toolFor }}>
      {children}
    </LabInfoContext.Provider>
  );
}

export function useLabInfo(): LabInfoContextValue {
  return useContext(LabInfoContext);
}

/**
 * A small ⓘ that toggles an anchored explanation. Click to open, click again
 * or press Escape to close; one open at a time per button, no hover timers.
 */
function InfoPopover({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={root} className={styles.infoRoot}>
      <button
        type="button"
        className={styles.infoButton}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        i
      </button>
      {open ? (
        <span id={id} role="dialog" aria-label={title} className={styles.infoPopover}>
          <span className={styles.infoTitle}>{title}</span>
          {children}
        </span>
      ) : null}
    </span>
  );
}

/** ⓘ for an architectural concept, from the glossary. */
export function Info({ concept }: { concept: keyof typeof GLOSSARY }) {
  const entry = GLOSSARY[concept];
  if (!entry) return null;
  return (
    <InfoPopover label={`What is ${entry.title}?`} title={entry.title}>
      <span className={styles.infoBody}>{entry.body}</span>
    </InfoPopover>
  );
}

/** A tool name with an ⓘ that shows what the planners are told about it. */
export function ToolName({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const { tools, toolsError, toolFor } = useLabInfo();
  const info = toolFor(name);
  const argumentNames = info?.arguments ? Object.keys(info.arguments) : [];
  return (
    <span className={styles.toolNameWithInfo}>
      <span className={className ?? styles.toolName}>{name}</span>
      <InfoPopover label={`What does ${name} read?`} title={name}>
        {info ? (
          <>
            <span className={styles.infoBody}>{info.description}</span>
            <span className={styles.infoMeta}>
              {info.informationClass ? (
                <span>
                  class <span className={styles.mono}>{info.informationClass}</span>
                </span>
              ) : null}
              <span>
                {info.arguments === null || info.arguments === undefined
                  ? "no arguments — identity bound server-side"
                  : argumentNames.length === 0
                    ? "no arguments"
                    : `arguments: ${argumentNames.join(", ")}`}
              </span>
            </span>
          </>
        ) : tools ? (
          <span className={styles.infoBody}>
            Not in either planner catalogue. This tool was executed but the model is never
            told about it (a pipeline-internal read).
          </span>
        ) : (
          <span className={styles.infoBody}>
            {toolsError ?? "Loading the tool catalogue…"}
          </span>
        )}
      </InfoPopover>
    </span>
  );
}
