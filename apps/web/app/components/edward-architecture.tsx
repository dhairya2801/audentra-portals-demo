"use client";

/**
 * Edward Lab — the architecture map.
 *
 * One static picture of Edward's components in execution order (the "tech
 * tree"), lit up with the
 * route one trace actually took. Every node's state, order number and text
 * come from `routeFor(trace)`, which reads only what the trace records.
 * Hover a node to see what happened there; click to pin it.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  type EdwardTurnTrace,
  formatMs,
  formatTokens,
  modelCallLabel,
  ROUTE_NODES,
  type RouteNode,
  type RouteNodeDefinition,
  type RouteNodeId,
  roundLabel,
  routeFor,
  routeEdges,
  type TraceRoute,
  type TraceListEntry,
} from "../lib/edward-lab";
import { EdwardAnswerEvolution } from "./edward-answer-evolution";
import { Info, ToolName } from "./edward-lab-info";
import styles from "./edward-lab.module.css";

interface PickerEntry {
  traceId: string;
  label: string;
}

function definitionFor(id: RouteNodeId): RouteNodeDefinition {
  return ROUTE_NODES.find((node) => node.id === id)!;
}

function NodeButton({
  id,
  route,
  active,
  onHover,
  onPin,
}: {
  id: RouteNodeId;
  route: Map<RouteNodeId, RouteNode> | null;
  active: boolean;
  onHover(id: RouteNodeId | null): void;
  onPin(id: RouteNodeId): void;
}) {
  const definition = definitionFor(id);
  const node = route?.get(id) ?? null;
  const state = route ? (node?.state ?? "skipped") : "static";
  return (
    <button
      type="button"
      className={styles.archNode}
      data-route-node={id}
      data-state={state}
      data-active={active ? "true" : "false"}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
      onClick={() => onPin(id)}
      aria-pressed={active}
    >
      <span className={styles.archOrder} aria-hidden>
        {node?.orders.join(",") || "·"}
      </span>
      <span className={styles.archNodeTitle}>{definition.title}</span>
      <span
        className={`${styles.archNature} ${
          definition.nature === "deterministic" ? "" : styles.natureModel
        }`}
      >
        {definition.nature}
      </span>
      <span className={styles.archNodeHeadline}>
        {route ? (node?.headline ?? "Not on this turn's route.") : definition.summary}
      </span>
    </button>
  );
}

function Connector({ active }: { active: boolean }) {
  return <span className={styles.archConnector} data-active={active ? "true" : "false"} aria-hidden />;
}


function ArchitectureTree({ route, children }: { route: TraceRoute | null; children: React.ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const markerId = useId().replaceAll(":", "");
  const [paths, setPaths] = useState<Array<{ from: RouteNodeId; to: RouteNodeId; d: string }>>([]);
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      const next = (route ? routeEdges(route) : []).flatMap(edge => {
        const from = root.querySelector<HTMLElement>(`[data-route-node="${edge.from}"]`)?.getBoundingClientRect();
        const to = root.querySelector<HTMLElement>(`[data-route-node="${edge.to}"]`)?.getBoundingClientRect();
        if (!from || !to) return [];
        const x1 = from.left + from.width / 2 - bounds.left;
        const y1 = from.bottom - bounds.top;
        const x2 = to.left + to.width / 2 - bounds.left;
        const y2 = to.top - bounds.top;
        // Bypasses/fallbacks travel along an outer rail instead of lighting
        // connectors through components that did not execute.
        const direct = y2 >= y1 && y2 - y1 < 85;
        const rail = bounds.width - 3;
        const d = direct
          ? `M ${x1} ${y1} C ${x1} ${(y1+y2)/2}, ${x2} ${(y1+y2)/2}, ${x2} ${y2 - 3}`
          : `M ${from.right-bounds.left} ${from.top+from.height/2-bounds.top} H ${rail} V ${to.top+to.height/2-bounds.top} H ${to.right-bounds.left+3}`;
        return [{ ...edge, d }];
      });
      setPaths(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    for (const node of root.querySelectorAll<HTMLElement>("[data-route-node]")) observer.observe(node);
    return () => observer.disconnect();
  }, [route]);
  return <div ref={container} className={styles.archTree}>
    <svg className={styles.archPaths} aria-label="Recorded hot path">
      <defs><marker id={markerId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" />
      </marker></defs>
      {paths.map(edge => <path key={`${edge.from}-${edge.to}`} data-from={edge.from} data-to={edge.to}
        d={edge.d} fill="none" stroke="currentColor" strokeWidth="2" markerEnd={`url(#${markerId})`}>
        <title>{definitionFor(edge.from).title} → {definitionFor(edge.to).title}</title>
      </path>)}
    </svg>
    {children}
  </div>;
}

function Stack({
  ids,
  route,
  active,
  onHover,
  onPin,
}: {
  ids: RouteNodeId[];
  route: Map<RouteNodeId, RouteNode> | null;
  active: RouteNodeId | null;
  onHover(id: RouteNodeId | null): void;
  onPin(id: RouteNodeId): void;
}) {
  return (
    <div className={styles.archStack}>
      {ids.map((id, index) => (
        <div key={id} className={styles.archStack}>
          {index > 0 ? (
            <Connector active={false} />
          ) : null}
          <NodeButton
            id={id}
            route={route}
            active={active === id}
            onHover={onHover}
            onPin={onPin}
          />
        </div>
      ))}
    </div>
  );
}

function DetailPanel({
  id,
  route,
  trace,
}: {
  id: RouteNodeId | null;
  route: Map<RouteNodeId, RouteNode> | null;
  trace: EdwardTurnTrace | null;
}) {
  if (!id) {
    return (
      <section className={`card ${styles.archDetail}`}>
        <span className="eyebrow">Component</span>
        <p className={styles.emptyState}>
          {trace
            ? "Hover a component to see what it did on this turn; click to pin it."
            : "Hover a component to read what it does. Send a question (or pick a trace) to light up the route a turn took."}
        </p>
      </section>
    );
  }
  const definition = definitionFor(id);
  const node = route?.get(id) ?? null;
  return (
    <section className={`card ${styles.archDetail}`}>
      <div className={styles.archDetailHead}>
        <h3>{definition.title}</h3>
        <Info concept={definition.glossary} />
        <span
          className={`${styles.archNature} ${
            definition.nature === "deterministic" ? "" : styles.natureModel
          }`}
        >
          {definition.nature}
        </span>
        {node?.order ? (
          <span className={styles.kindBadge}>step {node.orders.join(", ")}</span>
        ) : trace ? (
          <span className={styles.kindBadge}>not on route</span>
        ) : null}
      </div>
      <p className={styles.archDetailSummary}>{definition.summary}</p>
      {trace && node?.order ? <p className={styles.archHelp}>
        {(() => {
          const ordered = [...(route?.values() ?? [])].flatMap(item => item.orders.map(order => ({ id: item.id, order }))).sort((a, b) => a.order - b.order);
          return ordered.flatMap((item, index) => item.id === id ? [
            `Step ${item.order}: ${index > 0 ? definitionFor(ordered[index - 1]!.id).title : "Request"} → ${definition.title} → ${ordered[index + 1] ? definitionFor(ordered[index + 1]!.id).title : "Response returned"}`
          ] : []).join("; ");
        })()}
      </p> : null}
      {trace && node ? (
        <>
          <p className={styles.archDetailHeadline} data-state={node.state}>
            {node.headline}
          </p>
          {["compose", "rewrite", "guard", "answer"].includes(id) && node.order ? (
            <EdwardAnswerEvolution trace={trace} draftOnly={id === "compose"} />
          ) : null}
          {node.details.length > 0 ? (
            <dl className={styles.archDetailList}>
              {node.details.map((detail, index) => (
                <div key={`${detail.label}-${index}`} style={{ display: "contents" }}>
                  <dt>{detail.label}</dt>
                  <dd
                    className={
                      detail.tone === "ok"
                        ? styles.toneOk
                        : detail.tone === "warn"
                          ? styles.toneWarn
                          : detail.tone === "bad"
                            ? styles.toneBad
                            : undefined
                    }
                  >
                    {detail.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {node.toolCalls.length > 0 ? (
            <>
              <p className={styles.archSubhead}>
                Tool calls ({node.toolCalls.length})
              </p>
              {node.toolCalls.map((call, index) => (
                <details key={`${call.tool}-${index}`} className={styles.compactCall}>
                  <summary
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0,1fr) auto",
                      gap: "0.6rem",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      className={call.status === "available" ? styles.okDot : styles.failDot}
                      aria-hidden
                    />
                    <ToolName name={call.tool} />
                    <span className={styles.turnMeta}>
                      {roundLabel(call.round)} · {call.status}
                      {call.durationMs != null ? ` · ${formatMs(call.durationMs)}` : ""}
                      {call.recordCount != null ? ` · ${call.recordCount} rec` : ""}
                    </span>
                  </summary>
                  <span className={styles.compactCallMeta}>
                    {call.reason ? <span>reason: {call.reason}</span> : null}
                    {call.arguments !== undefined ? (
                      <span className={styles.mono}>args {JSON.stringify(call.arguments)}</span>
                    ) : null}
                  </span>
                  {call.modelResult !== undefined ? <details>
                    <summary>Evidence sent to the planner (sanitized)</summary>
                    <pre className={styles.quoteBlock} style={{ maxHeight: "14rem", overflow: "auto" }}>{JSON.stringify(call.modelResult, null, 2)}</pre>
                  </details> : null}
                  {call.result !== undefined ? (
                    <pre
                      className={styles.quoteBlock}
                      style={{ maxHeight: "14rem", overflow: "auto", margin: 0 }}
                    >
                      {JSON.stringify(call.result, null, 2)}
                    </pre>
                  ) : null}
                </details>
              ))}
            </>
          ) : null}
          {node.modelCalls.length > 0 ? (
            <>
              <p className={styles.archSubhead}>
                Model calls ({node.modelCalls.length})
              </p>
              {node.modelCalls.map((call, index) => (
                <div key={`${call.operation}-${index}`} className={styles.compactCall}>
                  <span
                    className={
                      call.outcome === "accepted" || call.outcome === "step" || call.outcome === "recognized"
                        ? styles.okDot
                        : styles.failDot
                    }
                    aria-hidden
                  />
                  <span className={styles.toolName}>
                    {modelCallLabel(call.operation)} · attempt {call.attempt}
                  </span>
                  <span className={styles.turnMeta}>{call.outcome}</span>
                  <span className={styles.compactCallMeta}>
                    <span>{call.model ?? call.provider ?? "model n/a"}</span>
                    <span>{formatMs(call.durationMs)}</span>
                    <span>
                      {call.usage
                        ? `${formatTokens(call.usage.promptTokens)} → ${formatTokens(
                            call.usage.completionTokens,
                          )} tokens`
                        : "usage n/a"}
                    </span>
                    {call.detail ? <span>{call.detail}</span> : null}
                  </span>
                </div>
              ))}
            </>
          ) : null}
          {node.notes.length > 0 ? (
            <>
              <p className={styles.archSubhead}>Recorded notes and output</p>
              {node.notes.map((note, index) => (
                <div key={`${note.label}-${index}`} className={styles.archNote}>
                  <span className={styles.archNoteLabel}>{note.label}</span>
                  <span>{note.text}</span>
                </div>
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function EdwardArchitecture({
  assistantKind,
  trace,
  choices,
  selectedTraceId,
  onSelectTrace,
}: {
  assistantKind: "student" | "staff";
  trace: EdwardTurnTrace | null;
  /** Traces the viewer can switch between (this session's turns, then recent). */
  choices: PickerEntry[];
  selectedTraceId: string | null;
  onSelectTrace(traceId: string): void;
}) {
  const [hovered, setHovered] = useState<RouteNodeId | null>(null);
  // The pin is scoped to one trace: remember which trace it was set on, so a
  // new trace never shows a stale node without needing an effect.
  const [pin, setPin] = useState<{ traceId: string | null; id: RouteNodeId } | null>(null);
  const pinned = pin && pin.traceId === (trace?.traceId ?? null) ? pin.id : null;

  const tracedRoute = useMemo(() => trace ? routeFor(trace) : null, [trace]);
  const route = useMemo(() => {
    if (!trace) return null;
    const map = new Map<RouteNodeId, RouteNode>();
    for (const node of tracedRoute!.nodes) map.set(node.id, node);
    return map;
  }, [trace, tracedRoute]);

  const active = pinned ?? hovered ?? (trace ? "answer" : null);
  const staff = assistantKind === "staff";
  const readPlaneTop: RouteNodeId[] = staff
    ? ["identity", "entities", "classifier"]
    : ["classifier"];
  const onPin = (id: RouteNodeId) =>
    setPin((current) =>
      current && current.id === id && current.traceId === (trace?.traceId ?? null)
        ? null
        : { traceId: trace?.traceId ?? null, id },
    );

  return (
    <div className={styles.archShell}>
      <section className={`card ${styles.archMap}`}>
        <div className={styles.archTop}>
          <div className={styles.archPicker}>
            <span className="eyebrow">Route of</span>
            <select
              value={selectedTraceId ?? ""}
              onChange={(event) => {
                if (event.target.value) onSelectTrace(event.target.value);
              }}
              aria-label="Trace to show on the map"
            >
              <option value="" disabled>
                {choices.length === 0 ? "No traces yet — send a question" : "Pick a trace…"}
              </option>
              {choices.map((choice) => (
                <option key={choice.traceId} value={choice.traceId}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.archLegend}>
            <span>
              <span className={styles.archLegendSwatch} data-state="hot" /> did work
            </span>
            <span>
              <span className={styles.archLegendSwatch} data-state="passed" /> ran, passed through
            </span>
            <span>
              <span className={styles.archLegendSwatch} data-state="ended" /> produced the answer
            </span>
            <span>
              <span className={styles.archLegendSwatch} data-state="skipped" /> not on this route
            </span>
            <span>numbers = visits in order; model rounds are grouped</span>
          </div>
        </div>

        <p className={styles.archHelp}>
          {trace ? "Highlighted arrows follow this trace, including skipped components and fallbacks. Dimmed blocks did not run or were not recorded." : "Choose a trace to highlight its route through the architecture."}
          {" "}Click a block to pin its details; click it again to unpin.
        </p>
        <ArchitectureTree route={tracedRoute}>
        <Stack
          ids={["message", "gates", "recognizer"]}
          route={route}
          active={active}
          onHover={setHovered}
          onPin={onPin}
        />
        <Connector active={false} />

        <div className={styles.archPlanes}>
          <div className={styles.archLane}>
            <span className={styles.archLaneTitle}>
              Write plane <Info concept="action_gateway" />
            </span>
            <Stack
              ids={["action_gateway", "boundary"]}
              route={route}
              active={active}
              onHover={setHovered}
              onPin={onPin}
            />
          </div>

          <div className={styles.archLane}>
            <span className={styles.archLaneTitle}>
              Read plane <Info concept="read_planner" />
              {trace?.readPlanner ? (
                <span className={styles.kindBadge}>planner: {trace.readPlanner}</span>
              ) : null}
            </span>
            <Stack
              ids={readPlaneTop}
              route={route}
              active={active}
              onHover={setHovered}
              onPin={onPin}
            />
            <Connector active={false} />
            <div className={styles.archBranch}>
              <div className={styles.archStack}>
                <span className={styles.archBranchLabel}>
                  deterministic / hybrid mode → classified reads
                </span>
                <Stack
                  ids={["model_planner", "tool_reads", "compose", "rewrite"]}
                  route={route}
                  active={active}
                  onHover={setHovered}
                  onPin={onPin}
                />
              </div>
              <div className={styles.archStack}>
                <span className={styles.archBranchLabel}>
                  model mode / hybrid fallback → model loop
                </span>
                <Stack
                  ids={["read_loop"]}
                  route={route}
                  active={active}
                  onHover={setHovered}
                  onPin={onPin}
                />
              </div>
            </div>
            <Connector active={false} />
            <Stack
              ids={["guard"]}
              route={route}
              active={active}
              onHover={setHovered}
              onPin={onPin}
            />
          </div>
        </div>

        <Connector active={false} />
        <Stack
          ids={["presentation", "answer"]}
          route={route}
          active={active}
          onHover={setHovered}
          onPin={onPin}
        />
        </ArchitectureTree>
        {trace ? <details className={styles.compactCall}>
          <summary>Recorded stage log ({trace.stages?.length ?? 0})</summary>
          <ol>{(trace.stages ?? []).map((stage, index) => <li key={`${stage.stage}-${index}`}>
            <code>{stage.stage}</code> · {formatMs(stage.durationMs)}
            <pre className={styles.quoteBlock}>{JSON.stringify(stage, null, 2)}</pre>
          </li>)}</ol>
          <p className={styles.archHelp}>Stages may include nested work; durations are not additive. Planner notes are recorded summaries, not hidden chain-of-thought.</p>
        </details> : null}
      </section>

      <DetailPanel id={active} route={route} trace={trace} />
    </div>
  );
}

/** Build the picker list from this session's turns first, then recent traces. */
export function architectureChoices(
  turns: Array<{ index: number; question: string; requestId: string | null }>,
  recent: TraceListEntry[],
): PickerEntry[] {
  const seen = new Set<string>();
  const out: PickerEntry[] = [];
  for (const turn of [...turns].reverse()) {
    if (!turn.requestId || seen.has(turn.requestId)) continue;
    seen.add(turn.requestId);
    out.push({ traceId: turn.requestId, label: `#${turn.index} · ${turn.question}` });
  }
  for (const entry of recent) {
    if (seen.has(entry.traceId)) continue;
    seen.add(entry.traceId);
    out.push({
      traceId: entry.traceId,
      label: `${entry.startedAt?.slice(11, 19) ?? ""} · ${entry.userMessage || "(no message)"}`,
    });
  }
  return out;
}
