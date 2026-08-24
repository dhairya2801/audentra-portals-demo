"use client";

import type {
  EdwardFeedbackListResponse,
  EdwardResponseFeedback,
} from "@vv/contracts";
import { type FormEvent, useEffect, useState } from "react";
import {
  type EdwardTurnTrace,
  fetchTraceWithRetry,
} from "../lib/edward-lab";
import { EdwardTraceInspector } from "./edward-trace-inspector";
import styles from "./edward-lab.module.css";

type FeedbackFilters = {
  search: string;
  rating: "" | "positive" | "negative" | "unrated";
  written: "" | "true" | "false";
  from: string;
  to: string;
};

const EMPTY_FILTERS: FeedbackFilters = {
  search: "",
  rating: "",
  written: "",
  from: "",
  to: "",
};

async function labFetch(url: string): Promise<Response> {
  return fetch(url, { headers: { accept: "application/json" } });
}

function feedbackStatus(item: EdwardResponseFeedback): string {
  if (item.rating === "positive") return "👍 Positive";
  if (item.rating === "negative") return "👎 Negative";
  return "✎ Written only";
}

function localTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function EdwardFeedbackLab({
  assistantKind,
}: {
  assistantKind: "student" | "staff";
}) {
  const [draftFilters, setDraftFilters] = useState<FeedbackFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<FeedbackFilters>(EMPTY_FILTERS);
  const [items, setItems] = useState<EdwardResponseFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EdwardResponseFeedback | null>(null);
  const [trace, setTrace] = useState<EdwardTurnTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [refreshRevision, setRefreshRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ assistantKind, limit: "100" });
    if (filters.search) query.set("search", filters.search);
    if (filters.rating) query.set("rating", filters.rating);
    if (filters.written) query.set("hasWritten", filters.written);
    if (filters.from) query.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
    if (filters.to) query.set("to", new Date(`${filters.to}T23:59:59.999`).toISOString());
    void labFetch(`/api/edward-lab/feedback?${query.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Feedback request failed (${response.status})`);
        return (await response.json()) as EdwardFeedbackListResponse;
      })
      .then((body) => {
        if (cancelled) return;
        setItems(body.items ?? []);
        setTotal(body.total ?? 0);
        setSelected((current) => {
          if (current) {
            const refreshed = body.items.find((item) => item.id === current.id);
            if (refreshed) return refreshed;
          }
          return body.items[0] ?? null;
        });
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Feedback could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assistantKind, filters, refreshRevision]);

  useEffect(() => {
    let cancelled = false;
    const loadTrace = async () => {
      await Promise.resolve();
      if (!selected) {
        if (!cancelled) setTrace(null);
        return;
      }
      setTraceLoading(true);
      setTrace(null);
      const loaded = await fetchTraceWithRetry(selected.traceId, labFetch, {
        attempts: 2,
      });
      if (!cancelled) {
        setTrace(loaded);
        setTraceLoading(false);
      }
    };
    void loadTrace();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFilters({ ...draftFilters, search: draftFilters.search.trim() });
  };

  const refresh = () => {
    setLoading(true);
    setError(null);
    setRefreshRevision((current) => current + 1);
  };

  return (
    <div className={styles.shell}>
      <section className={`card ${styles.feedbackIndex}`}>
        <div className={styles.sectionHead}>
          <div>
            <span className="eyebrow">User feedback</span>
            <p className={styles.feedbackCount}>{total} matching responses</p>
          </div>
          <button type="button" className={styles.copyButton} onClick={refresh}>
            Refresh
          </button>
        </div>
        <form className={styles.feedbackFilters} onSubmit={applyFilters}>
          <label>
            Search
            <input
              value={draftFilters.search}
              placeholder="Question, answer, comment, or user"
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
          </label>
          <label>
            Rating
            <select
              value={draftFilters.rating}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  rating: event.target.value as FeedbackFilters["rating"],
                }))
              }
            >
              <option value="">All ratings</option>
              <option value="negative">Negative</option>
              <option value="positive">Positive</option>
              <option value="unrated">No thumb</option>
            </select>
          </label>
          <label>
            Comment
            <select
              value={draftFilters.written}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  written: event.target.value as FeedbackFilters["written"],
                }))
              }
            >
              <option value="">Any</option>
              <option value="true">Written feedback</option>
              <option value="false">No comment</option>
            </select>
          </label>
          <label>
            From
            <input
              type="date"
              value={draftFilters.from}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, from: event.target.value }))
              }
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={draftFilters.to}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, to: event.target.value }))
              }
            />
          </label>
          <button type="submit">Apply</button>
        </form>
        {error ? (
          <p className={`${styles.failureBanner} ${styles.failureBannerError}`} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.feedbackList} aria-busy={loading}>
          {loading ? (
            <p className={styles.emptyState}>Loading feedback…</p>
          ) : items.length === 0 ? (
            <p className={styles.emptyState}>No feedback matches these filters.</p>
          ) : (
            items.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`${styles.feedbackRow} ${
                  selected?.id === item.id ? styles.feedbackRowActive : ""
                }`}
                onClick={() => setSelected(item)}
              >
                <span className={styles.feedbackRowHead}>
                  <strong>{feedbackStatus(item)}</strong>
                  <time dateTime={item.createdAt}>{localTimestamp(item.createdAt)}</time>
                </span>
                <span className={styles.feedbackQuestion}>{item.question}</span>
                <span className={styles.feedbackAnswer}>{item.response}</span>
                {item.writtenFeedback ? (
                  <span className={styles.feedbackComment}>“{item.writtenFeedback}”</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </section>
      <div className={styles.inspector}>
        {selected ? (
          <section className={`card ${styles.section}`}>
            <div className={styles.sectionHead}>
              <span className="eyebrow">Feedback context</span>
              <span className={styles.statusBadge}>{feedbackStatus(selected)}</span>
            </div>
            <dl className={styles.feedbackContext}>
              <div>
                <dt>User</dt>
                <dd>{selected.actorName ?? selected.actorId}</dd>
              </div>
              {selected.referencedStudentName ? (
                <div>
                  <dt>Student record</dt>
                  <dd>{selected.referencedStudentName}</dd>
                </div>
              ) : null}
              <div>
                <dt>Question</dt>
                <dd>{selected.question}</dd>
              </div>
              <div>
                <dt>Edward response</dt>
                <dd>{selected.response}</dd>
              </div>
              <div>
                <dt>Written feedback</dt>
                <dd>{selected.writtenFeedback ?? "—"}</dd>
              </div>
            </dl>
          </section>
        ) : null}
        {traceLoading ? (
          <section className={`card ${styles.section}`}>
            <p className={styles.emptyState}>Loading the exact Edward trace…</p>
          </section>
        ) : (
          <EdwardTraceInspector trace={trace} />
        )}
      </div>
    </div>
  );
}
