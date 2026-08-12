"use client";

/**
 * Edward Lab — developer trace dashboard.
 *
 * Left: the real EdwardAssistant (the exact component students use) against
 * the real Python Edward API. Right: the live AssistantTurnTrace inspector.
 * Every completed turn's requestId is captured via the component's dev-only
 * onTurn observer and its trace is fetched automatically through the
 * same-origin /api/edward-lab proxy (which holds the internal credential
 * server-side — the browser never sees a worker token).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type EdwardTurnTrace,
  fetchTraceWithRetry,
  formatMs,
  summarizeTrace,
  type TraceListEntry,
} from "../lib/edward-lab";
import { EdwardAssistant, type EdwardTurnEvent } from "./edward-assistant";
import { EdwardTraceInspector } from "./edward-trace-inspector";
import styles from "./edward-lab.module.css";

interface LabPersona {
  name: string;
  label: string;
}

interface LabTurn {
  index: number;
  question: string;
  answer: string;
  requestId: string | null;
  latencyMs: number;
  status: "ok" | "error" | "no_trace";
}

async function labFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, headers: { accept: "application/json" } });
}

export function EdwardLab() {
  const [personas, setPersonas] = useState<LabPersona[]>([]);
  const [personaSupported, setPersonaSupported] = useState<boolean | null>(null);
  const [activePersona, setActivePersona] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("Alex");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [chatEpoch, setChatEpoch] = useState(0);
  const [turns, setTurns] = useState<LabTurn[]>([]);
  const [traces, setTraces] = useState<Record<string, EdwardTurnTrace>>({});
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [recent, setRecent] = useState<TraceListEntry[]>([]);
  const [labError, setLabError] = useState<string | null>(null);
  const turnCounter = useRef(0);

  const refreshRecent = useCallback(() => {
    labFetch("/api/edward-lab/traces?limit=20")
      .then(async (response) => {
        if (response.ok) {
          const body = (await response.json()) as { traces?: TraceListEntry[] };
          setRecent(body.traces ?? []);
        }
      })
      .catch(() => {
        // recent list is best-effort
      });
  }, []);

  useEffect(() => {
    labFetch("/api/edward-lab/personas")
      .then(async (response) => {
        if (!response.ok) {
          setPersonaSupported(false);
          if (response.status === 502 || response.status === 503) {
            const body = (await response.json().catch(() => null)) as {
              error?: { message?: string };
            } | null;
            setLabError(body?.error?.message ?? "Lab proxy unavailable");
          }
          return;
        }
        const body = (await response.json()) as {
          supported?: boolean;
          active?: string | null;
          student?: { preferredName?: string; studentId?: string } | null;
          personas?: LabPersona[];
        };
        setPersonaSupported(Boolean(body.supported));
        setPersonas(body.personas ?? []);
        if (body.active) setActivePersona(body.active);
        if (body.student?.preferredName) setStudentName(body.student.preferredName);
        if (body.student?.studentId) setStudentId(body.student.studentId);
      })
      .catch(() => {
        setPersonaSupported(false);
      });
    refreshRecent();
  }, [refreshRecent]);

  const selectTrace = useCallback(
    async (traceId: string) => {
      setSelectedTraceId(traceId);
      if (traces[traceId]) return;
      const trace = await fetchTraceWithRetry(traceId, labFetch, { attempts: 2 });
      if (trace) setTraces((current) => ({ ...current, [traceId]: trace }));
    },
    [traces],
  );

  const onTurn = useCallback(
    (turn: EdwardTurnEvent) => {
      const index = ++turnCounter.current;
      const requestId = turn.response?.requestId ?? null;
      setTurns((current) => [
        ...current,
        {
          index,
          question: turn.question,
          answer: turn.response?.message ?? (turn.error ?? ""),
          requestId,
          latencyMs: turn.latencyMs,
          status: turn.error ? "error" : requestId ? "ok" : "no_trace",
        },
      ]);
      if (requestId) {
        setSelectedTraceId(requestId);
        void fetchTraceWithRetry(requestId, labFetch).then((trace) => {
          if (trace) {
            setTraces((current) => ({ ...current, [requestId]: trace }));
          } else {
            setTurns((current) =>
              current.map((item) =>
                item.requestId === requestId ? { ...item, status: "no_trace" } : item,
              ),
            );
          }
          refreshRecent();
        });
      } else {
        refreshRecent();
      }
    },
    [refreshRecent],
  );

  const switchPersona = useCallback(
    async (name: string) => {
      if (!name || switching) return;
      setSwitching(true);
      setLabError(null);
      try {
        const response = await labFetch(`/api/edward-lab/personas/${name}`, {
          method: "POST",
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          setLabError(body?.error?.message ?? `Persona switch failed (${response.status})`);
          return;
        }
        const body = (await response.json()) as {
          active: string;
          student?: { preferredName?: string; studentId?: string };
        };
        setActivePersona(body.active);
        if (body.student?.preferredName) setStudentName(body.student.preferredName);
        if (body.student?.studentId) setStudentId(body.student.studentId);
        // A persona switch is a different student state: reset the chat and
        // the turn timeline so nothing from the previous student lingers.
        setTurns([]);
        setSelectedTraceId(null);
        turnCounter.current = 0;
        setChatEpoch((epoch) => epoch + 1);
        try {
          window.sessionStorage.clear();
        } catch {
          // storage may be unavailable; the epoch key still remounts the chat
        }
      } finally {
        setSwitching(false);
      }
    },
    [switching],
  );

  const selectedTrace = selectedTraceId ? (traces[selectedTraceId] ?? null) : null;

  return (
    <>
      <header className={styles.topBar}>
        <h1>Edward Lab</h1>
        <span className={styles.devBadge}>Developer tool</span>
        <div className={styles.personaControls}>
          {personaSupported ? (
            <>
              <label htmlFor="edward-lab-persona">Student state</label>
              <select
                id="edward-lab-persona"
                value={activePersona}
                disabled={switching}
                onChange={(event) => void switchPersona(event.target.value)}
              >
                <option value="" disabled>
                  Select a persona…
                </option>
                {personas.map((persona) => (
                  <option key={persona.name} value={persona.name}>
                    {persona.label}
                  </option>
                ))}
              </select>
              <span className={styles.personaMeta}>
                {studentName}
                {studentId ? (
                  <>
                    {" · "}
                    <span className={styles.mono}>{studentId.slice(0, 13)}…</span>
                  </>
                ) : null}
                {activePersona ? ` · ${activePersona}` : ""}
              </span>
            </>
          ) : personaSupported === false ? (
            <span className={styles.personaMeta}>
              Persona switching unavailable on this backend (Postgres stack serves its seeded
              student). Run `audentra-eval-api` for switchable states.
            </span>
          ) : null}
        </div>
      </header>
      {labError ? (
        <div className={`${styles.failureBanner} ${styles.failureBannerError}`} role="alert">
          {labError}
        </div>
      ) : null}
      <div className={styles.shell}>
        <div className={styles.chatColumn}>
          <section className={`card ${styles.chatCard}`}>
            <EdwardAssistant
              key={`${activePersona}:${chatEpoch}`}
              studentName={studentName}
              variant="embedded"
              onTurn={onTurn}
            />
          </section>
          <section className="card">
            <div className={styles.timelineTitle}>
              <span className="eyebrow">Conversation timeline</span>
              <span className={styles.turnMeta}>{turns.length} turns</span>
            </div>
            <div className={styles.timeline}>
              {turns.length === 0 ? (
                <p className={styles.emptyState}>Turns you send appear here.</p>
              ) : (
                [...turns].reverse().map((turn) => {
                  const trace = turn.requestId ? traces[turn.requestId] : null;
                  const summary = trace ? summarizeTrace(trace) : null;
                  return (
                    <button
                      key={turn.index}
                      type="button"
                      className={`${styles.turnRow} ${
                        turn.requestId && turn.requestId === selectedTraceId
                          ? styles.turnRowActive
                          : ""
                      }`}
                      onClick={() => {
                        if (turn.requestId) void selectTrace(turn.requestId);
                      }}
                    >
                      <span className={styles.turnIndex}>#{turn.index}</span>
                      <span className={styles.turnQuestion}>{turn.question}</span>
                      <span className={styles.turnMeta}>
                        {turn.status === "error"
                          ? "✗ error"
                          : summary
                            ? `${formatMs(summary.durationMs)} · ${summary.toolCount} tools · ${summary.statusLabel}`
                            : turn.status === "no_trace"
                              ? "trace unavailable"
                              : `${formatMs(turn.latencyMs)} · trace…`}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
        <div className={styles.inspector}>
          <EdwardTraceInspector trace={selectedTrace} />
          <section className={`card ${styles.section}`}>
            <div className={styles.sectionHead}>
              <span className="eyebrow">Recent traces</span>
              <button
                type="button"
                className={styles.copyButton}
                onClick={() => refreshRecent()}
              >
                Refresh
              </button>
            </div>
            <div className={styles.recentList}>
              {recent.length === 0 ? (
                <p className={styles.emptyState}>No traces recorded on this backend yet.</p>
              ) : (
                recent.map((entry) => (
                  <button
                    key={entry.traceId}
                    type="button"
                    className={`${styles.recentRow} ${
                      entry.traceId === selectedTraceId ? styles.recentRowActive : ""
                    }`}
                    onClick={() => void selectTrace(entry.traceId)}
                  >
                    <span className={styles.recentQuestion}>
                      {entry.userMessage || "(no message)"}
                    </span>
                    <span className={styles.turnMeta}>
                      {entry.failureCodes?.length ? "⚠" : "✓"}
                    </span>
                    <span className={styles.recentMeta}>
                      <span>{entry.startedAt?.slice(11, 19) ?? ""}</span>
                      <span className={styles.mono}>{entry.requestType ?? entry.path}</span>
                      <span>{formatMs(entry.durationMs)}</span>
                      <span>{entry.executedTools?.length ?? 0} tools</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
