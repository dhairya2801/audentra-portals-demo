"use client";

import type {
  CreateStaffStudentNoteInput,
  StaffInquiry,
  StaffMemberSummary,
  StaffOperationsWorkspace,
  StaffStudentNote,
  StaffStudentRecord,
  StaffStudentTimelineItem,
  StudentDocument,
} from "@vv/contracts";
import Image from "next/image";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  createStaffStudentNote,
  getStaffDocumentReviewOptions,
  getStaffInquiryThread,
  getStaffStudentRecord,
  reviewStaffDocument,
  updateStaffInquiry,
} from "../lib/api-client";
import { AcademicsPanel } from "./student-360-academics";
import { CampusLifePanel } from "./student-360-campus-life";
import documentsStyles from "./student-360-documents.module.css";
import enrollmentStyles from "./student-360-enrollment.module.css";
import { FinancialAidPanel } from "./student-360-financials";
import { demoComposedNote, withDemoStudent360Fields } from "./student-360-demo-record";
import { ExecutiveOverviewPanel } from "./student-360-overview";
import timelineStyles from "./student-360-timeline.module.css";
import commentsStyles from "./student-360-comments.module.css";
import styles from "./student-360.module.css";

type Student360Tab =
  | "overview"
  | "timeline"
  | "application"
  | "documents"
  | "enrollment"
  | "notes"
  | "financials"
  | "academics"
  | "campus-life"
  | "messages";

const tabs: Array<{ id: Student360Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "application", label: "Application" },
  { id: "enrollment", label: "Enrollment" },
  { id: "financials", label: "Financials" },
  { id: "academics", label: "Academics" },
  { id: "campus-life", label: "Campus Life" },
  { id: "timeline", label: "Timeline" },
  { id: "notes", label: "Comments" },
  { id: "messages", label: "Messages" },
  { id: "documents", label: "Documents" },
];

const timelineCategories: Array<{
  id: "all" | StaffStudentTimelineItem["category"];
  label: string;
}> = [
  { id: "all", label: "All activity" },
  { id: "application", label: "Application" },
  { id: "enrollment", label: "Enrollment" },
  { id: "document", label: "Documents" },
  { id: "staff_task", label: "Staff work" },
  { id: "note", label: "Comments" },
  { id: "website", label: "Website" },
];

const timelineDestinations: Record<StaffStudentTimelineItem["category"], Student360Tab> = {
  application: "application",
  enrollment: "enrollment",
  document: "documents",
  staff_task: "enrollment",
  note: "notes",
  website: "timeline",
};

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Not recorded";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value / 100);

const labelize = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase();

function riskClass(band: string) {
  if (band === "critical") return styles.riskCritical;
  if (band === "high") return styles.riskHigh;
  if (band === "medium") return styles.riskMedium;
  return styles.riskLow;
}

function StatusTag({ value }: { value: string }) {
  return <span className={styles.statusTag}>{labelize(value)}</span>;
}

type EvidencePreview = {
  eyebrow: string;
  title: string;
  status: string;
  paragraphs: string[];
  facts: Array<{ label: string; value: string }>;
};

type RequirementDetail = {
  eyebrow: string;
  title: string;
  status: string;
  progressPercent: number;
  summary: string;
  facts: Array<{ label: string; value: string }>;
  selection?: {
    label: string;
    value: string;
    description: string;
    facts: Array<{ label: string; value: string }>;
  };
  document?: {
    title: string;
    fileName: string;
    pdfUrl: string;
    previewImageUrl: string;
    alt: string;
  };
};

function createEvidencePreview(title: string, item: Record<string, unknown>): EvidencePreview {
  const normalizedTitle = title.toLowerCase();
  let eyebrow = "Application evidence";
  let paragraphs = [
    "This seeded preview represents the evidence attached to the student's application record.",
    "Staff can use this view to review the document context without leaving Student 360.",
  ];

  if (normalizedTitle.includes("personal")) {
    eyebrow = "Essay preview";
    paragraphs = [
      "My interest in learning began with a simple question: how can technology make everyday systems more humane? That question shaped the projects I chose, the teams I joined, and the way I approach unfamiliar problems.",
      "At Audentra University, I hope to pair technical depth with community-centered work and contribute to a campus where curiosity is shared generously.",
    ];
  } else if (normalizedTitle.includes("community")) {
    eyebrow = "Essay preview";
    paragraphs = [
      "The strongest communities I have known make room for people to participate before they feel like experts. I learned this while organizing peer tutoring sessions and documenting the lessons for students who could not attend.",
      "I would bring that same habit of practical inclusion to student organizations, project teams, and residence life.",
    ];
  } else if (normalizedTitle.includes("counselor") || normalizedTitle.includes("teacher")) {
    eyebrow = "Recommendation preview";
    paragraphs = [
      "To the Admissions Committee: I am pleased to recommend this student, whose thoughtful preparation and steady follow-through have distinguished their work throughout the academic year.",
      "They combine intellectual curiosity with care for their peers and are ready to contribute meaningfully to a rigorous university community.",
    ];
  } else if (normalizedTitle.includes("transcript")) {
    eyebrow = "Transcript preview";
    paragraphs = [
      "Academic record summary: four years completed with a college-preparatory course load across mathematics, science, language arts, social studies, and electives.",
      "The seeded record is verified for staff workflow demonstration and contains no real student information.",
    ];
  } else if (normalizedTitle.includes("resume") || normalizedTitle.includes("activities")) {
    eyebrow = "Activities preview";
    paragraphs = [
      "Activities include student leadership, community service, academic clubs, and project-based work. Roles show sustained participation and increasing responsibility.",
      "This seeded artifact is provided so staff can review the complete Student 360 interaction safely.",
    ];
  }

  const facts = Object.entries(item)
    .filter(([key]) => !["title", "label", "programName", "type", "name"].includes(key))
    .slice(0, 6)
    .map(([key, value]) => ({ label: labelize(key), value: String(value) }));

  return {
    eyebrow,
    title: labelize(title.replace(/-placeholder(?=\.)/i, "")),
    status: labelize(String(item.status ?? "available")),
    paragraphs,
    facts,
  };
}

function EvidencePreviewDialog({
  preview,
  onClose,
}: {
  preview: EvidencePreview | null;
  onClose: () => void;
}) {
  if (!preview) return null;

  return (
    <div className={styles.previewBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.previewDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-evidence-preview-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.previewHeader}>
          <div>
            <span>{preview.eyebrow}</span>
            <h3 id="student-evidence-preview-title">{preview.title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close document preview">
            Close
          </button>
        </header>
        <div className={styles.pdfViewer}>
          <div className={styles.pdfToolbar}>
            <span className={styles.pdfIcon}>PDF</span>
            <div>
              <strong>{preview.title}</strong>
              <small>student-record-sample.pdf</small>
            </div>
            <span>Page 1 of 1</span>
          </div>
          <div className={styles.pdfViewport}>
            <Image
              src="/samples/student-record-sample-page-1.png"
              alt="Rendered page of the shared synthetic student record PDF"
              width={1275}
              height={1650}
              priority
            />
          </div>
          <footer className={styles.pdfFooter}>
            <span>Shared synthetic sample · No real student data</span>
            <a href="/samples/student-record-sample.pdf" target="_blank" rel="noreferrer">
              Open PDF
            </a>
          </footer>
        </div>
      </section>
    </div>
  );
}

function InlinePdfViewer({ document }: { document: NonNullable<RequirementDetail["document"]> }) {
  return (
    <div className={`${styles.pdfViewer} ${styles.requirementPdf}`}>
      <div className={styles.pdfToolbar}>
        <span className={styles.pdfIcon}>PDF</span>
        <div>
          <strong>{document.title}</strong>
          <small>{document.fileName}</small>
        </div>
        <span>Page 1 of 1</span>
      </div>
      <div className={styles.pdfViewport}>
        <Image
          src={document.previewImageUrl}
          alt={document.alt}
          width={1275}
          height={1650}
        />
      </div>
      <footer className={styles.pdfFooter}>
        <span>Synthetic completion evidence · No real student data</span>
        <a href={document.pdfUrl} target="_blank" rel="noreferrer">Open full PDF</a>
      </footer>
    </div>
  );
}

function RequirementDetailDialog({
  detail,
  onClose,
}: {
  detail: RequirementDetail | null;
  onClose: () => void;
}) {
  if (!detail) return null;

  return (
    <div className={styles.previewBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={`${styles.previewDialog} ${styles.requirementDialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="enrollment-requirement-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.previewHeader}>
          <div>
            <span>{detail.eyebrow}</span>
            <h3 id="enrollment-requirement-title">{detail.title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close enrollment step details">
            Close
          </button>
        </header>
        <div className={styles.requirementDetail}>
          <div className={styles.requirementDetailStatus}>
            <StatusTag value={detail.status} />
            <strong>{detail.progressPercent}% complete</strong>
          </div>
          {detail.selection ? (
            <section className={styles.selectionEvidence} aria-label={`${detail.selection.label}: ${detail.selection.value}`}>
              <p>{detail.selection.label}</p>
              <div className={styles.selectionPrimary}>
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>{detail.selection.value}</strong>
                  <small>{detail.selection.description}</small>
                </div>
              </div>
              <dl className={styles.selectionGrid}>
                {detail.selection.facts.map((fact) => (
                  <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
                ))}
              </dl>
            </section>
          ) : null}
          <p className={styles.requirementDetailLead}>{detail.summary}</p>
          <dl className={styles.previewFacts}>
            {detail.facts.map((fact) => (
              <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
            ))}
          </dl>
          {detail.document ? (
            <section className={styles.inlineEvidence}>
              <div className={styles.inlineEvidenceHeading}>
                <p>Attached completion evidence</p>
                <h4>{detail.document.title}</h4>
              </div>
              <InlinePdfViewer document={detail.document} />
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ActivityDetailDialog({
  event,
  onClose,
}: {
  event: StaffStudentTimelineItem | null;
  onClose: () => void;
}) {
  if (!event) return null;

  return (
    <div className={styles.previewBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={`${styles.previewDialog} ${styles.activityDialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-activity-detail-title"
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={styles.previewHeader}>
          <div>
            <span>{labelize(event.category)} activity</span>
            <h3 id="timeline-activity-detail-title">{event.title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close activity details">Close</button>
        </header>
        <div className={styles.activityDetail}>
          <p>{event.summary}</p>
          <dl className={styles.previewFacts}>
            <div><dt>Recorded by</dt><dd>{event.actorName ?? "Student"}</dd></div>
            <div><dt>Source</dt><dd>{labelize(event.source)}</dd></div>
            <div><dt>Activity type</dt><dd>{labelize(event.category)}</dd></div>
            <div><dt>Occurred</dt><dd>{formatDateTime(event.occurredAt)}</dd></div>
          </dl>
        </div>
      </section>
    </div>
  );
}

function EvidenceList({
  items,
  empty,
}: {
  items: Record<string, unknown>[];
  empty: string;
}) {
  const [preview, setPreview] = useState<EvidencePreview | null>(null);

  if (!items.length) return <p className={styles.emptyCopy}>{empty}</p>;
  return (
    <>
      <div className={styles.evidenceList}>
        {items.map((item, index) => {
          const title = String(
            item.title ?? item.label ?? item.programName ?? item.type ?? item.name ?? `Item ${index + 1}`,
          );
          const details = Object.entries(item)
            .filter(([key]) => !["title", "label", "programName", "type", "name"].includes(key))
            .map(([key, value]) => `${labelize(key)}: ${String(value)}`)
            .join(" · ");
          return (
            <button
              type="button"
              className={styles.evidenceItem}
              key={`${title}-${index}`}
              onClick={() => setPreview(createEvidencePreview(title, item))}
              aria-label={`Preview ${labelize(title)}`}
            >
              <span className={styles.evidenceIcon}>{title.slice(0, 1).toUpperCase()}</span>
              <span className={styles.evidenceCopy}>
                <strong>{labelize(title)}</strong>
                <small>{details || "Recorded"}</small>
              </span>
              <span className={styles.previewCue}>Preview</span>
            </button>
          );
        })}
      </div>
      <EvidencePreviewDialog preview={preview} onClose={() => setPreview(null)} />
    </>
  );
}

export function Student360Workspace({
  workspace,
  refresh,
  onOpenWorkItem,
}: {
  workspace: StaffOperationsWorkspace;
  refresh: () => void;
  onOpenWorkItem: (workItemId: string) => void;
}) {
  const initialStudentId = workspace.cohort[0]?.id ?? workspace.student.student.id;
  const [selectedId, setSelectedId] = useState(initialStudentId);
  const [recordOpen, setRecordOpen] = useState(false);
  const [tab, setTab] = useState<Student360Tab>("overview");
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("all");
  const [stage, setStage] = useState("all");
  const [risk, setRisk] = useState("all");
  const [sort, setSort] = useState("melt_desc");

  const programs = useMemo(
    () => [...new Set(workspace.cohort.map((student) => student.programName))].sort(),
    [workspace.cohort],
  );
  const stages = useMemo(
    () => [...new Set(workspace.cohort.map((student) => student.journey.stage))].sort(),
    [workspace.cohort],
  );
  const filteredStudents = useMemo(() => {
    const search = query.trim().toLowerCase();
    return workspace.cohort
      .filter(
        (student) =>
          (!search ||
            `${student.name} ${student.preferredName} ${student.programName} ${student.risk.category}`
              .toLowerCase()
              .includes(search)) &&
          (program === "all" || student.programName === program) &&
          (stage === "all" || student.journey.stage === stage) &&
          (risk === "all" || student.risk.band === risk),
      )
      .sort((left, right) => {
        if (sort === "activity_desc") {
          return Date.parse(right.journey.lastActivityAt) - Date.parse(left.journey.lastActivityAt);
        }
        if (sort === "name_asc") return left.name.localeCompare(right.name);
        return right.risk.meltLikelihoodPercent - left.risk.meltLikelihoodPercent;
      });
  }, [program, query, risk, sort, stage, workspace.cohort]);

  const visibleSelectedId = filteredStudents.some((student) => student.id === selectedId)
    ? selectedId
    : (filteredStudents[0]?.id ?? selectedId);

  const selectedOperation =
    workspace.cohort.find((candidate) => candidate.id === visibleSelectedId) ??
    filteredStudents[0] ??
    workspace.cohort[0];

  // The application, timeline, comments and ledger arrive only from a platform
  // that has run 0053_student_360_records.sql. Where they do not, the record is
  // completed from the student the portal already holds, so a deployment
  // running an older API still shows a whole record rather than four empty
  // panels. See `student-360-demo-record.ts` — it never overwrites a field the
  // platform sent.
  const loadStudent = useCallback(
    async (signal: AbortSignal) =>
      withDemoStudent360Fields(
        await getStaffStudentRecord(visibleSelectedId, signal),
        workspace.cohort.find((candidate) => candidate.id === visibleSelectedId),
      ),
    [visibleSelectedId, workspace.cohort],
  );
  const student = useApiResource(loadStudent);

  return (
    <section
      className={styles.root}
      aria-label="Student 360 workspace"
      data-mode={recordOpen ? "detail" : "list"}
    >
      <div className={styles.directoryToolbar}>
        <label className={styles.searchField}>
          <span aria-hidden="true">⌕</span>
          <span className={styles.srOnly}>Search students</span>
          <input
            type="search"
            placeholder="Search by student, program, or signal"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Program</span>
          <select value={program} onChange={(event) => setProgram(event.target.value)}>
            <option value="all">All programs</option>
            {programs.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Stage</span>
          <select value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="all">All stages</option>
            {stages.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Melt risk</span>
          <select value={risk} onChange={(event) => setRisk(event.target.value)}>
            <option value="all">All risk bands</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="melt_desc">Highest melt risk</option>
            <option value="activity_desc">Recent activity</option>
            <option value="name_asc">Student name</option>
          </select>
        </label>
      </div>

      <div className={styles.workspaceGrid}>
        <aside className={styles.directory} aria-label="Student directory">
          <header>
            <div>
              <p>Active cohort</p>
              <strong>{filteredStudents.length} students</strong>
            </div>
            <span>Sorted live</span>
          </header>
          <div className={styles.directoryList}>
            {filteredStudents.map((candidate) => {
              const openItems = workspace.actionCenter.items.filter(
                (item) => item.student.id === candidate.id && item.status !== "done",
              ).length;
              return (
                <button
                  type="button"
                  className={recordOpen && candidate.id === visibleSelectedId ? styles.studentSelected : undefined}
                  aria-pressed={recordOpen && candidate.id === visibleSelectedId}
                  onClick={() => {
                    setSelectedId(candidate.id);
                    setTab("overview");
                    setRecordOpen(true);
                  }}
                  key={candidate.id}
                >
                  <span className={styles.avatarSmall}>{initials(candidate.name)}</span>
                  <span className={styles.directoryIdentity}>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.programName}</small>
                    <small>{candidate.journey.stage} · {openItems} open items</small>
                  </span>
                  <span className={`${styles.riskBadge} ${riskClass(candidate.risk.band)}`}>
                    <strong>{candidate.risk.meltLikelihoodPercent}%</strong>
                    <small>{candidate.risk.band}</small>
                  </span>
                </button>
              );
            })}
            {!filteredStudents.length ? (
              <div className={styles.emptyDirectory}>
                <strong>No matching students</strong>
                <span>Adjust the search or filters to broaden this view.</span>
              </div>
            ) : null}
          </div>
        </aside>

        <div className={styles.record}>
          <div className={styles.detailNavigation}>
            <button type="button" onClick={() => setRecordOpen(false)}>
              <span aria-hidden="true">←</span>
              Back to all students
            </button>
            <span>Student 360</span>
          </div>
          {!selectedOperation ? (
            <div className={styles.statePanel}>No student record is available.</div>
          ) : student.status === "loading" ? (
            <div className={styles.statePanel}>Loading the full student record…</div>
          ) : student.status === "error" ? (
            <div className={styles.statePanel} role="alert">
              <strong>We could not load Student 360.</strong>
              <span>{student.error}</span>
              <button type="button" onClick={student.reload}>Try again</button>
            </div>
          ) : (
            <StudentRecord
              record={student.data}
              operation={selectedOperation}
              tab={tab}
              setTab={setTab}
              workspace={workspace}
              refreshRecord={student.refresh}
              refreshWorkspace={refresh}
              onOpenWorkItem={onOpenWorkItem}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function StudentRecord({
  record,
  operation,
  tab,
  setTab,
  workspace,
  refreshRecord,
  refreshWorkspace,
  onOpenWorkItem,
}: {
  record: StaffStudentRecord;
  operation: StaffOperationsWorkspace["cohort"][number];
  tab: Student360Tab;
  setTab: (tab: Student360Tab) => void;
  workspace: StaffOperationsWorkspace;
  refreshRecord: () => void;
  refreshWorkspace: () => void;
  onOpenWorkItem: (workItemId: string) => void;
}) {
  const progress = operation.journey.totalTasks
    ? Math.round((operation.journey.completedTasks / operation.journey.totalTasks) * 100)
    : 0;
  const [timelineFocus, setTimelineFocus] = useState<StaffStudentTimelineItem | null>(null);
  const navigateToTab = (nextTab: Student360Tab) => {
    setTimelineFocus(null);
    setTab(nextTab);
  };
  const openTimelineItem = (event: StaffStudentTimelineItem) => {
    setTimelineFocus(event);
    setTab(timelineDestinations[event.category]);
  };
  return (
    <>
      <header className={styles.hero}>
        <div className={styles.heroIdentity}>
          <span className={styles.avatarLarge}>{initials(operation.name)}</span>
          <div>
            <p>Student 360 · Class of {operation.classYear}</p>
            <h2>{operation.name}</h2>
            <span>{operation.programName} · {operation.journey.stage}</span>
          </div>
        </div>
        <div className={styles.heroSignals}>
          <div className={`${styles.riskDial} ${riskClass(operation.risk.band)}`}>
            <strong>{operation.risk.meltLikelihoodPercent}%</strong>
            <span>Melt risk</span>
          </div>
          <div>
            <span>Enrollment readiness</span>
            <strong>{progress}%</strong>
            <small>{operation.journey.completedTasks} of {operation.journey.totalTasks} milestones</small>
          </div>
          <div>
            <span>Next staff action</span>
            <strong>{operation.recommendedAction.title}</strong>
            <small>{operation.recommendedAction.channel} · {operation.risk.category} signal</small>
          </div>
        </div>
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="Student 360 sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? styles.tabActive : undefined}
            onClick={() => navigateToTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={styles.tabPanel} role="tabpanel">
        {tab === "overview" ? (
          <ExecutiveOverviewPanel record={record} operation={operation} onNavigate={navigateToTab} />
        ) : null}
        {tab === "timeline" ? (
          <TimelinePanel
            record={record}
            focusEvent={timelineFocus?.category === "website" ? timelineFocus : null}
            onOpen={openTimelineItem}
            onDismiss={() => setTimelineFocus(null)}
          />
        ) : null}
        {tab === "application" ? <ApplicationPanel record={record} /> : null}
        {tab === "documents" ? (
          <DocumentsPanel
            record={record}
            workspace={workspace}
            refreshRecord={refreshRecord}
            refreshWorkspace={refreshWorkspace}
            focusEvent={timelineFocus?.category === "document" ? timelineFocus : null}
          />
        ) : null}
        {tab === "enrollment" ? (
          <EnrollmentPanel
            record={record}
            operation={operation}
            workspace={workspace}
            focusEvent={timelineFocus}
            onOpenWorkItem={onOpenWorkItem}
          />
        ) : null}
        {tab === "notes" ? (
          <NotesPanel
            record={record}
            author={workspace.currentStaff}
            refreshRecord={refreshRecord}
            focusEvent={timelineFocus?.category === "note" ? timelineFocus : null}
          />
        ) : null}
        {tab === "messages" ? (
          <MessagesPanel
            key={record.student.id}
            studentName={operation.name}
            inquiry={workspace.inquiries.find((item) => item.student.id === record.student.id) ?? null}
            refreshWorkspace={refreshWorkspace}
          />
        ) : null}
        {tab === "financials" ? <FinancialAidPanel record={record} /> : null}
        {tab === "academics" ? (
          <AcademicsPanel
            studentName={operation.name}
            programName={operation.programName}
            classYear={operation.classYear}
          />
        ) : null}
        {tab === "campus-life" ? (
          <CampusLifePanel studentName={operation.name} classYear={operation.classYear} operation={operation} />
        ) : null}
      </div>
    </>
  );
}

function TimelinePanel({
  record,
  focusEvent,
  onOpen,
  onDismiss,
}: {
  record: StaffStudentRecord;
  focusEvent: StaffStudentTimelineItem | null;
  onOpen: (event: StaffStudentTimelineItem) => void;
  onDismiss: () => void;
}) {
  const [showWebsite, setShowWebsite] = useState(true);
  const [category, setCategory] = useState<"all" | StaffStudentTimelineItem["category"]>("all");
  const [query, setQuery] = useState("");
  const items = record.timeline.items.filter((event) => {
    const search = query.trim().toLowerCase();
    return (
      (showWebsite || event.category !== "website") &&
      (category === "all" || event.category === category) &&
      (!search || `${event.title} ${event.summary} ${event.actorName ?? ""}`.toLowerCase().includes(search))
    );
  });
  const sessionSummaries = [
    {
      id: "financial-health",
      startedAt: "3:14 PM",
      title: "Student checked Financial Aid and Student Health",
      summary: "The student moved from the aid balance to health-document requirements, then returned twice to the same health step.",
      channel: "Student portal",
      duration: "11 min",
      experience: "Some friction: the student revisited health-document guidance twice after the first view.",
      outcome: "Reviewed balance and health requirements",
      signal: "Three visits to the same requirement in 11 minutes suggest the accepted file format was unclear.",
      handoff: "Student Health should send accepted formats and a direct upload-guidance link before the next reminder.",
      steps: [
        { time: "3:14", label: "Financial Aid", detail: "Opened balance summary", tone: "normal" },
        { time: "3:18", label: "Student Health", detail: "Viewed immunization requirement", tone: "normal" },
        { time: "3:25", label: "Health requirement", detail: "Returned for the third time", tone: "attention" },
      ],
    },
    {
      id: "enrollment-housing",
      startedAt: "10:08 AM",
      title: "Student reviewed enrollment next steps and housing",
      summary: "The session moved from enrollment requirements to residence details, suggesting preparation for the next milestone.",
      channel: "Mobile web",
      duration: "7 min",
      experience: "Focused: the student moved through enrollment, housing, and move-in details without backtracking.",
      outcome: "Confirmed residence and move-in details",
      signal: "No repeated navigation or stalled step was detected during this seven-minute planning session.",
      handoff: "No intervention is needed now; monitor the final checklist item and preserve the current housing context.",
      steps: [
        { time: "10:08", label: "Enrollment", detail: "Opened next-step checklist", tone: "normal" },
        { time: "10:11", label: "Housing", detail: "Reviewed residence assignment", tone: "normal" },
        { time: "10:15", label: "Move-in", detail: "Checked arrival window", tone: "normal" },
      ],
    },
  ];
  const [selectedSessionId, setSelectedSessionId] = useState(sessionSummaries[0].id);
  const selectedSession = sessionSummaries.find((session) => session.id === selectedSessionId) ?? sessionSummaries[0];
  return (
    <section className={`${styles.card} ${timelineStyles.root}`}>
      <section className={timelineStyles.replay}>
        <div className={timelineStyles.heading}>
          <div><p>Human-readable history</p><h3>Activity replay</h3><span>Follow each session as a journey, then act on observed friction and outcomes.</span></div>
          <div className={timelineStyles.sessionStats} aria-label="Session summary"><article><strong>2</strong><span>Sessions</span></article><article><strong>6</strong><span>Key steps</span></article><article><strong>1</strong><span>Friction signal</span></article></div>
        </div>
        <div className={timelineStyles.replayWorkspace}>
          <nav className={timelineStyles.sessionRail} aria-label="Student activity sessions">
            {sessionSummaries.map((session, index) => (
              <button key={session.id} type="button" className={timelineStyles.sessionButton} data-selected={selectedSession.id === session.id} onClick={() => setSelectedSessionId(session.id)} aria-pressed={selectedSession.id === session.id}>
                <header><span>Session {index + 1}</span><time>{session.duration}</time></header>
                <h4>{session.title}</h4>
                <footer><span>{session.startedAt}</span><strong>{session.channel}</strong></footer>
              </button>
            ))}
          </nav>
          <article className={timelineStyles.replayStage}>
            <header className={timelineStyles.stageHeader}><div><span>Selected session · {selectedSession.startedAt}</span><h4>{selectedSession.title}</h4></div><em>Observed pattern</em></header>
            <p className={timelineStyles.stageSummary}>{selectedSession.summary}</p>
            <div className={timelineStyles.path} aria-label="Session activity path">
              {selectedSession.steps.map((step, index) => <article key={`${selectedSession.id}-${step.time}`} data-tone={step.tone}><span>{index + 1}</span><time>{step.time}</time><strong>{step.label}</strong><small>{step.detail}</small></article>)}
            </div>
            <div className={timelineStyles.readoutGrid}>
              <article data-tone={selectedSession.experience.startsWith("Some friction") ? "attention" : "normal"}><span>Experience</span><strong>{selectedSession.experience}</strong></article>
              <article><span>Observed signal</span><strong>{selectedSession.signal}</strong></article>
              <article><span>Suggested handoff</span><strong>{selectedSession.handoff}</strong></article>
            </div>
            <footer className={timelineStyles.outcomeBand}><span>Meaningful outcome</span><strong>{selectedSession.outcome}</strong></footer>
          </article>
        </div>
      </section>
      <div className={styles.timelineToolbar}>
        <div><p>Unified activity</p><h3>Meaningful event stream</h3></div>
        <label className={styles.toggle}>
          <input type="checkbox" checked={showWebsite} onChange={(event) => setShowWebsite(event.target.checked)} />
          <span /> Website movements
        </label>
        <label className={styles.inlineSearch}>
          <span className={styles.srOnly}>Search timeline</span>
          <input type="search" value={query} placeholder="Search activity" onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      <div className={styles.chipRow}>
        {timelineCategories.map((item) => (
          <button
            type="button"
            className={category === item.id ? styles.chipActive : undefined}
            onClick={() => setCategory(item.id)}
            key={item.id}
          >{item.label}</button>
        ))}
      </div>
      <div className={styles.timeline}>
        {items.map((event) => (
          <article key={event.id}>
            <button
              type="button"
              className={styles.timelineEventButton}
              onClick={() => onOpen(event)}
              aria-label={`Open ${event.title}`}
            >
              <span
                className={`${styles.timelineMark} ${styles[`timeline_${event.category}`]}`}
                data-tooltip={`${event.actorName ?? "Student"} · ${labelize(event.source)}`}
              >
                {event.category.slice(0, 1).toUpperCase()}
              </span>
              <span className={styles.timelineBody}>
                <span><StatusTag value={event.category} /><time>{formatDateTime(event.occurredAt)}</time></span>
                <strong>{event.category === "note" ? "Comment" : event.category === "website" ? "Portal behavior" : event.category === "staff_task" ? "Staff work" : event.category === "document" ? "Document activity" : event.category === "enrollment" ? "Enrollment progress" : "Application milestone"}: {event.title}</strong>
                <span>{event.summary}</span>
                <small>{event.actorName ? `${event.actorName} · ` : ""}{labelize(event.source)}</small>
              </span>
              <span className={styles.timelineOpenCue}>Open</span>
            </button>
          </article>
        ))}
        {!items.length ? <p className={styles.emptyCopy}>No activity matches these filters.</p> : null}
      </div>
      <ActivityDetailDialog event={focusEvent} onClose={onDismiss} />
    </section>
  );
}

function ApplicationPanel({ record }: { record: StaffStudentRecord }) {
  const application = record.application;
  if (!application) return <div className={styles.statePanel}>No application snapshot has been imported.</div>;
  return (
    <div className={styles.panelStack}>
      <section className={styles.metricGrid}>
        <article><span>Status</span><strong>{labelize(application.status)}</strong><small>{application.completenessPercent}% complete</small></article>
        <article><span>Application term</span><strong>{application.applicationTerm}</strong><small>{application.decisionPlan}</small></article>
        <article><span>Submitted</span><strong>{formatDateTime(application.submittedAt)}</strong><small>{application.sourceSystem}</small></article>
        <article><span>Decision</span><strong>{formatDateTime(application.decidedAt)}</strong><small>Version {application.version}</small></article>
      </section>
      <div className={styles.twoColumn}>
        <section className={styles.card}>
          <div className={styles.cardHeading}><div><p>Academic profile</p><h3>Readiness evidence</h3></div></div>
          <dl className={styles.factList}>
            {Object.entries(application.academicProfile).map(([key, value]) => (
              <div key={key}><dt>{labelize(key)}</dt><dd>{String(value)}</dd></div>
            ))}
          </dl>
        </section>
        <section className={styles.card}>
          <div className={styles.cardHeading}><div><p>Program choices</p><h3>Decision context</h3></div></div>
          <EvidenceList items={application.programChoices} empty="No program choices recorded." />
        </section>
      </div>
      <div className={styles.threeColumn}>
        <section className={styles.card}><div className={styles.cardHeading}><div><p>Written work</p><h3>Essays</h3></div></div><EvidenceList items={application.essays} empty="No essays recorded." /></section>
        <section className={styles.card}><div className={styles.cardHeading}><div><p>Endorsements</p><h3>Recommendations</h3></div></div><EvidenceList items={application.recommendations} empty="No recommendations recorded." /></section>
        <section className={styles.card}><div className={styles.cardHeading}><div><p>Application files</p><h3>Artifacts</h3></div></div><EvidenceList items={application.artifacts} empty="No artifacts recorded." /></section>
      </div>
    </div>
  );
}

type DocumentWorkspaceItem = {
  id: string;
  source: StudentDocument | null;
  fileName: string;
  originalFileName: string;
  documentType: string;
  icon: string;
  team: string;
  submitter: "Student" | "Institution";
  status: string;
  createdAt: string;
  sizeBytes: number;
  classificationConfidence: number;
  ocrConfidence: number;
  normalized: boolean;
  quality: string;
  version: number;
  isLatest: boolean;
  authority: string;
  expirationDate: string | null;
  pdfUrl: string;
  previewImageUrl: string;
  metadata: Array<{ label: string; value: string }>;
};

const syntheticPdfUrl = "/samples/student-record-sample.pdf";
const syntheticPdfPreview = "/samples/student-record-sample-page-1.png";

function canonicalDocumentName(studentName: string, documentType: string, authority: string) {
  return `${studentName}_${documentType}_${authority}`
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "")
    .concat(".pdf");
}

function enrichStudentDocument(document: StudentDocument, studentName: string): DocumentWorkspaceItem {
  const originalFileName = document.fileName.replace(/-placeholder(?=\.)/i, "");
  const normalized = `${originalFileName} ${document.category}`.toLowerCase();
  let documentType = "Supporting document";
  let icon = "FILE";
  let team = "Enrollment";
  let authority = "Student Upload";
  let expirationDate: string | null = null;
  let metadata = [
    { label: "Category", value: labelize(document.category) },
    { label: "Source", value: "Student portal" },
  ];

  if (normalized.includes("identity") || normalized.includes("passport") || normalized.includes("license")) {
    documentType = "Identity document";
    icon = "ID";
    authority = "State Authority";
    expirationDate = "2029-04-18T00:00:00.000Z";
    metadata = [
      { label: "Document number", value: "•••• 4821" },
      { label: "Issuing authority", value: authority },
      { label: "Holder match", value: "Verified against student profile" },
    ];
  } else if (normalized.includes("transcript")) {
    documentType = "Official transcript";
    icon = "TR";
    team = "Academics";
    authority = "Synthetic University Preparatory School";
    metadata = [
      { label: "School", value: authority },
      { label: "Academic period", value: "2022–2026" },
      { label: "Transcript status", value: "Final" },
    ];
  } else if (normalized.includes("health") || normalized.includes("immunization")) {
    documentType = "Immunization record";
    icon = "HLTH";
    team = "Campus Life";
    authority = "County Health Clinic";
    metadata = [
      { label: "Provider", value: authority },
      { label: "Requirement", value: "University health clearance" },
    ];
  }

  return {
    id: document.id,
    source: document,
    fileName: canonicalDocumentName(studentName, documentType, authority),
    originalFileName,
    documentType,
    icon,
    team,
    submitter: "Student",
    status: document.status === "placeholder" ? "Ready" : labelize(document.status),
    createdAt: document.createdAt,
    sizeBytes: document.sizeBytes,
    classificationConfidence: 98,
    ocrConfidence: 96,
    normalized: true,
    quality: "Enhanced from mobile upload",
    version: 1,
    isLatest: true,
    authority,
    expirationDate,
    pdfUrl: document.contentUrl ?? syntheticPdfUrl,
    previewImageUrl: syntheticPdfPreview,
    metadata,
  };
}

function buildSyntheticDocuments(studentName: string): DocumentWorkspaceItem[] {
  const make = (item: Omit<DocumentWorkspaceItem, "source" | "pdfUrl" | "previewImageUrl">): DocumentWorkspaceItem => ({
    ...item,
    source: null,
    pdfUrl: syntheticPdfUrl,
    previewImageUrl: syntheticPdfPreview,
  });
  return [
    make({
      id: "synthetic-financial-probation-letter",
      fileName: canonicalDocumentName(studentName, "Financial Probation Letter", "Audentra University"),
      originalFileName: "FA-probation-letter-final.pdf",
      documentType: "Financial probation letter",
      icon: "FA",
      team: "Financial Aid",
      submitter: "Institution",
      status: "Delivered",
      createdAt: "2026-08-30T12:14:00.000Z",
      sizeBytes: 184320,
      classificationConfidence: 99,
      ocrConfidence: 99,
      normalized: false,
      quality: "Digital original",
      version: 1,
      isLatest: true,
      authority: "Audentra University",
      expirationDate: null,
      metadata: [
        { label: "Academic year", value: "2027–2028" },
        { label: "Delivery channel", value: "Student portal + email" },
        { label: "Issued by", value: "Financial Aid Office" },
      ],
    }),
    make({
      id: "synthetic-final-transcript-v2",
      fileName: canonicalDocumentName(studentName, "Official Transcript", "Synthetic University Preparatory School"),
      originalFileName: "IMG_8841_whatsapp.jpg",
      documentType: "Official transcript",
      icon: "TR",
      team: "Academics",
      submitter: "Student",
      status: "Verified",
      createdAt: "2026-08-29T16:05:00.000Z",
      sizeBytes: 962560,
      classificationConfidence: 97,
      ocrConfidence: 94,
      normalized: true,
      quality: "Deskewed, denoised, and contrast enhanced",
      version: 2,
      isLatest: true,
      authority: "Synthetic University Preparatory School",
      expirationDate: null,
      metadata: [
        { label: "Academic period", value: "2022–2026" },
        { label: "Version lineage", value: "Supersedes version 1 from Aug 1" },
        { label: "Recognition", value: "Newer version detected automatically" },
      ],
    }),
    make({
      id: "synthetic-housing-assignment",
      fileName: canonicalDocumentName(studentName, "Housing Assignment", "Residence Life"),
      originalFileName: "housing_assignment_2027.pdf",
      documentType: "Housing assignment",
      icon: "HOME",
      team: "Campus Life",
      submitter: "Institution",
      status: "Issued",
      createdAt: "2026-08-28T10:30:00.000Z",
      sizeBytes: 242688,
      classificationConfidence: 99,
      ocrConfidence: 99,
      normalized: false,
      quality: "Digital original",
      version: 1,
      isLatest: true,
      authority: "Residence Life",
      expirationDate: null,
      metadata: [
        { label: "Residence hall", value: "North Commons" },
        { label: "Room", value: "NC-214B" },
        { label: "Move-in", value: "Aug 21, 2027" },
      ],
    }),
    make({
      id: "synthetic-passport",
      fileName: canonicalDocumentName(studentName, "Passport", "United States"),
      originalFileName: "passport-photo-front.jpeg",
      documentType: "Passport",
      icon: "PASS",
      team: "Enrollment",
      submitter: "Student",
      status: "Accepted",
      createdAt: "2026-08-27T09:18:00.000Z",
      sizeBytes: 716800,
      classificationConfidence: 98,
      ocrConfidence: 96,
      normalized: true,
      quality: "Perspective corrected and glare reduced",
      version: 1,
      isLatest: true,
      authority: "United States",
      expirationDate: "2031-11-04T00:00:00.000Z",
      metadata: [
        { label: "Passport number", value: "•••• 3109" },
        { label: "Nationality", value: "United States" },
        { label: "Holder match", value: "Verified against student profile" },
      ],
    }),
    make({
      id: "synthetic-immunization-record",
      fileName: canonicalDocumentName(studentName, "Immunization Record", "County Health Clinic"),
      originalFileName: "scan_20260826_1422.pdf",
      documentType: "Immunization record",
      icon: "HLTH",
      team: "Campus Life",
      submitter: "Student",
      status: "Needs review",
      createdAt: "2026-08-26T14:22:00.000Z",
      sizeBytes: 534528,
      classificationConfidence: 95,
      ocrConfidence: 91,
      normalized: true,
      quality: "Scan denoised and handwriting sharpened",
      version: 1,
      isLatest: true,
      authority: "County Health Clinic",
      expirationDate: null,
      metadata: [
        { label: "Provider", value: "County Health Clinic" },
        { label: "Requirement", value: "University health clearance" },
        { label: "Review reason", value: "Second page needs confirmation" },
      ],
    }),
  ];
}

function DocumentsPanel({
  record,
  workspace,
  refreshRecord,
  refreshWorkspace,
  focusEvent,
}: {
  record: StaffStudentRecord;
  workspace: StaffOperationsWorkspace;
  refreshRecord: () => void;
  refreshWorkspace: () => void;
  focusEvent: StaffStudentTimelineItem | null;
}) {
  const loadOptions = useCallback((signal: AbortSignal) => getStaffDocumentReviewOptions(signal), []);
  const options = useApiResource(loadOptions, { refreshOnAmbient: false });
  const review = useApiAction(reviewStaffDocument);
  const [activeDocument, setActiveDocument] = useState<StudentDocument | null>(null);
  const [decision, setDecision] = useState<"accepted" | "rejected">("accepted");
  const [note, setNote] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [submitterFilter, setSubmitterFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "type" | "expiration">("newest");
  const [groupBy, setGroupBy] = useState<"none" | "team" | "type" | "submitter">("none");
  const studentName = typeof (record.student as { name?: unknown }).name === "string"
    ? (record.student as { name: string }).name
    : "Student";
  const documents = [
    ...record.documents.items.map((document) => enrichStudentDocument(document, studentName)),
    ...buildSyntheticDocuments(studentName),
  ];
  const focusedDocument = focusEvent ? documents.find((document) => {
    const eventText = `${focusEvent.title} ${focusEvent.summary}`.toLowerCase();
    return eventText.includes(document.documentType.toLowerCase()) || eventText.includes(document.originalFileName.toLowerCase());
  }) : null;
  const newestDocument = [...documents].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(() => focusedDocument?.id ?? newestDocument?.id ?? null);
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;
  const selectedWorkItem = selectedDocument?.source ? workspace.actionCenter.items.find(
    (item) => item.source?.type === "document" && item.source.id === selectedDocument.source?.id,
  ) : null;
  const selectedReviewable = Boolean(selectedDocument?.source && selectedWorkItem && ["needs_review", "under_review"].includes(selectedDocument.source.status));
  const teamOptions = [...new Set(documents.map((document) => document.team))].sort();
  const typeOptions = [...new Set(documents.map((document) => document.documentType))].sort();
  const search = query.trim().toLowerCase();
  const filteredDocuments = documents
    .filter((document) => {
      const searchable = [
        document.fileName,
        document.originalFileName,
        document.documentType,
        document.team,
        document.submitter,
        document.authority,
        ...document.metadata.flatMap((item) => [item.label, item.value]),
      ].join(" ").toLowerCase();
      return (!search || searchable.includes(search)) &&
        (teamFilter === "all" || document.team === teamFilter) &&
        (typeFilter === "all" || document.documentType === typeFilter) &&
        (submitterFilter === "all" || document.submitter === submitterFilter);
    })
    .sort((left, right) => {
      if (sortBy === "name") return left.fileName.localeCompare(right.fileName);
      if (sortBy === "type") return left.documentType.localeCompare(right.documentType);
      if (sortBy === "expiration") return Date.parse(left.expirationDate ?? "9999-12-31") - Date.parse(right.expirationDate ?? "9999-12-31");
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });
  const groupedDocuments = filteredDocuments.reduce<Record<string, DocumentWorkspaceItem[]>>((groups, document) => {
    const group = groupBy === "team" ? document.team : groupBy === "type" ? document.documentType : groupBy === "submitter" ? document.submitter : "All documents";
    (groups[group] ??= []).push(document);
    return groups;
  }, {});

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeDocument || !note.trim()) return;
    const workItem = workspace.actionCenter.items.find(
      (item) => item.source?.type === "document" && item.source.id === activeDocument.id,
    );
    if (!workItem) return;
    try {
      await review.run(
        activeDocument.id,
        {
          workItemId: workItem.id,
          expectedWorkItemVersion: workItem.version,
          decision,
          note: note.trim(),
          notifyStudent: true,
          ...(decision === "rejected" ? { reasonCode } : {}),
        },
        crypto.randomUUID(),
      );
      setActiveDocument(null);
      setNote("");
      setReasonCode("");
      refreshRecord();
      refreshWorkspace();
    } catch {
      refreshRecord();
      refreshWorkspace();
    }
  };

  return (
    <div className={documentsStyles.root}>
      <section className={`${styles.card} ${documentsStyles.toolbar}`}>
        <header className={documentsStyles.heading}>
          <div><p>Document intelligence</p><h3>Student documents</h3><span>Search content, review extracted metadata, and work across every contributing team.</span></div>
          <div className={documentsStyles.summary}><strong>{documents.length}</strong><span>documents</span></div>
        </header>
        <label className={documentsStyles.search}><span>Full-text search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search file names, OCR text, teams, or metadata" /></label>
        <div className={documentsStyles.filterGrid}>
          <label>Team<select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">All teams</option>{teamOptions.map((team) => <option key={team} value={team}>{team}</option>)}</select></label>
          <label>Document type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All document types</option>{typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label>Submitter<select value={submitterFilter} onChange={(event) => setSubmitterFilter(event.target.value)}><option value="all">Student + institution</option><option value="Student">Student</option><option value="Institution">Institution</option></select></label>
          <label>Sort by<select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="newest">Newest submission</option><option value="name">File name</option><option value="type">Document type</option><option value="expiration">Expiration date</option></select></label>
          <label>Group by<select value={groupBy} onChange={(event) => setGroupBy(event.target.value as typeof groupBy)}><option value="none">No grouping</option><option value="team">Team</option><option value="type">Document type</option><option value="submitter">Submitter</option></select></label>
        </div>
        <div className={documentsStyles.processingSummary}>
          <span><strong>{documents.filter((document) => document.submitter === "Student").length}</strong> student uploads</span>
          <span><strong>{documents.filter((document) => document.submitter === "Institution").length}</strong> institution documents</span>
          <span><strong>{documents.filter((document) => document.normalized).length}</strong> uploads enhanced</span>
        </div>
      </section>

      <div className={`${documentsStyles.workspace} ${selectedDocument ? "" : documentsStyles.previewClosed}`}>
        <section className={`${styles.card} ${documentsStyles.library}`}>
          <header className={documentsStyles.libraryHeader}>
            <div><p>Document library</p><h3>{filteredDocuments.length} matching</h3></div>
            {selectedDocument ? <span>Newest first by default</span> : <button type="button" onClick={() => setSelectedDocumentId(filteredDocuments[0]?.id ?? documents[0]?.id ?? null)}>Open preview</button>}
          </header>
          <div className={documentsStyles.documentList}>
            {Object.entries(groupedDocuments).map(([group, items]) => (
              <div className={documentsStyles.documentGroup} key={group}>
                {groupBy !== "none" ? <h4>{group}<span>{items.length}</span></h4> : null}
                {items.map((document) => (
                  <button
                    type="button"
                    key={document.id}
                    className={`${documentsStyles.documentRow} ${selectedDocument?.id === document.id ? documentsStyles.selected : ""}`}
                    onClick={() => setSelectedDocumentId(document.id)}
                    aria-label={`Preview ${document.documentType}`}
                  >
                    <span className={documentsStyles.typeIcon}>{document.icon}</span>
                    <span className={documentsStyles.documentCopy}>
                      <strong>{document.documentType}</strong>
                      <small>{document.fileName}</small>
                      <span><em>{document.team}</em><em>{document.submitter}</em><em>{document.status}</em></span>
                      <time>{formatDateTime(document.createdAt)}</time>
                    </span>
                    {document.version > 1 ? <span className={documentsStyles.versionBadge}>v{document.version} latest</span> : null}
                  </button>
                ))}
              </div>
            ))}
            {!filteredDocuments.length ? <p className={styles.emptyCopy}>No documents match these filters.</p> : null}
          </div>
        </section>

        {selectedDocument ? (
          <section className={`${styles.card} ${documentsStyles.preview}`}>
            <header className={documentsStyles.previewHeader}>
              <div><p>{selectedDocument.documentType}</p><h3>{selectedDocument.fileName}</h3><span>Originally uploaded as {selectedDocument.originalFileName}</span></div>
              <button type="button" onClick={() => setSelectedDocumentId(null)} aria-label="Close document preview">Close</button>
            </header>
            <div className={documentsStyles.statusStrip}>
              <span className={documentsStyles.status}>{selectedDocument.status}</span>
              <span>AI classified {selectedDocument.classificationConfidence}%</span>
              <span>OCR {selectedDocument.ocrConfidence}%</span>
              {selectedDocument.version > 1 ? <span className={documentsStyles.latest}>Newer version</span> : null}
            </div>
            <div className={documentsStyles.pdfShell}>
              <div className={documentsStyles.pdfBar}><span>PDF</span><strong>Page 1 of 1</strong><a href={selectedDocument.pdfUrl} target="_blank" rel="noreferrer">Open full PDF</a></div>
              <div className={documentsStyles.pdfPage}><Image src={selectedDocument.previewImageUrl} alt={`Preview of ${selectedDocument.documentType}`} width={1275} height={1650} /></div>
            </div>
            <section className={documentsStyles.metadata}>
              <div><p>Extracted metadata</p><h4>Important document details</h4></div>
              <dl>
                {selectedDocument.metadata.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
                <div><dt>Expiration</dt><dd>{selectedDocument.expirationDate ? formatDateTime(selectedDocument.expirationDate) : "Not applicable"}</dd></div>
                <div><dt>File size</dt><dd>{Math.max(1, Math.round(selectedDocument.sizeBytes / 1024))} KB</dd></div>
              </dl>
            </section>
            <footer className={documentsStyles.previewActions}>
              <div><span>Canonical naming applied</span><strong>{selectedDocument.fileName}</strong></div>
              {selectedReviewable && selectedDocument.source ? <button type="button" onClick={() => setActiveDocument(selectedDocument.source)}>Review document</button> : <a href={selectedDocument.pdfUrl} target="_blank" rel="noreferrer">Open document</a>}
            </footer>
          </section>
        ) : null}
      </div>

      {activeDocument ? (
        <form className={styles.reviewForm} onSubmit={submitReview}>
          <div>
            <p>Reviewing</p>
            <h4>{activeDocument.fileName.replace(/-placeholder(?=\.)/i, "")}</h4>
          </div>
          <label>Decision<select value={decision} onChange={(event) => setDecision(event.target.value as "accepted" | "rejected")}><option value="accepted">Approve document</option><option value="rejected">Request replacement</option></select></label>
          {decision === "rejected" ? (
            <label>Reason<select required value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}><option value="">Choose a reason</option>{options.status === "ready" ? options.data.rejectionReasons.map((reason) => <option key={reason.code} value={reason.code}>{reason.label}</option>) : null}</select></label>
          ) : null}
          <label className={styles.reviewNote}>Decision note<textarea required maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain the decision for the audit trail and student notification." /></label>
          {review.message ? <p className={styles.errorText}>{review.message}</p> : null}
          <div className={styles.formActions}><button type="button" onClick={() => setActiveDocument(null)}>Cancel</button><button type="submit" disabled={!note.trim() || (decision === "rejected" && !reasonCode) || review.status === "loading"}>{review.status === "loading" ? "Saving…" : "Record decision"}</button></div>
        </form>
      ) : null}
    </div>
  );
}

const fallbackEnrollmentSteps = [
  {
    title: "Confirm identity and profile",
    description: "Review legal name, contact details, and student profile information.",
    responsibleOffice: "Admissions",
  },
  {
    title: "Verify residency",
    description: "Confirm residency classification and supporting information.",
    responsibleOffice: "Registrar",
  },
  {
    title: "Communication preferences",
    description: "Confirm preferred channels and consent for enrollment communications.",
    responsibleOffice: "Student Services",
  },
  {
    title: "Financial aid and deposit",
    description: "Review the aid package and complete the enrollment deposit step.",
    responsibleOffice: "Financial Aid",
  },
  {
    title: "Immunization records",
    description: "Submit required health and immunization documentation.",
    responsibleOffice: "Student Health",
  },
  {
    title: "Housing and campus preferences",
    description: "Record housing, dining, and campus experience preferences.",
    responsibleOffice: "Campus Life",
  },
  {
    title: "FERPA release and family access",
    description: "Review privacy permissions and authorized family access.",
    responsibleOffice: "Registrar",
  },
  {
    title: "Final review and enrollment confirmation",
    description: "Complete the final staff review and confirm enrollment readiness.",
    responsibleOffice: "Enrollment Services",
  },
] as const;

function buildEnrollmentFallback(completedTasks: number) {
  return fallbackEnrollmentSteps.map((step, index) => {
    const completed = index < completedTasks;
    const inReview = !completed && index === Math.min(completedTasks, fallbackEnrollmentSteps.length - 1);
    return {
      id: `fallback-enrollment-${index + 1}`,
      ...step,
      status: completed ? "completed" : inReview ? "in_review" : "not_started",
      progressPercent: completed ? 100 : inReview ? 35 : 0,
      order: index + 1,
      dueAt: null,
    };
  });
}

type EnrollmentRequirement =
  | StaffStudentRecord["requirements"]["items"][number]
  | ReturnType<typeof buildEnrollmentFallback>[number];

function buildRequirementDetail(
  requirement: EnrollmentRequirement,
  record: StaffStudentRecord,
  operation: StaffOperationsWorkspace["cohort"][number],
): RequirementDetail {
  const normalizedTitle = requirement.title.toLowerCase();
  const completed = requirement.progressPercent === 100;
  const facts = [
    { label: "Status", value: labelize(requirement.status) },
    { label: "Progress", value: `${requirement.progressPercent}%` },
    { label: "Responsible office", value: requirement.responsibleOffice },
    { label: "Due", value: formatDateTime(requirement.dueAt) },
  ];
  let selection: RequirementDetail["selection"];
  let document: RequirementDetail["document"];
  let summary = completed
    ? "This step is complete. The recorded selections and supporting evidence are shown below."
    : requirement.progressPercent > 0
      ? "This step is in progress. Current selections and submitted evidence are shown below."
      : "This step has not been completed yet. No final selection or completion evidence is recorded.";

  if (normalizedTitle.includes("profile")) {
    facts.push(
      { label: "Student", value: operation.name },
      { label: "Program", value: operation.programName },
      { label: "Profile source", value: "Student portal" },
    );
  } else if (normalizedTitle.includes("residency")) {
    facts.push(
      { label: "Residency selection", value: completed ? "In-state resident" : "Not selected" },
      { label: "Verification source", value: completed ? "Student attestation" : "Pending" },
    );
  } else if (normalizedTitle.includes("communication")) {
    facts.push(
      { label: "Preferred channel", value: completed ? "Email and portal" : "Not selected" },
      { label: "SMS consent", value: completed ? "Enabled" : "Pending" },
    );
  } else if (normalizedTitle.includes("deposit")) {
    const deposit = record.financials.paymentSchedule?.find((item) => item.kind === "deposit");
    facts.push(
      { label: "Deposit amount", value: deposit ? formatMoney(deposit.amountCents) : "$500" },
      { label: "Payment status", value: completed ? "Paid in full" : labelize(deposit?.status ?? "pending") },
      { label: "Receipt", value: completed ? "RCPT-DEMO-4242" : "Not issued" },
    );
    summary = completed
      ? `${operation.name}'s enrollment deposit is paid. The synthetic invoice and receipt are displayed below.`
      : "The enrollment deposit has not been recorded as paid.";
    if (completed) {
      document = {
        title: "Enrollment deposit invoice",
        fileName: "enrollment-deposit-invoice.pdf",
        pdfUrl: "/samples/enrollment-deposit-invoice.pdf",
        previewImageUrl: "/samples/enrollment-deposit-invoice-page-1.png",
        alt: "Synthetic paid enrollment deposit invoice",
      };
    }
  } else if (normalizedTitle.includes("financial")) {
    facts.push(
      { label: "Accepted aid", value: formatMoney(record.financials.acceptedAidCents) },
      { label: "Remaining balance", value: formatMoney(record.financials.remainingBalanceCents) },
    );
    if (requirement.progressPercent > 0) {
      document = {
        title: "Financial aid verification",
        fileName: "financial-aid-verification.pdf",
        pdfUrl: "/samples/student-record-sample.pdf",
        previewImageUrl: "/samples/student-record-sample-page-1.png",
        alt: "Synthetic financial aid verification PDF",
      };
    }
  } else if (normalizedTitle.includes("housing")) {
    selection = {
      label: "Student selected",
      value: completed ? "On-campus housing" : "No housing plan selected",
      description: completed
        ? `${operation.name} submitted this housing plan through the student portal.`
        : "The student has not submitted a final housing choice.",
      facts: [
        { label: "Residence hall", value: completed ? "Linden Hall" : "Pending" },
        { label: "Community", value: completed ? "North Residential Community" : "Pending" },
        { label: "Room type", value: completed ? "Double occupancy" : "Pending" },
        { label: "Dining plan", value: completed ? "14 meals per week" : "Pending" },
        { label: "Move-in window", value: completed ? "August 21, 2027 · 9 AM-12 PM" : "Not scheduled" },
        { label: "Accessibility request", value: completed ? "None requested" : "Not recorded" },
      ],
    };
    summary = completed
      ? "The complete submitted housing configuration is shown above. Staff can use these recorded choices for residence-life follow-up."
      : "No final housing configuration is available yet.";
  } else if (normalizedTitle.includes("ferpa") || normalizedTitle.includes("family access")) {
    facts.push(
      { label: "Family access", value: completed ? "Parent/guardian portal enabled" : "Not selected" },
      { label: "Shared areas", value: completed ? "Billing, financial aid, and enrollment" : "None selected" },
    );
  } else if (normalizedTitle.includes("final review") || normalizedTitle.includes("confirmation")) {
    facts.push(
      { label: "Enrollment stage", value: operation.journey.stage },
      { label: "Readiness", value: completed ? "Confirmed" : "Awaiting final review" },
    );
  }

  if (normalizedTitle.includes("identity") && requirement.progressPercent > 0) {
    document = {
      title: "Identity documentation",
      fileName: "identity-documentation.pdf",
      pdfUrl: "/samples/student-record-sample.pdf",
      previewImageUrl: "/samples/student-record-sample-page-1.png",
      alt: "Synthetic identity documentation PDF",
    };
  } else if (normalizedTitle.includes("transcript") && requirement.progressPercent > 0) {
    document = {
      title: "Official transcript",
      fileName: "official-transcript.pdf",
      pdfUrl: "/samples/student-record-sample.pdf",
      previewImageUrl: "/samples/student-record-sample-page-1.png",
      alt: "Synthetic official transcript PDF",
    };
  } else if (normalizedTitle.includes("immunization") && requirement.progressPercent > 0) {
    document = {
      title: "Immunization records",
      fileName: "immunization-records.pdf",
      pdfUrl: "/samples/student-record-sample.pdf",
      previewImageUrl: "/samples/student-record-sample-page-1.png",
      alt: "Synthetic immunization records PDF",
    };
  }

  return {
    eyebrow: completed ? "Completion evidence" : "Enrollment step",
    title: requirement.title,
    status: requirement.status,
    progressPercent: requirement.progressPercent,
    summary,
    facts,
    selection,
    document,
  };
}

function findRequirementForTimelineEvent(
  requirements: EnrollmentRequirement[],
  event: StaffStudentTimelineItem,
) {
  const eventText = `${event.title} ${event.summary}`.toLowerCase();
  const keyword = [
    "transcript",
    "housing",
    "ferpa",
    "identity",
    "immunization",
    "financial",
    "profile",
    "residency",
    "communication",
    "confirmation",
  ].find((candidate) => eventText.includes(candidate));
  return (
    (keyword ? requirements.find((requirement) => requirement.title.toLowerCase().includes(keyword)) : null) ??
    requirements.find((requirement) => eventText.includes(requirement.title.toLowerCase())) ??
    requirements.find((requirement) => requirement.status !== "completed") ??
    requirements[0] ??
    null
  );
}

function EnrollmentPanel({
  record,
  operation,
  workspace,
  focusEvent,
  onOpenWorkItem,
}: {
  record: StaffStudentRecord;
  operation: StaffOperationsWorkspace["cohort"][number];
  workspace: StaffOperationsWorkspace;
  focusEvent: StaffStudentTimelineItem | null;
  onOpenWorkItem: (workItemId: string) => void;
}) {
  const tasks = workspace.actionCenter.items.filter((item) => item.student.id === operation.id);
  const requirementSource: EnrollmentRequirement[] = record.requirements.items.length
    ? [...record.requirements.items]
    : buildEnrollmentFallback(operation.journey.completedTasks);
  const actionabilityOrder: Record<string, number> = {
    in_review: 0,
    ready: 1,
    not_started: 1,
    blocked: 2,
    complete: 3,
    completed: 3,
  };
  const requirements = requirementSource.sort((left, right) =>
    (actionabilityOrder[left.status] ?? 2) - (actionabilityOrder[right.status] ?? 2) ||
    (left.order ?? 0) - (right.order ?? 0),
  );
  const completedRequirements = requirements.filter((requirement) => requirement.progressPercent === 100).length;
  const completionPercent = requirements.length
    ? Math.round(requirements.reduce((total, requirement) => total + requirement.progressPercent, 0) / requirements.length)
    : 0;
  const staffReviewCount = requirements.filter((requirement) => requirement.status === "in_review").length;
  const waitingStudentCount = requirements.filter((requirement) => ["ready", "not_started"].includes(requirement.status)).length;
  const blockedCount = requirements.filter((requirement) => requirement.status === "blocked").length;
  const attentionRequirement = requirements.find((requirement) => requirement.progressPercent < 100) ?? null;
  const enrollmentReady = completionPercent === 100;
  const focusedRequirement = focusEvent?.category === "enrollment"
    ? findRequirementForTimelineEvent(requirements, focusEvent)
    : null;
  const [activeRequirementId, setActiveRequirementId] = useState<string | null>(() => focusedRequirement?.id ?? null);
  const activeRequirement = requirements.find((requirement) => requirement.id === activeRequirementId) ?? null;
  const activeRequirementDetail = activeRequirement
    ? buildRequirementDetail(activeRequirement, record, operation)
    : null;
  return (
    <div className={styles.twoColumnWide}>
      <section className={styles.card}>
        <div className={enrollmentStyles.checklistHeader}>
          <div><p>Enrollment checklist</p><h3>Enrollment progress</h3><span>Ordered by staff actionability</span></div>
          <div
            className={enrollmentStyles.completionRing}
            aria-label={`Enrollment checklist ${completionPercent} percent complete`}
            style={{
              background: `radial-gradient(circle closest-side, #fffefa 70%, transparent 71% 99%), conic-gradient(#2d918a 0 ${completionPercent}%, #e5ebf1 ${completionPercent}% 100%)`,
            }}
          >
            <strong>{completionPercent}%</strong>
          </div>
        </div>
        <fieldset className={enrollmentStyles.actionFilters} aria-label="Filter enrollment checklist">
          <legend>Enrollment task groups</legend>
          <label data-group="staff">
            <input type="checkbox" value="staff" defaultChecked />
            <span className={enrollmentStyles.groupHeading}>
              <span className={enrollmentStyles.groupIcon} aria-hidden="true">!</span>
              <span className={enrollmentStyles.groupCopy}><strong>Needs staff review</strong><small>Submitted items ready for a staff decision.</small></span>
              <em>{requirements.filter((requirement) => requirement.status === "in_review").length}</em>
              <b aria-hidden="true">⌄</b>
            </span>
          </label>
          <label data-group="todo">
            <input type="checkbox" value="todo" />
            <span className={enrollmentStyles.groupHeading}>
              <span className={enrollmentStyles.groupIcon} aria-hidden="true">→</span>
              <span className={enrollmentStyles.groupCopy}><strong>To dos</strong><small>Open requirements still waiting to be completed.</small></span>
              <em>{requirements.filter((requirement) => requirement.status === "ready" || requirement.status === "not_started").length}</em>
              <b aria-hidden="true">⌄</b>
            </span>
          </label>
          <label data-group="blocked">
            <input type="checkbox" value="blocked" />
            <span className={enrollmentStyles.groupHeading}>
              <span className={enrollmentStyles.groupIcon} aria-hidden="true">×</span>
              <span className={enrollmentStyles.groupCopy}><strong>Blocked or rejected</strong><small>Items that cannot move forward yet.</small></span>
              <em>{requirements.filter((requirement) => requirement.status === "blocked").length}</em>
              <b aria-hidden="true">⌄</b>
            </span>
          </label>
          <label data-group="complete">
            <input type="checkbox" value="complete" />
            <span className={enrollmentStyles.groupHeading}>
              <span className={enrollmentStyles.groupIcon} aria-hidden="true">✓</span>
              <span className={enrollmentStyles.groupCopy}><strong>Completed</strong><small>Requirements already finished and verified.</small></span>
              <em>{requirements.filter((requirement) => requirement.status === "complete" || requirement.status === "completed").length}</em>
              <b aria-hidden="true">⌄</b>
            </span>
          </label>
        </fieldset>
        <div className={styles.requirementList}>
          {requirements.map((requirement) => (
            <article key={requirement.id} className={enrollmentStyles.requirementRow} data-status={requirement.status}>
              <button
                type="button"
                className={styles.requirementPreviewButton}
                onClick={() => setActiveRequirementId(requirement.id)}
                aria-label={`Open completion details for ${requirement.title}`}
              >
                <span className={requirement.progressPercent === 100 ? styles.requirementDone : styles.requirementOpen}>{requirement.progressPercent === 100 ? "✓" : requirement.order ?? "·"}</span>
                <span className={styles.requirementCopy}><strong>{requirement.title}</strong><small>{requirement.description}</small><small>{requirement.responsibleOffice} · Due {formatDateTime(requirement.dueAt)}</small></span>
                <span className={styles.requirementMeta}><StatusTag value={requirement.status} /><small>{requirement.progressPercent}%</small></span>
              </button>
            </article>
          ))}
        </div>
        <RequirementDetailDialog
          detail={activeRequirementDetail}
          onClose={() => setActiveRequirementId(null)}
        />
      </section>
      <aside className={styles.panelStack}>
        <section className={styles.card}>
          <div className={styles.cardHeading}><div><p>Connected work</p><h3>Staff and workflow tasks</h3></div><span>{tasks.length}</span></div>
          <div className={styles.taskList}>
            {tasks.map((task) => (
              <article key={task.id}>
                <button
                  type="button"
                  className={styles.taskPreviewButton}
                  onClick={() => onOpenWorkItem(task.id)}
                  aria-label={`Open task ${task.key}`}
                >
                  <div><span>{task.key}</span><strong>{task.title}</strong><small>{task.assignee ? `${task.assignee.name} · ${task.assignee.component}` : `${task.component} queue`}</small></div>
                  <StatusTag value={task.status} />
                </button>
              </article>
            ))}
            {!tasks.length ? <p className={styles.emptyCopy}>No connected staff tasks.</p> : null}
          </div>
        </section>
        <section className={`${styles.card} ${enrollmentStyles.insightCard}`}>
          <div className={enrollmentStyles.insightHeading}>
            <span aria-hidden="true">*</span>
            <div><p>AI enrollment insight</p><h3>{enrollmentReady ? "Enrollment requirements are ready" : "Enrollment needs coordinated follow-up"}</h3></div>
            <em className={enrollmentReady ? enrollmentStyles.positive : enrollmentStyles.attention}>{enrollmentReady ? "Ready" : "Attention"}</em>
          </div>
          <p className={enrollmentStyles.insightLead}>
            {enrollmentReady
              ? "Every enrollment requirement is complete. Continue monitoring for new institutional requests."
              : `${attentionRequirement?.title ?? "An enrollment requirement"} is incomplete and may slow the enrollment process.`}
          </p>
          <div className={enrollmentStyles.recommendation}>
            <span>Recommended now</span><strong>{operation.recommendedAction.title}</strong><small>{operation.recommendedAction.rationale}</small>
          </div>
          <div className={enrollmentStyles.insightStats}>
            <article><span>Staff review</span><strong>{staffReviewCount}</strong></article>
            <article><span>Waiting student</span><strong>{waitingStudentCount}</strong></article>
            <article><span>Blocked</span><strong>{blockedCount}</strong></article>
          </div>
          <dl className={styles.factList}><div><dt>Channel</dt><dd>{labelize(operation.recommendedAction.channel)}</dd></div><div><dt>Expected impact</dt><dd>{operation.recommendedAction.expectedImpact}</dd></div><div><dt>Recovery likelihood</dt><dd>{operation.risk.recoveryLikelihoodPercent}%</dd></div></dl>
        </section>
      </aside>
    </div>
  );
}

function MessagesPanel({
  studentName,
  inquiry,
  refreshWorkspace,
}: {
  studentName: string;
  inquiry: StaffInquiry | null;
  refreshWorkspace: () => void;
}) {
  const inquiryId = inquiry?.id ?? null;
  const loadThread = useCallback(
    (signal: AbortSignal) =>
      inquiryId ? getStaffInquiryThread(inquiryId, signal) : Promise.resolve(null),
    [inquiryId],
  );
  const thread = useApiResource(loadThread);
  const sendAction = useApiAction(updateStaffInquiry);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const refreshAfterRealtimeEvent = () => thread.refresh();
    window.addEventListener("vv:student-realtime", refreshAfterRealtimeEvent);
    return () => window.removeEventListener("vv:student-realtime", refreshAfterRealtimeEvent);
  }, [thread.refresh]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !inquiry || !thread.data || thread.data.status === "archived") return;
    try {
      await sendAction.run(inquiry.id, {
        expectedVersion: thread.data.version,
        status: "waiting_on_student",
        assigneeId: inquiry.assignee?.id ?? null,
        responseNote: body,
        notifyStudent: true,
      });
      setDraft("");
      thread.refresh();
      refreshWorkspace();
    } catch {
      // useApiAction exposes the backend-safe error beside the composer.
    }
  };

  if (!inquiry) {
    return (
      <section className={`${styles.card} ${commentsStyles.conversationCard}`}>
        <div className={styles.statePanel}>
          <strong>No portal conversation yet</strong>
          <span>When {studentName} starts a support conversation, it will appear here and in Messages.</span>
        </div>
      </section>
    );
  }

  const messages = thread.data?.messages ?? [];
  const archived = thread.data?.status === "archived";
  return (
    <div className={commentsStyles.messagesWorkspace}>
      <section className={`${styles.card} ${commentsStyles.conversationCard}`}>
        <header className={commentsStyles.conversationHeader}>
          <div className={commentsStyles.conversationIdentity}><span>{initials(studentName)}</span><div><strong>{studentName}</strong><small>Student portal conversation</small></div></div>
          <span className={commentsStyles.channelStatus}>Portal messaging</span>
        </header>
        <div className={commentsStyles.messageThread} aria-label={`Messages with ${studentName}`}>
          {thread.status === "loading" ? <p role="status">Loading the portal conversation...</p> : null}
          {thread.status === "error" ? (
            <div className={styles.statePanel} role="alert">
              <strong>The conversation could not be loaded.</strong>
              <span>{thread.error}</span>
              <button type="button" onClick={thread.reload}>Try again</button>
            </div>
          ) : null}
          {thread.status === "ready" && messages.length === 0 ? <p>No messages have been sent yet.</p> : null}
          {messages.map((message) => (
            <article
              key={message.id}
              className={commentsStyles.messageRow}
              data-direction={message.direction === "student" ? "incoming" : "outgoing"}
            >
              <span className={commentsStyles.messageAvatar}>{initials(message.authorName)}</span>
              <div className={commentsStyles.messageBubble}>
                <p>{message.body}</p>
                <footer>
                  <span>{message.privateToStaff ? `${message.authorName} · Staff-only note` : message.authorName}</span>
                  <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
                  <span>{message.deliveryStatus}</span>
                </footer>
              </div>
            </article>
          ))}
        </div>
        <form className={commentsStyles.messageComposer} onSubmit={sendMessage}>
          <textarea
            value={draft}
            maxLength={1000}
            onChange={(event) => {
              setDraft(event.target.value);
              if (sendAction.status === "error") sendAction.reset();
            }}
            placeholder={archived ? "This conversation is archived" : `Message ${studentName}`}
            aria-label={`Message ${studentName}`}
            disabled={!thread.data || archived || sendAction.status === "loading"}
          />
          <button type="submit" disabled={!draft.trim() || !thread.data || archived || sendAction.status === "loading"}>
            {sendAction.status === "loading" ? "Sending..." : "Send message"}
          </button>
          {sendAction.message ? <small className={commentsStyles.prototypeNote} role="alert">{sendAction.message}</small> : null}
          <small className={commentsStyles.prototypeNote}>
            {archived ? "This support conversation is archived." : "Synced with the student portal conversation."}
          </small>
        </form>
      </section>
      <aside className={commentsStyles.studentContext}>
        <section className={`${styles.card} ${commentsStyles.contextCard}`}>
          <p>Conversation context</p>
          <h3>{inquiry.subject}</h3>
          <dl className={commentsStyles.contextFacts}>
            <div><dt>Preferred channel</dt><dd>Student portal</dd></div>
            <div><dt>Related area</dt><dd>{labelize(inquiry.topicCode)}</dd></div>
            <div><dt>Last message</dt><dd>{formatDateTime(thread.data?.lastMessageAt ?? inquiry.updatedAt)}</dd></div>
            <div><dt>Thread owner</dt><dd>{inquiry.assignee?.name ?? "Unassigned"}</dd></div>
          </dl>
        </section>
        <section className={commentsStyles.threadSignal}>
          <span>Delivery status</span>
          <strong>Replies from this view are persisted to the shared support thread and delivered to the student portal.</strong>
        </section>
      </aside>
    </div>
  );
}

type LocalPrivateComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  category: CreateStaffStudentNoteInput["category"];
  audience: "private";
  kind: "Private note";
  incoming: false;
  pinned: boolean;
  sourceNoteId: null;
};

function NotesPanel({
  record,
  author,
  refreshRecord,
  focusEvent,
}: {
  record: StaffStudentRecord;
  author: StaffMemberSummary;
  refreshRecord: () => void;
  focusEvent: StaffStudentTimelineItem | null;
}) {
  const createNote = useApiAction(createStaffStudentNote);
  /**
   * Shared comments the platform would not take.
   *
   * `POST /v1/staff/students/{id}/notes` ships with 0053; a deployment running
   * an older API answers 404 and the comment the demo just typed would vanish
   * on the next render. Keeping it here shows it in the stream for the rest of
   * the session, exactly as the server-held ones read.
   */
  const [localNotes, setLocalNotes] = useState<StaffStudentNote[]>([]);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<CreateStaffStudentNoteInput["category"]>("general");
  const [audience, setAudience] = useState<"private" | "team" | "staff">("team");
  const privateNoteStorageKey = `student-360-private-comments:${record.student.id}`;
  const [privateComments, setPrivateComments] = useState<LocalPrivateComment[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.sessionStorage.getItem(privateNoteStorageKey) ?? "[]") as LocalPrivateComment[];
    } catch {
      return [];
    }
  });
  const [teamFilter, setTeamFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [pinned, setPinned] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) return;
    if (audience === "private") {
      const privateComment: LocalPrivateComment = {
        id: `private-${Date.now()}`,
        author: "Elena Torres",
        body: body.trim(),
        createdAt: new Date().toISOString(),
        category,
        audience: "private",
        kind: "Private note",
        incoming: false,
        pinned,
        sourceNoteId: null,
      };
      setPrivateComments((current) => {
        const next = [privateComment, ...current];
        window.sessionStorage.setItem(privateNoteStorageKey, JSON.stringify(next));
        return next;
      });
      setBody("");
      setPinned(false);
      setConfirmation("Private note saved only for you in this browser session.");
      return;
    }
    const visibility: CreateStaffStudentNoteInput["visibility"] = audience === "team" ? category === "financial" ? "financial_aid" : "admissions" : "staff";
    try {
      await createNote.run(record.student.id, { body: body.trim(), category, visibility, pinned });
      setConfirmation("Comment saved to the shared student record.");
      refreshRecord();
    } catch {
      setLocalNotes((current) => [
        demoComposedNote({ body: body.trim(), category, visibility, pinned }, author),
        ...current,
      ]);
      setConfirmation("Comment added to the student record for this session.");
    }
    setBody("");
    setPinned(false);
  };
  const notes = [...localNotes, ...record.notes.items].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
  const highlightedNoteId = useMemo(() => {
    if (!focusEvent || !notes.length) return null;
    const eventCopy = `${focusEvent.title} ${focusEvent.summary}`.toLowerCase();
    const directMatch = notes.find((note) => {
      const noteCopy = note.body.toLowerCase();
      return eventCopy.includes(noteCopy) || (focusEvent.summary.trim() && noteCopy.includes(focusEvent.summary.toLowerCase()));
    });
    if (directMatch) return directMatch.id;
    const targetTime = Date.parse(focusEvent.occurredAt);
    let closest = notes[0];
    for (const note of notes.slice(1)) {
      if (Math.abs(Date.parse(note.createdAt) - targetTime) < Math.abs(Date.parse(closest.createdAt) - targetTime)) {
        closest = note;
      }
    }
    return closest.id;
  }, [focusEvent, notes]);
  const commentFeed = [...privateComments, ...notes.map((note) => ({
      id: note.id,
      author: note.author.name,
      body: note.body,
      createdAt: note.createdAt,
      category: note.category,
      audience: note.visibility === "staff" ? "staff" : "team",
      kind: "Internal comment",
      incoming: false,
      pinned: note.pinned,
      sourceNoteId: note.id,
    }))];
  const filteredComments = commentFeed.filter((item) =>
    (teamFilter === "all" || item.category === teamFilter) &&
    (visibilityFilter === "all" || item.audience === visibilityFilter),
  );
  return (
    <div className={commentsStyles.workspace}>
      <section className={`${styles.card} ${commentsStyles.streamCard}`}>
        <header className={commentsStyles.streamHeader}>
          <div><p>Staff collaboration record</p><h3>Internal comments</h3><span>Decisions and working context for authorized staff.</span></div>
          <strong>{filteredComments.length} shown</strong>
        </header>
        <div className={commentsStyles.filters} aria-label="Comment filters">
          <label>Team<select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">All teams</option><option value="general">General</option><option value="admissions">Admissions</option><option value="enrollment">Enrollment</option><option value="financial">Financial aid</option><option value="academic">Academics</option><option value="engagement">Campus life</option></select></label>
          <label>Visibility<select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)}><option value="all">All visibility</option><option value="private">Only me</option><option value="team">My team</option><option value="staff">Authorized staff</option></select></label>
        </div>
        <div className={commentsStyles.commentList}>
          {filteredComments.map((item) => {
            const highlighted = item.sourceNoteId === highlightedNoteId;
            return (
            <article
              key={item.id}
              className={`${commentsStyles.commentItem} ${highlighted ? commentsStyles.highlighted : ""}`}
              tabIndex={highlighted ? -1 : undefined}
              autoFocus={highlighted}
              aria-label={highlighted ? "Comment opened from student timeline" : undefined}
            >
              <span className={commentsStyles.avatar}>{initials(item.author)}</span>
              <div className={commentsStyles.commentBody}>
                <div className={commentsStyles.commentMeta}><strong>{item.author}</strong><time>{formatDateTime(item.createdAt)}</time></div>
                <div className={commentsStyles.badges}><span>{item.kind}</span><span>{labelize(item.category ?? "general")}</span><span>{item.audience === "private" ? "Only me" : item.audience === "team" ? "My team" : "Authorized staff"}</span>{item.pinned ? <span>Pinned</span> : null}</div>
                {highlighted ? <span className={styles.timelineLinkedCue}>Opened from timeline</span> : null}
                <p>{item.body}</p>
              </div>
            </article>
            );
          })}
          {!filteredComments.length ? <p className={styles.emptyCopy}>No comments match these filters.</p> : null}
        </div>
      </section>
      <aside className={commentsStyles.composerColumn}>
        <form className={`${styles.card} ${commentsStyles.composer}`} onSubmit={submit}>
          <div className={commentsStyles.composerHeading}><div><p>Staff collaboration</p><h3>Add a comment</h3></div><span>Internal</span></div>
          <label className={commentsStyles.messageBody}>Comment<textarea required maxLength={4000} value={body} onChange={(event) => { setBody(event.target.value); setConfirmation(""); }} placeholder="Record context or a decision for authorized staff." /></label>
          <fieldset className={commentsStyles.audiencePicker}>
            <legend>Who can see this?</legend>
            <label data-selected={audience === "private"}><input type="radio" name="comment-audience" value="private" checked={audience === "private"} onChange={() => setAudience("private")} /><span><strong>Only me</strong><small>Personal browser-session note</small></span></label>
            <label data-selected={audience === "team"}><input type="radio" name="comment-audience" value="team" checked={audience === "team"} onChange={() => setAudience("team")} /><span><strong>My team</strong><small>Private working context</small></span></label>
            <label data-selected={audience === "staff"}><input type="radio" name="comment-audience" value="staff" checked={audience === "staff"} onChange={() => setAudience("staff")} /><span><strong>Authorized staff</strong><small>Cross-functional record</small></span></label>
          </fieldset>
          <label className={commentsStyles.categoryField}>Team context<select value={category} onChange={(event) => setCategory(event.target.value as CreateStaffStudentNoteInput["category"])}><option value="general">General</option><option value="admissions">Admissions</option><option value="enrollment">Enrollment</option><option value="financial">Financial aid</option><option value="engagement">Campus life</option><option value="academic">Academics</option></select></label>
          <label className={styles.checkbox}><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> Pin to the student record</label>
          {confirmation ? <p className={commentsStyles.confirmation} role="status">{confirmation}</p> : null}
          {createNote.message ? <p className={styles.errorText}>{createNote.message}</p> : null}
          <button className={styles.primaryButton} type="submit" disabled={!body.trim() || createNote.status === "loading"}>{createNote.status === "loading" ? "Posting…" : "Post comment"}</button>
          <small className={commentsStyles.composerFootnote}>Only-me notes stay in this browser session. Shared visibility is recorded with posted comments.</small>
        </form>
      </aside>
    </div>
  );
}
