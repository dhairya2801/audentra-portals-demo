"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  StaffActionCenterQuery,
  StaffStudentOperation,
  StaffStudentRecord,
  StaffWorkItem,
  StudentDocument,
  UniversityRecord,
} from "@vv/contracts";
import {
  getDemoPersonas,
  getStaffActionCenter,
  getStaffDocumentContent,
  getStaffStudentRecord,
  getUniversityRecord,
  searchStaffStudents,
} from "../lib/api-client";
import { useApiResource } from "../hooks/use-api-resource";
import { useServerStateCoordinator } from "../components/server-state-provider";
import { UniversityRecordPanel } from "../components/university-record";
import { Student360Summary } from "./student360-summary";
import styles from "./student360.module.css";

type Student = StaffStudentOperation;
const tabs = [
  "Overview",
  "Application",
  "Enrollment",
  "Financials",
  "Academics",
  "Campus Life",
  "Timeline",
  "Comments",
  "Messages",
  "Documents",
] as const;
type Tab = (typeof tabs)[number];
const applicationTabs = [
  "Overview",
  "Application details",
  "Education history",
  "Application requirements",
  "Program alignment",
  "Application journey",
] as const;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
const human = (value: string) => value.replaceAll("_", " ");
const date = (value?: string | null) =>
  !value || Number.isNaN(Date.parse(value))
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      }).format(new Date(value));
const readiness = (student: Student) =>
  student.journey.totalTasks
    ? Math.round(
        (student.journey.completedTasks / student.journey.totalTasks) * 100,
      )
    : 0;
// Deliberately isolated presentation previews; never used for platform decisions or mutations.
const previewRisk = (student: Student) =>
  18 +
  (Array.from(student.id).reduce(
    (sum, letter) => sum + letter.charCodeAt(0),
    0,
  ) %
    67);
const riskLabel = (value: number) =>
  value >= 75
    ? "Critical"
    : value >= 60
      ? "High"
      : value >= 30
        ? "Medium"
        : "Low";
const blocked = (student: Student) =>
  student.attention.signals.some(
    (signal) =>
      signal.code === "blocking_requirements_open" && signal.count > 0,
  );
const inactive = (student: Student) =>
  Date.now() - Date.parse(student.journey.lastActivityAt) >= 7 * 86400000;
function Badge({
  children,
  tone = "quiet",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}
function Ring({ value, green = false }: { value: number; green?: boolean }) {
  return (
    <span
      className={styles.ring}
      style={
        {
          "--value": `${value}%`,
          "--ring-color": green ? "#26ae93" : "#7049ef",
        } as CSSProperties
      }
    >
      <b>{value}%</b>
    </span>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <div
      className={styles.progress}
      role="meter"
      aria-label="Enrollment completion"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
function Card({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.card} ${className}`}>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className={styles.facts}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || "Not recorded"}</dd>
        </div>
      ))}
    </dl>
  );
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.empty}>
      <span aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Navigation({
  options,
  active,
  onSelect,
  label,
  secondary = false,
}: {
  options: readonly string[];
  active: string;
  onSelect: (value: string) => void;
  label: string;
  secondary?: boolean;
}) {
  return (
    <nav className={secondary ? styles.subnav : styles.tabs} aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option}
          aria-current={active === option ? "page" : undefined}
          onClick={() => onSelect(option)}
        >
          {option}
        </button>
      ))}
    </nav>
  );
}

export function StudentsView({
  refresh,
  openTaskBoard,
  openWorkItem,
  initialStudentId,
  initialQuery,
  subscribeToRealtimeInvalidation,
}: {
  refresh: () => void;
  openTaskBoard: (query: StaffActionCenterQuery) => void;
  openWorkItem: (id: string) => void;
  initialStudentId: string | null;
  initialQuery: string;
  subscribeToRealtimeInvalidation: (invalidate: () => void) => () => void;
}) {
  const { requestRefresh } = useServerStateCoordinator();
  const invalidate = useCallback(
    () => requestRefresh("record_changed"),
    [requestRefresh],
  );
  useEffect(
    () => subscribeToRealtimeInvalidation(invalidate),
    [subscribeToRealtimeInvalidation, invalidate],
  );
  useEffect(() => {
    // Recover missed events while the directory or an individual record is open.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine)
        invalidate();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [invalidate]);
  const personas = useApiResource(
    useCallback((signal: AbortSignal) => getDemoPersonas(signal), []),
    { refreshOnAmbient: false },
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialStudentId);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  const [program, setProgram] = useState("");
  const [stage, setStage] = useState("");
  const [risk, setRisk] = useState("");
  const [sort, setSort] = useState("risk");
  const [view, setView] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const search = useApiResource(
    useCallback(
      (signal: AbortSignal) =>
        searchStaffStudents({ query: debouncedQuery, limit: 200 }, signal),
      [debouncedQuery],
    ),
  );
  const results = useMemo(() => search.data?.items ?? [], [search.data]);
  const pinned = useApiResource(
    useCallback(
      (signal: AbortSignal) =>
        selectedId
          ? searchStaffStudents({ studentId: selectedId, limit: 1 }, signal)
          : Promise.resolve(null),
      [selectedId],
    ),
  );
  const student =
    results.find((item) => item.id === selectedId) ??
    pinned.data?.items.find((item) => item.id === selectedId);
  const filtered = useMemo(
    () =>
      results
        .filter(
          (item) =>
            (!program || item.programName === program) &&
            (!stage || item.journey.stage === stage) &&
            (!risk || riskLabel(previewRisk(item)) === risk) &&
            (view !== "risk" || previewRisk(item) >= 60) &&
            (view !== "blocked" || blocked(item)) &&
            (view !== "inactive" || inactive(item)),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "readiness"
              ? readiness(a) - readiness(b)
              : previewRisk(b) - previewRisk(a),
        ),
    [results, program, stage, risk, view, sort],
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 7) - 1),
  );
  const shown = filtered.slice(currentPage * 7, currentPage * 7 + 7);
  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(0);
    setSelected([]);
  };
  const complete = results.reduce(
    (sum, item) => sum + item.journey.completedTasks,
    0,
  );
  const total = results.reduce((sum, item) => sum + item.journey.totalTasks, 0);
  const ready = total ? Math.round((complete / total) * 100) : 0;
  const clear = () => {
    setQuery("");
    setProgram("");
    setStage("");
    setRisk("");
    setView("all");
    setPage(0);
    setSelected([]);
  };
  const exportRows = () => {
    const rows = selected.length
      ? filtered.filter((item) => selected.includes(item.id))
      : filtered;
    const cell = (value: string | number) =>
      `"${String(value)
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""')}"`;
    const csv = [
      [
        "Student",
        "Program",
        "Stage",
        "Enrollment complete",
        "Open work",
        "Melt risk (mock preview)",
      ],
      ...rows.map((item) => [
        item.name,
        item.programName,
        item.journey.stage,
        `${readiness(item)}%`,
        item.openWorkItems,
        `${previewRisk(item)}%`,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-360-current-view.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (selectedId)
    return (
      <div className={styles.root}>
        <div className={styles.breadcrumb}>
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              search.refresh();
            }}
          >
            ← Back to all students
          </button>
          <span>STUDENT 360</span>
        </div>
        {student ? (
          <StudentRecord
            key={student.id}
            student={student}
            openTaskBoard={openTaskBoard}
            openWorkItem={openWorkItem}
            onRefresh={() => {
              refresh();
              search.refresh();
              pinned.refresh();
            }}
          />
        ) : (
          <Card
            title={
              pinned.status === "error"
                ? "Student could not be loaded"
                : pinned.status === "ready"
                  ? "Student not found"
                  : "Opening student record…"
            }
          >
            <p>
              {pinned.status === "ready"
                ? "Return to the directory to choose another student."
                : "Reading the latest student record."}
            </p>
            {pinned.status === "error" && (
              <button className={styles.button} onClick={pinned.reload}>
                Try again
              </button>
            )}
          </Card>
        )}
      </div>
    );
  return (
    <div className={styles.root}>
      <div className={styles.updated}>
        <span aria-hidden="true">↻</span>{" "}
        {search.isRefreshing
          ? "Refreshing students…"
          : search.data
            ? `Updated ${date(search.data.generatedAt)}`
            : "Student 360"}
        <button onClick={search.refresh} type="button">
          Refresh
        </button>
      </div>
      <header className={styles.hero}>
        <div>
          <span className={styles.heroEyebrow}>ONE STUDENT, WHOLE</span>
          <h1>Enrollment overview</h1>
          <p>
            Every side of one student in one record — application, enrollment,
            aid, academics, campus life,
            <br className={styles.desktopBreak} /> documents, and the staff work
            and conversations attached to them.
          </p>
        </div>
        <button
          type="button"
          className={styles.heroButton}
          onClick={exportRows}
          disabled={!filtered.length}
        >
          ↓ Export{selected.length ? ` (${selected.length})` : ""}
        </button>
        <div className={styles.orbit} aria-hidden="true">
          <span>▣</span>
          <i />
          <i />
        </div>
      </header>
      {!!personas.data?.students.length && (
        <section
          className={styles.demoStudents}
          aria-label="Live demo students"
        >
          <div>
            <strong>Follow your demo student live</strong>
            <p>
              Student updates appear here automatically, including enrollment
              progress and document status.
            </p>
          </div>
          <div className={styles.demoStudentLinks}>
            {personas.data.students.map((persona) => (
              <button
                className={styles.button}
                type="button"
                key={persona.id}
                onClick={() => setSelectedId(persona.id)}
              >
                <span className={styles.liveDot} aria-hidden="true" /> Open{" "}
                {persona.preferredName}’s live record{" "}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className={styles.filters}>
        <label className={styles.search}>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Search students"
            placeholder="Search by student, ID, or program"
            value={query}
            onChange={(event) => changeFilter(setQuery, event.target.value)}
          />
        </label>
        <label>
          Program
          <select
            value={program}
            onChange={(event) => changeFilter(setProgram, event.target.value)}
          >
            <option value="">All programs</option>
            {[...new Set(results.map((item) => item.programName))]
              .sort()
              .map((value) => (
                <option key={value}>{value}</option>
              ))}
          </select>
        </label>
        <label>
          Stage
          <select
            value={stage}
            onChange={(event) => changeFilter(setStage, event.target.value)}
          >
            <option value="">All stages</option>
            {[...new Set(results.map((item) => item.journey.stage))]
              .sort()
              .map((value) => (
                <option key={value}>{value}</option>
              ))}
          </select>
        </label>
        <label>
          Melt risk · mock
          <select
            value={risk}
            onChange={(event) => changeFilter(setRisk, event.target.value)}
          >
            <option value="">All risk bands</option>
            {["Critical", "High", "Medium", "Low"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) => changeFilter(setSort, event.target.value)}
          >
            <option value="risk">Highest melt risk</option>
            <option value="readiness">Lowest readiness</option>
            <option value="name">Student name</option>
          </select>
        </label>
      </div>
      {search.status === "error" || search.refreshError ? (
        <div role="alert" className={styles.notice}>
          Students could not be refreshed.{" "}
          {search.data
            ? "Showing the last available roster."
            : "Please try again."}{" "}
          <button onClick={search.reload}>Retry</button>
        </div>
      ) : null}
      <div className={styles.metrics}>
        <Metric
          label="Enrollment readiness"
          value={`${ready}%`}
          note={`${complete.toLocaleString()} of ${total.toLocaleString()} milestones complete`}
          aside={<Ring value={ready} />}
          badge="Loaded roster"
        />
        <Metric
          label="Students at risk · mock"
          value={results.filter((item) => previewRisk(item) >= 60).length}
          note="High or critical preview scores"
          aside={
            <span className={styles.metricSymbol} data-tone="rose">
              △
            </span>
          }
          badge="Illustrative scores"
        />
        <Metric
          label="Blocked enrollment steps"
          value={results.reduce(
            (sum, item) =>
              sum +
              item.attention.signals
                .filter(
                  (signal) => signal.code === "blocking_requirements_open",
                )
                .reduce((n, signal) => n + signal.count, 0),
            0,
          )}
          note="Open blocking requirements"
          aside={<span className={styles.metricSymbol}>✓</span>}
          badge="Needs attention"
        />
        <Metric
          label="Financial coverage · mock"
          value="88%"
          note="Illustrative coverage preview"
          aside={<Ring value={88} green />}
          badge="Preview"
        />
      </div>
      <div className={styles.recommendation}>
        <span className={styles.sparkle} aria-hidden="true">
          ✦
        </span>
        <div>
          <span className={styles.eyebrow}>YOUR NEXT CONVERSATION</span>
          <strong>
            {results.filter(blocked).length}{" "}
            {results.filter(blocked).length === 1
              ? "student has"
              : "students have"}{" "}
            enrollment blockers that need attention.
          </strong>
          <p>
            Bring the right context to every conversation. Start with the
            students waiting on a next step.
          </p>
        </div>
        <button
          className={styles.primary}
          type="button"
          onClick={() => changeFilter(setView, "blocked")}
        >
          Review students <span aria-hidden="true">→</span>
        </button>
      </div>
      <section
        className={styles.directory}
        aria-labelledby="students-attention-title"
      >
        <header>
          <h2 id="students-attention-title">Students requiring attention</h2>
          <p>
            Prioritized by melt risk, blockers, inactivity, and staff urgency.
          </p>
        </header>
        <div className={styles.tableControls}>
          <div className={styles.chips}>
            {[
              [
                "risk",
                "High risk",
                results.filter((item) => previewRisk(item) >= 60).length,
              ],
              ["blocked", "Blocked", results.filter(blocked).length],
              ["inactive", "Inactive 7d+", results.filter(inactive).length],
              ["all", "All students", results.length],
            ].map(([id, label, count]) => (
              <button
                type="button"
                key={id}
                aria-pressed={view === id}
                onClick={() => changeFilter(setView, String(id))}
              >
                {label} <b>{count}</b>
              </button>
            ))}
          </div>
          <button className={styles.textButton} onClick={clear}>
            Clear filters
          </button>
        </div>
        <p className={styles.tableNote}>
          Melt risk and financial coverage are mock previews. Enrollment and
          staff work reflect platform records.
          {search.data && search.data.total > results.length
            ? ` Showing ${results.length} of ${search.data.total.toLocaleString()} matches; search to narrow the full roster.`
            : ""}
          {selected.length > 0 && ` ${selected.length} selected for export.`}
        </p>
        <div
          className={styles.tableScroll}
          tabIndex={0}
          role="region"
          aria-label="Student directory"
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <input
                    aria-label="Select students on this page"
                    type="checkbox"
                    checked={
                      shown.length > 0 &&
                      shown.every((item) => selected.includes(item.id))
                    }
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [
                              ...new Set([
                                ...selected,
                                ...shown.map((item) => item.id),
                              ]),
                            ]
                          : selected.filter(
                              (id) => !shown.some((item) => item.id === id),
                            ),
                      )
                    }
                  />
                </th>
                {[
                  "Student",
                  "Melt risk",
                  "Enrollment",
                  "Current blocker",
                  "Financial · mock",
                  "Last activity",
                  "Next best action",
                  "Owner",
                ].map((label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.name}`}
                      checked={selected.includes(item.id)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, item.id]
                            : selected.filter((id) => id !== item.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      className={styles.studentLink}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className={styles.avatar} data-color={index % 4}>
                        {initials(item.name)}
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.programName} · Class of {item.classYear}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <div
                      className={styles.risk}
                      data-high={previewRisk(item) >= 60}
                    >
                      {previewRisk(item)}%
                      <Badge tone={previewRisk(item) >= 60 ? "rose" : "amber"}>
                        {riskLabel(previewRisk(item))}
                      </Badge>
                    </div>
                  </td>
                  <td>
                    <b>{readiness(item)}%</b>
                    <Progress value={readiness(item)} />
                    <small>
                      {item.journey.completedTasks}/{item.journey.totalTasks}{" "}
                      milestones
                    </small>
                  </td>
                  <td>
                    <strong className={styles.blocker}>
                      {item.attention.signals[0]?.label ?? "No open blockers"}
                    </strong>
                    <Badge tone={blocked(item) ? "amber" : "green"}>
                      {blocked(item)
                        ? "Needs attention"
                        : human(item.journey.stage)}
                    </Badge>
                  </td>
                  <td>
                    <strong className={styles.funding}>
                      $
                      {(
                        (100 - (64 + (previewRisk(item) % 37))) *
                        120
                      ).toLocaleString()}{" "}
                      gap
                    </strong>
                    <small>
                      {64 + (previewRisk(item) % 37)}% covered · mock
                    </small>
                  </td>
                  <td>
                    <small className={inactive(item) ? styles.overdue : ""}>
                      {date(item.journey.lastActivityAt)}
                    </small>
                  </td>
                  <td>
                    <button
                      className={styles.rowAction}
                      onClick={() => setSelectedId(item.id)}
                    >
                      {item.recommendedAction.title || "View student"}{" "}
                      <span aria-hidden="true">→</span>
                    </button>
                  </td>
                  <td>
                    <span
                      className={styles.owner}
                      title={item.primaryAdviser?.name ?? "Unassigned"}
                    >
                      {item.primaryAdviser
                        ? initials(item.primaryAdviser.name)
                        : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {search.status === "loading" && !results.length ? (
          <p className={styles.empty} role="status">
            Loading students…
          </p>
        ) : !shown.length ? (
          <Empty title="No students match this view">
            Try another program or stage, or clear the filters to see the
            roster.
          </Empty>
        ) : null}
        <footer className={styles.pagination}>
          <span>
            {filtered.length
              ? `Showing ${currentPage * 7 + 1}–${Math.min(currentPage * 7 + 7, filtered.length)} of ${filtered.length} students`
              : "0 students"}
            {search.data
              ? ` · ${search.data.cohortTotal.toLocaleString()} in the institution`
              : ""}
          </span>
          <div>
            <button
              aria-label="Previous page"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              ‹
            </button>
            <span>
              {currentPage + 1} / {Math.max(1, Math.ceil(filtered.length / 7))}
            </span>
            <button
              aria-label="Next page"
              disabled={(currentPage + 1) * 7 >= filtered.length}
              onClick={() => setPage(currentPage + 1)}
            >
              ›
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  aside,
  badge,
}: {
  label: string;
  value: ReactNode;
  note: string;
  aside?: ReactNode;
  badge?: string;
}) {
  return (
    <article className={styles.metric}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
        {badge && <Badge>{badge}</Badge>}
      </div>
      {aside}
    </article>
  );
}

function StudentRecord({
  student,
  openTaskBoard,
  openWorkItem,
  onRefresh,
}: {
  student: Student;
  openTaskBoard: (query: StaffActionCenterQuery) => void;
  openWorkItem: (id: string) => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const record = useApiResource(
    useCallback(
      (signal: AbortSignal) => getStaffStudentRecord(student.id, signal),
      [student.id],
    ),
  );
  const university = useApiResource(
    useCallback(
      (signal: AbortSignal) =>
        getUniversityRecord("overview", student.id, signal),
      [student.id],
    ),
  );
  const work = useApiResource(
    useCallback(
      (signal: AbortSignal) =>
        getStaffActionCenter(
          { studentId: student.id, status: "all", limit: 100 },
          signal,
        ),
      [student.id],
    ),
  );
  const open =
    work.data?.items.filter(
      (item) => !["done", "cancelled"].includes(item.status),
    ) ?? [];
  const board = () => openTaskBoard({ studentId: student.id, status: "all" });
  const recommendedWork = () =>
    student.recommendedAction.taskId
      ? openWorkItem(student.recommendedAction.taskId)
      : board();
  const application = tab === "Application";
  const documents = record.data?.documents.items ?? [];
  const pendingDocuments = documents.filter((item) =>
    ["needs_review", "under_review", "processing"].includes(item.status),
  );
  return (
    <>
      <header
        className={`${styles.recordHero} ${application ? styles.recordHeroLight : ""}`}
      >
        <div className={styles.identity}>
          <span className={styles.largeAvatar}>{initials(student.name)}</span>
          <div>
            <span className={styles.heroEyebrow}>
              STUDENT 360 · CLASS OF {student.classYear}
            </span>
            <h1>{student.name}</h1>
            <p>
              {student.programName} ·{" "}
              {student.termName ?? human(student.journey.stage)}
            </p>
            <Badge tone="green">
              Lifecycle stage: {human(student.journey.stage)}
            </Badge>
          </div>
        </div>
        <div className={styles.heroStat}>
          <span>{application ? "Program fit · mock" : "Melt risk · mock"}</span>
          <strong>{application ? "88" : previewRisk(student)}%</strong>
          <small>
            {application
              ? "Illustrative alignment"
              : `${riskLabel(previewRisk(student))} · preview`}
          </small>
        </div>
        <div className={styles.heroStat}>
          <span>Enrollment readiness</span>
          <strong>{readiness(student)}%</strong>
          <small>
            {student.journey.completedTasks} of {student.journey.totalTasks}{" "}
            milestones
          </small>
        </div>
        <div className={styles.heroNext}>
          <span>Next staff action</span>
          <strong>
            {student.recommendedAction.title || "Review student record"}
          </strong>
          <button type="button" onClick={recommendedWork}>
            Open recommended action →
          </button>
        </div>
      </header>
      <Navigation
        options={tabs}
        active={tab}
        onSelect={(value) => setTab(value as Tab)}
        label="Student record sections"
      />
      <div
        className={tab === "Overview" ? styles.overviewBody : styles.recordBody}
      >
        <section className={styles.recordMain} aria-label={`${tab} content`}>
          {(record.refreshError ||
            university.refreshError ||
            work.refreshError ||
            record.status === "error" ||
            university.status === "error" ||
            work.status === "error") && (
            <p role="status" className={styles.notice}>
              Some details could not be loaded. Available records are shown
              below.{" "}
              <button
                onClick={() => {
                  record.refresh();
                  university.refresh();
                  work.refresh();
                  onRefresh();
                }}
              >
                Retry refresh
              </button>
            </p>
          )}
          {tab === "Overview" && (
            <>
              <section className={styles.executive}>
                <div>
                  <span className={styles.eyebrow}>EXECUTIVE OVERVIEW</span>
                  <h2>{student.preferredName}’s path to enrollment</h2>
                  <p>
                    A complete picture of what is done, what needs attention,
                    and the next conversation.
                  </p>
                </div>
                <div className={styles.readiness}>
                  <Ring value={readiness(student)} green />
                  <span>
                    <b>Enrollment readiness</b>
                    <small>
                      {student.journey.completedTasks} of{" "}
                      {student.journey.totalTasks} milestones complete
                    </small>
                  </span>
                </div>
                <button
                  className={styles.executiveStrip}
                  onClick={() => setTab("Enrollment")}
                >
                  <span>
                    {student.openWorkItems} open staff tasks ·{" "}
                    {pendingDocuments.length} documents pending review
                  </span>
                  <span>Go to checklist →</span>
                </button>
              </section>
              <div className={styles.overviewGrid}>
                <Card
                  eyebrow="AT A GLANCE"
                  title={
                    student.recommendedAction.title ||
                    "A clear view of the next step"
                  }
                  className={styles.summaryCard}
                >
                  <p>
                    {student.recommendedAction.rationale ||
                      "Review the enrollment checklist and coordinate the next step with the student's support team."}
                  </p>
                  <div className={styles.signalList}>
                    {student.attention.signals.map((signal) => (
                      <Badge key={signal.code} tone="amber">
                        {signal.label}
                      </Badge>
                    ))}
                  </div>
                  <button className={styles.primary} onClick={recommendedWork}>
                    Open linked work <span aria-hidden="true">→</span>
                  </button>
                  <div className={styles.summaryFoot}>
                    Student record · Updated{" "}
                    {date(student.attention.evaluatedAt)}
                  </div>
                </Card>
                <Card
                  eyebrow="PRIORITY RAIL"
                  title="What deserves attention now"
                >
                  {work.status === "error" ? (
                    <p role="alert">
                      Staff work is unavailable.{" "}
                      <button onClick={work.reload}>Retry</button>
                    </p>
                  ) : work.status === "loading" ? (
                    <p role="status">Loading staff work…</p>
                  ) : open.length ? (
                    open.slice(0, 3).map((item, index) => (
                      <button
                        key={item.id}
                        className={styles.priorityRow}
                        onClick={() => openWorkItem(item.id)}
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <b>{item.title}</b>
                          <small>
                            {item.assignee?.name ?? "Unassigned"} ·{" "}
                            {human(item.status)}
                          </small>
                        </div>
                        <Badge
                          tone={item.priority === "urgent" ? "rose" : "quiet"}
                        >
                          {item.priority}
                        </Badge>
                      </button>
                    ))
                  ) : (
                    <p>
                      No open staff work. The latest checklist remains available
                      below.
                    </p>
                  )}
                  <button className={styles.fullButton} onClick={board}>
                    Open Action Center →
                  </button>
                </Card>
              </div>
              <div className={styles.metrics}>
                <Metric
                  label="Enrollment"
                  value={`${readiness(student)}%`}
                  note={`${student.journey.completedTasks} of ${student.journey.totalTasks} milestones complete`}
                />
                <Metric
                  label="Financials · mock"
                  value="88%"
                  note="Illustrative coverage preview"
                />
                <Metric
                  label="Documents"
                  value={record.data ? pendingDocuments.length : "—"}
                  note="Awaiting review or processing"
                />
                <Metric
                  label="Portal activity"
                  value={inactive(student) ? "Inactive 7d+" : "Active"}
                  note={`Last seen ${date(student.journey.lastActivityAt)}`}
                />
              </div>
              <Card eyebrow="ENROLLMENT JOURNEY" title="Every step, connected.">
                <p>
                  Follow the current checklist from the student’s shared record.
                </p>
                <div className={styles.journey}>
                  {[
                    "Application",
                    "Commitment",
                    "Enrollment",
                    "Arrival",
                    "First term",
                  ].map((label, index) => (
                    <button
                      key={label}
                      onClick={() =>
                        setTab(
                          label === "Application"
                            ? "Application"
                            : "Enrollment",
                        )
                      }
                    >
                      <span
                        data-active={student.journey.stage
                          .toLowerCase()
                          .includes(label.toLowerCase())}
                      >
                        {index + 1}
                      </span>
                      <b>{label}</b>
                    </button>
                  ))}
                </div>
                <div className={styles.journeyNote}>
                  <Badge tone="green">{human(student.journey.stage)}</Badge>
                  <span>Current recorded stage</span>
                  <button
                    className={styles.textButton}
                    onClick={() => setTab("Enrollment")}
                  >
                    View enrollment checklist →
                  </button>
                </div>
              </Card>
              <Student360Summary studentId={student.id} name={student.name} />
            </>
          )}
          {tab === "Application" && (
            <Application
              student={student}
              record={record.data}
              university={university.data}
              loading={
                record.status === "loading" || university.status === "loading"
              }
              error={record.status === "error" || university.status === "error"}
              retry={() => {
                record.reload();
                university.reload();
              }}
              onWork={recommendedWork}
            />
          )}
          {tab === "Enrollment" && (
            <Card
              eyebrow="ENROLLMENT"
              title="The next steps to becoming a student"
            >
              <p>
                Live requirements, dependencies, and completion from the shared
                student checklist.
              </p>
              {record.status === "error" ? (
                <p role="alert">
                  Checklist unavailable.{" "}
                  <button onClick={record.reload}>Retry</button>
                </p>
              ) : !record.data ? (
                <p role="status">Loading checklist…</p>
              ) : (
                <Requirements record={record.data} onWork={board} />
              )}
            </Card>
          )}
          {tab === "Financials" && (
            <>
              <Student360Summary studentId={student.id} name={student.name} />
              <UniversityRecordPanel
                studentId={student.id}
                initialDomain="account"
                embedded
              />
            </>
          )}
          {tab === "Academics" && (
            <Card
              eyebrow="ACADEMICS"
              title="Learning, progress & course history"
            >
              <UniversityRecordPanel
                studentId={student.id}
                initialDomain="academics"
                embedded
              />
            </Card>
          )}
          {tab === "Campus Life" && (
            <Card eyebrow="CAMPUS LIFE" title="A place to belong">
              <p>
                Housing, people, permissions, and coordinated support around
                this student.
              </p>
              <UniversityRecordPanel
                studentId={student.id}
                initialDomain="relationships"
                embedded
              />
            </Card>
          )}
          {tab === "Timeline" && (
            <Card eyebrow="STUDENT TIMELINE" title="The story so far">
              <UniversityRecordPanel
                studentId={student.id}
                initialDomain="history"
                embedded
              />
            </Card>
          )}
          {tab === "Documents" && (
            <Card
              eyebrow="DOCUMENT LIBRARY"
              title="Documents & source evidence"
            >
              <p>
                Original files and their recorded review status. Source
                documents remain authoritative.
              </p>
              {record.status === "error" ? (
                <p role="alert">
                  Documents unavailable.{" "}
                  <button onClick={record.reload}>Retry</button>
                </p>
              ) : !record.data ? (
                <p role="status">Loading documents…</p>
              ) : (
                <Documents documents={documents} onWork={board} />
              )}
            </Card>
          )}
          {tab === "Comments" && (
            <Card
              eyebrow="STAFF COLLABORATION"
              title="Notes & recorded activity"
            >
              <p>Staff context is kept with its linked work item.</p>
              {work.status === "error" ? (
                <p role="alert">
                  Activity unavailable.{" "}
                  <button onClick={work.reload}>Retry</button>
                </p>
              ) : !work.data ? (
                <p role="status">Loading activity…</p>
              ) : (
                <WorkHistory work={work.data.items} onWork={board} />
              )}
              <button className={styles.primary} onClick={board}>
                Add a note to linked work →
              </button>
            </Card>
          )}
          {tab === "Messages" && (
            <Card
              eyebrow="COMMUNICATION HISTORY"
              title={`Conversations with ${student.preferredName}`}
            >
              <p>Portal messages and recorded outreach, together in context.</p>
              {student.communicationHistory.length ? (
                <ol className={styles.timeline}>
                  {student.communicationHistory.map((item) => (
                    <li key={item.id}>
                      <div>
                        <Badge>
                          {item.channel} · {item.direction}
                        </Badge>
                        <time>{date(item.occurredAt)}</time>
                      </div>
                      <h3>{item.summary}</h3>
                      <small>
                        {item.channel === "portal" &&
                        item.direction === "outbound" &&
                        item.outcome === "delivered"
                          ? "Delivered to student inbox"
                          : "Recorded activity"}
                      </small>
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty title="No communications recorded">
                  New communications will appear here after they are recorded on
                  the platform.
                </Empty>
              )}
              <button className={styles.primary} onClick={board}>
                Open communication workspace →
              </button>
            </Card>
          )}
        </section>
        {tab !== "Overview" && (
          <aside className={styles.contextRail}>
            <Card eyebrow="STUDENT CONTEXT">
              <div className={styles.contextIdentity}>
                <span className={styles.avatar}>{initials(student.name)}</span>
                <div>
                  <b>{student.name}</b>
                  <small>
                    {student.externalRef ?? "Student record"}
                    {record.data?.profile.pronouns
                      ? ` · ${record.data.profile.pronouns}`
                      : ""}
                  </small>
                </div>
              </div>
              <Facts
                rows={[
                  ["Term", student.termName],
                  ["Program", student.programName],
                  [
                    "Student status",
                    university.data?.student.status
                      ? human(university.data.student.status)
                      : human(student.journey.stage),
                  ],
                  [
                    "Preferred channel",
                    record.data?.profile.communicationPreference,
                  ],
                ]}
              />
            </Card>
            <Card
              eyebrow="RECOMMENDED NEXT STEP"
              className={styles.recommendationCard}
            >
              <h3>
                {student.recommendedAction.title || "Review student record"}
              </h3>
              <p>{student.recommendedAction.rationale}</p>
              <button className={styles.primary} onClick={recommendedWork}>
                Open linked work item →
              </button>
              <div className={styles.railRisk}>
                Melt risk · mock{" "}
                <Badge tone="quiet">
                  {previewRisk(student)}% · {riskLabel(previewRisk(student))}
                </Badge>
              </div>
            </Card>
            <Card eyebrow="PEOPLE IN THEIR CORNER">
              {student.primaryAdviser && (
                <div className={styles.person}>
                  <span className={styles.owner}>
                    {initials(student.primaryAdviser.name)}
                  </span>
                  <div>
                    <b>{student.primaryAdviser.name}</b>
                    <small>Primary adviser</small>
                  </div>
                </div>
              )}
              {student.openWorkOwners
                .filter((owner) => owner.id !== student.primaryAdviser?.id)
                .map((owner) => (
                  <div key={owner.id} className={styles.person}>
                    <span className={styles.owner}>{initials(owner.name)}</span>
                    <div>
                      <b>{owner.name}</b>
                      <small>{owner.component} · work owner</small>
                    </div>
                  </div>
                ))}
              {!student.primaryAdviser && !student.openWorkOwners.length && (
                <p>No current assignments recorded.</p>
              )}
            </Card>
            <Card eyebrow="TODAY">
              <Facts
                rows={[
                  ["Open staff work", student.openWorkItems],
                  ["Overdue work", student.overdueWorkItems],
                  [
                    "Checklist complete",
                    `${student.journey.completedTasks} / ${student.journey.totalTasks}`,
                  ],
                  [
                    "Pending documents",
                    record.data ? pendingDocuments.length : "—",
                  ],
                ]}
              />
            </Card>
            <p className={styles.railNote}>
              The whole student stays in view as you move through their record.
            </p>
          </aside>
        )}
      </div>
    </>
  );
}

function Application({
  student,
  record,
  university,
  loading,
  error,
  retry,
  onWork,
}: {
  student: Student;
  record: StaffStudentRecord | null;
  university: UniversityRecord | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
  onWork: () => void;
}) {
  const [active, setActive] = useState<string>("Overview");
  const application = university?.applications?.[0];
  return (
    <>
      <div className={styles.metrics}>
        <Metric
          label="Application status"
          value={application ? human(application.status) : "—"}
          note={
            application?.decided_at
              ? `Decision recorded ${date(application.decided_at)}`
              : "No decision date recorded"
          }
        />
        <Metric
          label="Application term"
          value={student.termName ?? "—"}
          note="Student entry term"
        />
        <Metric
          label="Documents received"
          value={record?.documents.total ?? "—"}
          note="Files in the shared student record"
        />
        <Metric
          label="Program alignment · mock"
          value="88%"
          note="Illustrative evidence alignment"
        />
      </div>
      <Navigation
        options={applicationTabs}
        active={active}
        onSelect={setActive}
        label="Application sections"
        secondary
      />
      {error && (
        <p role="alert" className={styles.notice}>
          Some application details could not be loaded.{" "}
          <button onClick={retry}>Retry</button>
        </p>
      )}
      {loading && <p role="status">Loading application records…</p>}
      {active === "Overview" && (
        <>
          <div className={styles.twoColumns}>
            <Card
              eyebrow="APPLICATION RECORD"
              title={
                application
                  ? `${human(application.status)}${student.termName ? ` for ${student.termName}` : ""}`
                  : "Application at a glance"
              }
            >
              <p>
                {application
                  ? "The current admissions record, with source evidence and staff follow-up close at hand."
                  : "An admissions decision has not been recorded in the available university record."}
              </p>
              <Facts
                rows={[
                  ["Program", student.programName],
                  ["Submitted", date(application?.submitted_at)],
                  ["Respond by", date(application?.respond_by)],
                ]}
              />
              <button
                className={styles.textButton}
                onClick={() => setActive("Application details")}
              >
                Open application details →
              </button>
            </Card>
            <Card
              eyebrow="OPEN REVIEW"
              title={student.recommendedAction.title || "Review the next step"}
            >
              <p>{student.recommendedAction.rationale}</p>
              <button className={styles.primary} onClick={onWork}>
                Open linked work →
              </button>
            </Card>
          </div>
          <Card eyebrow="APPLICATION TIMELINE" title="Key milestones">
            <ApplicationDates application={application} />
          </Card>
          <div className={styles.threeColumns}>
            {[
              [
                "Education history",
                "Institutions & transcripts",
                "Review the original academic evidence.",
              ],
              [
                "Application requirements",
                "Requirements & source files",
                "Check document status and outstanding review.",
              ],
              [
                "Program alignment",
                "88% evidence alignment",
                "Illustrative program fit · mock preview.",
              ],
            ].map(([section, title, copy]) => (
              <Card key={section} eyebrow={section.toUpperCase()} title={title}>
                <p>{copy}</p>
                <button
                  className={styles.textButton}
                  onClick={() => setActive(section)}
                >
                  Explore {section.toLowerCase()} →
                </button>
              </Card>
            ))}
          </div>
        </>
      )}
      {active === "Application details" && (
        <div className={styles.twoColumns}>
          <Card eyebrow="APPLICATION INFORMATION" title="Identity and contact">
            <Facts
              rows={[
                ["Legal name", student.name],
                [
                  "Preferred name",
                  record?.profile.preferredName ?? student.preferredName,
                ],
                ["Pronouns", record?.profile.pronouns],
                ["Primary email", record?.profile.email],
                ["Mobile", record?.profile.mobilePhone],
                ["Student number", student.externalRef],
              ]}
            />
          </Card>
          <Card
            eyebrow="APPLICATION CHOICES"
            title="School and program selection"
          >
            <div className={styles.programChoice}>
              <span className={styles.owner}>01</span>
              <div>
                <h3>{student.programName}</h3>
                <p>Recorded student program</p>
              </div>
            </div>
            <Facts
              rows={[
                ["Application term", student.termName],
                ["Campus", student.campusName],
                ["Class year", student.classYear],
                [
                  "Residency",
                  university?.student.residency
                    ? human(university.student.residency)
                    : null,
                ],
                [
                  "Application status",
                  application ? human(application.status) : null,
                ],
              ]}
            />
          </Card>
        </div>
      )}
      {active === "Education history" && (
        <Card
          eyebrow="EDUCATION HISTORY"
          title="Institutions and transcript history"
        >
          <p>
            Review the original transcripts in the shared student record. School
            attendance and GPA appear when supplied by the institution.
          </p>
          {record && (
            <Documents
              documents={record.documents.items.filter((item) =>
                /transcript/i.test(item.category + item.fileName),
              )}
              onWork={onWork}
              emptyTitle="No transcripts recorded"
            />
          )}
        </Card>
      )}
      {active === "Application requirements" && (
        <>
          <div className={styles.notice}>
            Document evidence is shown from the shared record. Admissions
            completion is separate from the enrollment checklist.
          </div>
          <Card
            eyebrow="APPLICATION EVIDENCE"
            title="Requirements and source documents"
          >
            <p>
              See review status and open the source document from one place.
            </p>
            {record && (
              <Documents documents={record.documents.items} onWork={onWork} />
            )}
          </Card>
        </>
      )}
      {active === "Program alignment" && (
        <>
          <Card
            eyebrow="PROGRAM ALIGNMENT · MOCK PREVIEW"
            title={student.programName}
          >
            <div className={styles.alignment}>
              <Ring value={88} />
              <div>
                <h3>Strong evidence alignment</h3>
                <p>
                  Illustrative decision support. This score is not an admissions
                  decision.
                </p>
                <Progress value={88} />
              </div>
              <div>
                {[
                  ["Academic preparation", 92],
                  ["Program coursework", 95],
                  ["Writing evidence", 84],
                  ["Program interest", 90],
                ].map(([label, value]) => (
                  <div className={styles.alignmentRow} key={label}>
                    <span>{label}</span>
                    <Progress value={Number(value)} />
                    <b>{value}%</b>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <div className={styles.twoColumns}>
            <Card eyebrow="SOURCE EVIDENCE" title="Keep the evidence in view">
              <p>
                Verify alignment against the original documents before recording
                an outcome.
              </p>
              {record && (
                <Documents documents={record.documents.items} onWork={onWork} />
              )}
            </Card>
            <Card eyebrow="REVIEW GUIDANCE" title="A considered decision">
              <p>
                Academic preparation, program interest, and writing provide
                useful review context. The alignment figures above are a design
                preview.
              </p>
              <Facts
                rows={[
                  ["Selected program", student.programName],
                  [
                    "Recorded decision",
                    application ? human(application.status) : "Not recorded",
                  ],
                  ["Source documents", record?.documents.total ?? "—"],
                ]}
              />
              <button className={styles.button} onClick={onWork}>
                Record outcome in linked work →
              </button>
            </Card>
          </div>
        </>
      )}
      {active === "Application journey" && (
        <div className={styles.twoColumns}>
          <Card
            eyebrow="APPLICATION JOURNEY"
            title="From application to decision"
          >
            <Facts
              rows={[
                ["Submitted", date(application?.submitted_at)],
                ["Decision recorded", date(application?.decided_at)],
                ["Respond by", date(application?.respond_by)],
                ["Current stage", human(student.journey.stage)],
              ]}
            />
            <p>Dates are taken from the current university record.</p>
          </Card>
          <Card eyebrow="APPLICATION TIMELINE" title="Key dates">
            <ApplicationDates application={application} />
          </Card>
        </div>
      )}
    </>
  );
}
function ApplicationDates({
  application,
}: {
  application?: NonNullable<UniversityRecord["applications"]>[number];
}) {
  return application ? (
    <ol className={styles.timeline}>
      {[
        ["Application submitted", application.submitted_at],
        ["Decision recorded", application.decided_at],
        ["Response deadline", application.respond_by],
      ]
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <li key={label}>
            <time>{date(value)}</time>
            <h3>{label}</h3>
            {label === "Decision recorded" && (
              <Badge tone="green">{human(application.status)}</Badge>
            )}
          </li>
        ))}
    </ol>
  ) : (
    <Empty title="The application story starts here">
      Milestones will appear when an application record is available.
    </Empty>
  );
}
function Requirements({
  record,
  onWork,
}: {
  record: StaffStudentRecord;
  onWork: () => void;
}) {
  const [filter, setFilter] = useState("All");
  const requirements = record.requirements.items.filter(
    (item) =>
      filter === "All" ||
      (filter === "Complete"
        ? ["completed", "waived", "not_applicable"].includes(item.status)
        : !["completed", "waived", "not_applicable"].includes(item.status)),
  );
  return (
    <>
      <Navigation
        options={["All", "Needs attention", "Complete"]}
        active={filter}
        onSelect={setFilter}
        label="Requirement filters"
        secondary
      />
      {requirements.length ? (
        <div className={styles.requirements}>
          {requirements.map((item, index) => (
            <article key={item.id}>
              <span className={styles.owner}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <small>
                  {item.responsibleOffice} · {human(item.flowKind)}
                  {item.dueAt ? ` · Due ${date(item.dueAt)}` : ""}
                </small>
              </div>
              <Badge
                tone={
                  item.status === "completed"
                    ? "green"
                    : item.blocking
                      ? "amber"
                      : "quiet"
                }
              >
                {human(item.status)}
              </Badge>
              <button className={styles.button} onClick={onWork}>
                Open work →
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No requirements in this view">
          Choose another filter to see more of the checklist.
        </Empty>
      )}
    </>
  );
}
function WorkHistory({
  work,
  onWork,
}: {
  work: StaffWorkItem[];
  onWork: () => void;
}) {
  const entries = work
    .flatMap((item) =>
      item.history.map((entry) => ({ ...entry, key: item.key })),
    )
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  return entries.length ? (
    <ol className={styles.timeline}>
      {entries.map((entry) => (
        <li key={`${entry.key}-${entry.id}`}>
          <div>
            <b>{entry.actorName}</b>
            <time>{date(entry.occurredAt)}</time>
          </div>
          <p>{entry.message}</p>
          <button className={styles.textButton} onClick={onWork}>
            {entry.key} →
          </button>
        </li>
      ))}
    </ol>
  ) : (
    <Empty title="Room for the next conversation">
      Staff notes and activity will appear here as linked work progresses.
    </Empty>
  );
}
function Documents({
  documents,
  onWork,
  emptyTitle = "No documents recorded",
}: {
  documents: StudentDocument[];
  onWork: () => void;
  emptyTitle?: string;
}) {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<StudentDocument | null>(null);
  const visible = documents.filter(
    (item) =>
      filter === "All" ||
      (filter === "Needs attention"
        ? !["accepted", "waived"].includes(item.status)
        : ["placeholder", "needs_resubmission", "rejected", "expired"].includes(
            item.status,
          )),
  );
  return (
    <>
      <Navigation
        options={["All", "Needs attention", "Missing"]}
        active={filter}
        onSelect={setFilter}
        label="Document filters"
        secondary
      />
      {visible.length ? (
        <div className={styles.documents}>
          {visible.map((item) => (
            <article key={item.id}>
              <span className={styles.documentIcon} aria-hidden="true">
                ▤
              </span>
              <div>
                <h3>{item.fileName}</h3>
                <small>
                  {human(item.category)} · {date(item.createdAt)}
                </small>
                {item.review?.note && <p>{item.review.note}</p>}
              </div>
              <Badge
                tone={
                  item.status === "accepted"
                    ? "green"
                    : item.status === "rejected"
                      ? "rose"
                      : "quiet"
                }
              >
                {human(item.status)}
              </Badge>
              <button
                className={styles.button}
                onClick={() => setSelected(item)}
              >
                Preview
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            documents.length ? "No documents match this filter" : emptyTitle
          }
        >
          Source files will appear here when received. Select All to see every
          available document.
        </Empty>
      )}
      {selected && (
        <DocumentPreview
          document={selected}
          onClose={() => setSelected(null)}
          onWork={onWork}
        />
      )}
    </>
  );
}
function DocumentPreview({
  document: file,
  onClose,
  onWork,
}: {
  document: StudentDocument;
  onClose: () => void;
  onWork: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const element = dialog.current;
    const previous = window.document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    if (file.contentUrl)
      void getStaffDocumentContent(file.contentUrl)
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.contentUrl, attempt]);
  return (
    <dialog
      ref={dialog}
      className={styles.documentDialog}
      onCancel={onClose}
      aria-labelledby="student-document-title"
    >
      <header>
        <div>
          <span className={styles.eyebrow}>SOURCE DOCUMENT</span>
          <h2 id="student-document-title">{file.fileName}</h2>
          <p>{human(file.category)} · Original evidence</p>
        </div>
        <button
          className={styles.button}
          onClick={onClose}
          aria-label="Close document preview"
        >
          ×
        </button>
      </header>
      <div className={styles.documentBody}>
        <aside>
          <Badge tone={file.status === "accepted" ? "green" : "quiet"}>
            {human(file.status)}
          </Badge>
          <Facts
            rows={[
              ["Received", date(file.createdAt)],
              [
                "File type",
                file.mimeType === "application/pdf" ? "PDF document" : "Image",
              ],
              ["Size", `${Math.ceil(file.sizeBytes / 1024)} KB`],
              ["Review state", human(file.status)],
            ]}
          />
          {file.review?.note && (
            <div className={styles.notice}>{file.review.note}</div>
          )}
          <button
            className={styles.primary}
            onClick={() => {
              onClose();
              onWork();
            }}
          >
            Open review workspace →
          </button>
          {url && (
            <a
              className={styles.button}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open source ↗
            </a>
          )}
        </aside>
        <div className={styles.documentCanvas}>
          {!file.contentUrl ? (
            <Empty title="Source preview unavailable">
              This record does not include an accessible source file.
            </Empty>
          ) : failed ? (
            <div role="alert">
              <p>The protected document could not be loaded.</p>
              <button
                className={styles.button}
                onClick={() => {
                  setFailed(false);
                  setAttempt(attempt + 1);
                }}
              >
                Retry preview
              </button>
            </div>
          ) : !url ? (
            <p role="status">Loading protected document…</p>
          ) : file.mimeType === "application/pdf" ? (
            <object
              data={url}
              type="application/pdf"
              aria-label={`${file.fileName} preview`}
            >
              <p>
                Your browser cannot display this PDF.{" "}
                <a href={url} target="_blank" rel="noopener noreferrer">
                  Open source document
                </a>
              </p>
            </object>
          ) : (
            // Protected blob URLs are already fetched with tenant credentials.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Original document: ${file.fileName}`} />
          )}
        </div>
      </div>
    </dialog>
  );
}
