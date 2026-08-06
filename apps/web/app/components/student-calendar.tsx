"use client";

import { useId, useMemo, useState } from "react";
import {
  buildStudentCalendarMonth,
  defaultStudentCalendarMonth,
  shiftCalendarMonth,
  type StudentCalendarEntry,
  type StudentCalendarEntryKind,
} from "../lib/student-calendar";
import { safePortalDestination } from "../lib/safe-destination";
import { TenantLink as Link } from "./tenant-link";
import styles from "./student-calendar.module.css";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const kindLabels: Record<StudentCalendarEntryKind, string> = {
  enrollment: "Enrollment",
  campus: "Campus life",
  financial: "Financial aid",
  payment: "Payments",
};

function entryDateLabel(entry: StudentCalendarEntry) {
  const options: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  };
  const hasTime =
    entry.startsAt.includes("T") &&
    !/T00:00(?::00(?:\.\d+)?)?(?:Z|[+-]00:00)?$/.test(entry.startsAt);
  if (hasTime) {
    options.hour = "numeric";
    options.minute = "2-digit";
  }
  const start = new Intl.DateTimeFormat("en-US", options).format(
    new Date(entry.startsAt),
  );
  if (!entry.endsAt) return start;
  const end = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(entry.endsAt));
  return `${start}–${end}`;
}

function CalendarAction({ entry }: { entry: StudentCalendarEntry }) {
  const fallback =
    entry.kind === "campus"
      ? "/campus-life"
      : entry.kind === "enrollment"
        ? "/enrollment"
        : "/financials";
  const destination = safePortalDestination(entry.href, fallback);
  if (destination.external) {
    return (
      <a href={destination.href} target="_blank" rel="noreferrer">
        {entry.actionLabel} <span aria-hidden="true">↗</span>
      </a>
    );
  }
  return (
    <Link href={destination.href}>
      {entry.actionLabel} <span aria-hidden="true">→</span>
    </Link>
  );
}

export function StudentCalendar({
  entries,
  initialMonth,
  title = "Your student calendar",
}: {
  entries: readonly StudentCalendarEntry[];
  initialMonth?: Date;
  title?: string;
}) {
  const [displayedMonth, setDisplayedMonth] = useState(() =>
    initialMonth ?? defaultStudentCalendarMonth(entries),
  );
  const titleId = useId();
  const month = useMemo(
    () => buildStudentCalendarMonth(entries, displayedMonth),
    [displayedMonth, entries],
  );
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [expandedDayKeys, setExpandedDayKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const gridEntries = month.days.flatMap((day) => day.entries);
  const selectedEntry =
    gridEntries.find((entry) => entry.id === selectedEntryId) ??
    month.entries[0] ??
    null;
  const selectedId = selectedEntry?.id ?? null;
  const visibleKinds = (
    Object.entries(kindLabels) as Array<[StudentCalendarEntryKind, string]>
  ).filter(([kind]) => entries.some((entry) => entry.kind === kind));

  return (
    <section className={styles.calendar} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div>
          <p>Dates that move your semester forward</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className={styles.controls} aria-label="Calendar month controls">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              setDisplayedMonth((current) => shiftCalendarMonth(current, -1))
            }
          >
            ←
          </button>
          <button
            className={styles.todayButton}
            type="button"
            onClick={() => setDisplayedMonth(new Date())}
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() =>
              setDisplayedMonth((current) => shiftCalendarMonth(current, 1))
            }
          >
            →
          </button>
        </div>
      </header>

      {visibleKinds.length > 0 ? (
        <div className={styles.legend} aria-label="Calendar legend">
          {visibleKinds.map(([kind, label]) => (
          <span key={kind}>
            <i className={styles[kind]} aria-hidden="true" />
            {label}
          </span>
          ))}
        </div>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.month}>
          <div className={styles.monthLabel} aria-live="polite">
            <strong>{month.label}</strong>
            <span>
              {month.entries.length} scheduled item
              {month.entries.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className={styles.grid} role="group" aria-label={month.label}>
            {weekdays.map((weekday) => (
              <div className={styles.weekday} aria-hidden="true" key={weekday}>
                {weekday}
              </div>
            ))}
            {month.days.map((day) => (
              <div
                className={`${styles.day}${
                  day.inDisplayedMonth ? "" : ` ${styles.outside}`
                }${day.isToday ? ` ${styles.currentDay}` : ""}`}
                role="group"
                aria-label={`${new Intl.DateTimeFormat("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  timeZone: "UTC",
                }).format(day.date)}, ${day.entries.length} items`}
                key={day.key}
              >
                <time dateTime={day.key}>{day.dayNumber}</time>
                <div className={styles.dayEntries}>
                  {day.entries
                    .slice(0, expandedDayKeys.has(day.key) ? undefined : 3)
                    .map((entry) => (
                    <button
                      className={`${styles.entry} ${styles[entry.kind]}${
                        selectedId === entry.id ? ` ${styles.selected}` : ""
                      }`}
                      type="button"
                      aria-pressed={selectedId === entry.id}
                      title={entry.title}
                      onClick={() => setSelectedEntryId(entry.id)}
                      key={entry.id}
                    >
                      {entry.title}
                    </button>
                    ))}
                  {day.entries.length > 3 ? (
                    <button
                      className={styles.more}
                      type="button"
                      aria-expanded={expandedDayKeys.has(day.key)}
                      onClick={() => {
                        setExpandedDayKeys((current) => {
                          const next = new Set(current);
                          if (next.has(day.key)) next.delete(day.key);
                          else next.add(day.key);
                          return next;
                        });
                      }}
                    >
                      {expandedDayKeys.has(day.key)
                        ? "Show fewer"
                        : `+${day.entries.length - 3} more`}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className={styles.detail} aria-live="polite">
          {selectedEntry ? (
            <>
              <div className={styles.detailType}>
                <i className={styles[selectedEntry.kind]} aria-hidden="true" />
                {kindLabels[selectedEntry.kind]}
              </div>
              <p className={styles.detailDate}>{entryDateLabel(selectedEntry)}</p>
              <h3>{selectedEntry.title}</h3>
              <p>{selectedEntry.description}</p>
              {selectedEntry.location ? (
                <p className={styles.detailMeta}>
                  <span aria-hidden="true">⌖</span> {selectedEntry.location}
                </p>
              ) : null}
              {selectedEntry.status ? (
                <span className={styles.status}>
                  {selectedEntry.status.replaceAll("_", " ")}
                </span>
              ) : null}
              <CalendarAction entry={selectedEntry} />
            </>
          ) : (
            <div className={styles.emptyDetail}>
              <span aria-hidden="true">◇</span>
              <h3>No dated items this month</h3>
              <p>Use the arrows to look ahead at your important dates.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
