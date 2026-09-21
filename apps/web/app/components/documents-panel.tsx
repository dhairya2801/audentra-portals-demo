"use client";

import type {
  StudentDocument,
  StudentRequirementDetail,
} from "@vv/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import EntryRow from "../design-system/patterns/EntryRow.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import { useApiAction } from "../hooks/use-api-resource";
import { confirmStudentDocumentExtraction } from "../lib/api-client";
import {
  defaultAcceptedDocumentExtractionFieldKeys,
  documentExtractionFailurePresentation,
} from "../lib/document-extraction-ui";
import { DocumentContextMatches } from "./document-context-matches";
import { DocumentExtractionRetry } from "./document-extraction-retry";
import { DocumentUpload } from "./document-upload";
import { SecureStudentDocumentLink } from "./secure-student-document-link";
import { TenantLink as Link } from "./tenant-link";
import { useTenant } from "./tenant-provider";
import { formatDate, formatFileSize } from "./profile-logic";

/**
 * My Documents — the reference's `DocumentsPanel` rendered inline as a section
 * of Profile, reading the record the platform holds: every document
 * requirement on the checklist, and every file the student has sent.
 *
 * The spine is the reference's: cut by who owes the next move — what still
 * needs her first, then the record, with the caption on each run saying which
 * way the file went. Opening a row opens `DocumentDrawer` on top; a
 * requirement that has not been sent yet is sent from its checklist step, the
 * one door it has, so the drawer routes there rather than growing a second
 * upload. Anything outside the checklist is sent from the door at the foot.
 */

export type DocumentState =
  | "needed"
  | "checking"
  | "in-review"
  | "review"
  | "accepted"
  | "changes-requested";

const STATES: Record<
  DocumentState,
  { label: string; tone: "act" | "progress" | "wait" | "done" | "stop"; holder: "you" | "aster" | "nobody" }
> = {
  needed: { label: "Not sent", tone: "act", holder: "you" },
  checking: { label: "Sent", tone: "progress", holder: "nobody" },
  "in-review": { label: "In review", tone: "wait", holder: "aster" },
  review: { label: "Check it", tone: "act", holder: "you" },
  accepted: { label: "Accepted", tone: "done", holder: "nobody" },
  "changes-requested": { label: "Came back", tone: "stop", holder: "you" },
};

const HERS = new Set<DocumentState>(["needed", "changes-requested", "review"]);

export interface DocumentRowModel {
  id: string;
  title: string;
  office: string;
  state: DocumentState;
  line: string;
  consequence: string | null;
  requirement: StudentRequirementDetail | null;
  document: StudentDocument | null;
  /** Every file sent for this row, newest last. */
  files: StudentDocument[];
  daysLeft: number | null;
}

function categoryLabel(category: StudentDocument["category"]) {
  switch (category) {
    case "identity":
      return "Identity document";
    case "residency":
      return "Proof of residency";
    case "transcript":
      return "Transcript";
    case "financial_aid":
      return "Financial aid document";
    case "health":
      return "Health record";
    case "consent":
      return "Signed authorization";
    default:
      return "Document";
  }
}

function officeForCategory(category: StudentDocument["category"], financialAidLabel: string | null) {
  switch (category) {
    case "identity":
    case "transcript":
    case "consent":
      return "Office of the Registrar";
    case "financial_aid":
      return financialAidLabel ?? "Financial Aid";
    case "health":
      return "Student Health";
    default:
      return "Admissions";
  }
}

function documentState(document: StudentDocument): DocumentState {
  if (document.signature) return "accepted";
  if (document.extraction?.status === "processing") return "checking";
  switch (document.status) {
    case "placeholder":
      return "needed";
    case "processing":
      return "checking";
    case "needs_review":
      return "review";
    case "accepted":
    case "waived":
      return "accepted";
    case "rejected":
    case "needs_resubmission":
      return "changes-requested";
    default:
      return "in-review";
  }
}

function requirementState(
  requirement: StudentRequirementDetail,
  files: StudentDocument[],
): DocumentState {
  if (files.some((file) => file.extraction?.status === "processing")) return "checking";
  switch (requirement.status) {
    case "completed":
    case "waived":
      return "accepted";
    case "submitted":
    case "under_review":
    case "help_requested":
      return "in-review";
    case "rejected":
      return "changes-requested";
    default:
      return files.some((file) => file.status === "needs_review") ? "review" : "needed";
  }
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const due = Date.parse(value);
  if (!Number.isFinite(due)) return null;
  return Math.ceil((due - Date.now()) / 86_400_000);
}

function deadlineLabel(days: number) {
  if (days < 0) return `${-days} ${days === -1 ? "day" : "days"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function escalation(days: number) {
  if (days <= 3) return "urgent";
  if (days <= 7) return "soon";
  return null;
}

function decisionOf(files: StudentDocument[]) {
  const latest = [...files].reverse().find((file) => file.review);
  return latest?.review ?? null;
}

/** The record, cut into rows the reference's `DocumentRow` can draw. */
export function buildRows(
  requirements: readonly StudentRequirementDetail[],
  documents: readonly StudentDocument[],
  options: { financialAidLabel: string | null; locale: string },
): DocumentRowModel[] {
  // A placeholder is a stub the platform seeds before anything is sent; it is
  // not a file the student sent and never draws a row of its own.
  const sortedDocuments = documents
    .filter((document) => document.status !== "placeholder")
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  const claimed = new Set<string>();
  const rows: DocumentRowModel[] = [];

  for (const requirement of requirements) {
    if (requirement.submissionType !== "document" || requirement.status === "not_applicable") {
      continue;
    }
    // A file sent for the step carries its id; one sent before the link existed
    // is matched by the category the step asks for, so one record is one row.
    let files = sortedDocuments.filter((file) => file.requirementId === requirement.id);
    if (files.length === 0 && requirement.documentCategory) {
      files = sortedDocuments.filter(
        (file) =>
          !file.requirementId &&
          !claimed.has(file.id) &&
          !file.signature &&
          file.category === requirement.documentCategory,
      );
    }
    files.forEach((file) => claimed.add(file.id));
    const state = requirementState(requirement, files);
    const decision = decisionOf(files);
    const office = requirement.responsibleOffice;
    const accepted = decision?.decision === "accepted" ? formatDate(decision.decidedAt, options.locale) : null;
    rows.push({
      id: `requirement:${requirement.id}`,
      title: requirement.title,
      office,
      state,
      line:
        state === "needed"
          ? `Not sent yet · ${office} is waiting for it`
          : state === "checking"
            ? "Edward is reading it. You can leave this page. It keeps going."
            : state === "in-review"
              ? `With ${office}`
              : state === "review"
                ? "Edward read your file. Check what it read before it goes to the office."
                : state === "accepted"
                  ? accepted
                    ? `Accepted ${accepted} · ${office}`
                    : `Accepted · ${office}`
                  : `Sent back by ${office}`,
      consequence: state === "changes-requested" ? (decision?.note ?? null) : null,
      requirement,
      document: null,
      files,
      daysLeft: daysUntil(requirement.dueAt),
    });
  }

  for (const document of sortedDocuments) {
    if (claimed.has(document.id)) continue;
    const state = documentState(document);
    const office = officeForCategory(document.category, options.financialAidLabel);
    const signed = document.signature ? formatDate(document.signature.signedAt, options.locale) : null;
    const decided = document.review ? formatDate(document.review.decidedAt, options.locale) : null;
    rows.push({
      id: `document:${document.id}`,
      title:
        document.signature?.title ??
        (document.extraction?.status === "completed" && document.extraction.documentType !== "other"
          ? `${categoryLabel(document.category)} · ${document.fileName}`
          : document.fileName),
      office,
      state,
      line: document.signature
        ? `Signed ${signed ?? ""} · ${document.signature.method} signature`.replace("  ", " ")
        : state === "needed"
          ? `Not sent yet · ${office} is waiting for it`
          : state === "checking"
            ? "Edward is reading it. You can leave this page. It keeps going."
            : state === "in-review"
              ? `With ${office}`
              : state === "review"
                ? "Edward read your file. Check what it read before it goes to the office."
                : state === "accepted"
                  ? decided
                    ? `Accepted ${decided} · ${office}`
                    : `Accepted · ${office}`
                  : `Sent back by ${office}`,
      consequence: state === "changes-requested" ? (document.review?.note ?? null) : null,
      requirement: null,
      document,
      files: [document],
      daysLeft: null,
    });
  }

  return rows;
}

export function needsYou(rows: readonly DocumentRowModel[]) {
  return rows.filter((row) => HERS.has(row.state));
}

export function onRecord(rows: readonly DocumentRowModel[]) {
  return rows.filter((row) => !HERS.has(row.state));
}

function standingLede({
  unavailable,
  mine,
  checking,
  withAster,
  tenantShortName,
}: {
  unavailable: boolean;
  mine: number;
  checking: boolean;
  withAster: number;
  tenantShortName: string;
}) {
  if (unavailable) {
    return `Everything you have sent ${tenantShortName}, and everything ${tenantShortName} has sent you. What ${tenantShortName} decided could not be read just now, so nothing below is shown as settled.`;
  }
  if (checking) {
    return "Something you just sent is still being read. You can leave this page. It keeps going without you.";
  }
  if (mine > 0) {
    return `${mine === 1 ? "One document needs" : `${mine} documents need`} something from you. Everything else is with ${tenantShortName} or settled.`;
  }
  if (withAster > 0) {
    return `Nothing needs you. What is left is with ${tenantShortName}, and each one says who is holding it.`;
  }
  return `Everything ${tenantShortName} asked for has been accepted. This is the whole record.`;
}

export default function DocumentsPanel({
  requirements,
  documents,
  unavailable,
  openId,
  onOpenChange,
  onDocumentChanged,
  onRetry,
}: {
  requirements: readonly StudentRequirementDetail[];
  documents: readonly StudentDocument[];
  /** The record could not be read for this session. */
  unavailable: boolean;
  /** The row to open, from `?document=<id>`; cleared once opened. */
  openId: string | null;
  onOpenChange: (open: boolean) => void;
  onDocumentChanged: (document: StudentDocument) => void;
  onRetry: () => void;
}) {
  const { tenant } = useTenant();
  const rows = buildRows(requirements, documents, {
    financialAidLabel: tenant.contacts.financialAid?.label ?? null,
    locale: tenant.localization.locale,
  });
  // `?document=<id>` opens that row once, when the panel first draws.
  const [open, setOpen] = useState<string | null>(() => {
    if (!openId) return null;
    const row = rows.find(
      (item) => item.document?.id === openId || item.files.some((file) => file.id === openId),
    );
    return row?.id ?? null;
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    onOpenChange(Boolean(open) || sending);
  }, [open, sending, onOpenChange]);

  useEffect(() => () => onOpenChange(false), [onOpenChange]);

  const mine = unavailable ? [] : needsYou(rows);
  const settled = unavailable ? [] : onRecord(rows);
  const rejected = unavailable ? null : (rows.find((row) => row.state === "changes-requested") ?? null);
  const checking = unavailable ? null : (rows.find((row) => row.state === "checking") ?? null);
  const withAster = rows.filter((row) => row.state === "checking" || row.state === "in-review").length;
  const opened = rows.find((row) => row.id === open) ?? null;
  const sentByYou = settled.filter((row) => !row.document?.signature);
  const signed = settled.filter((row) => row.document?.signature);

  return (
    <>
      <section className="section-card documents-section" aria-labelledby="documents-section-title">
        <div className="status-heading">
          <span className="status-icon record">
            <Icon name="file" size={18} />
          </span>
          <div>
            <h2 id="documents-section-title">Everything on file</h2>
            <p>
              {standingLede({
                unavailable,
                mine: mine.length,
                checking: Boolean(checking),
                withAster,
                tenantShortName: tenant.shortName,
              })}
            </p>
          </div>
        </div>

        {rejected && (
          <Notice
            tone="urgent"
            icon="alert"
            title={`${rejected.title} · sent back`}
            action={{ label: "See what to fix", onClick: () => setOpen(rejected.id) }}
          >
            {rejected.office} sent it back{rejected.consequence ? " and said why" : ""}. Send a new
            copy in the same place. Nothing else on your record is affected.
          </Notice>
        )}

        <section className="panel-run" aria-labelledby="panel-needs-title">
          <p className="panel-label" id="panel-needs-title">
            <span>What {tenant.shortName} still needs</span>
            {!unavailable && mine.length > 0 && <span className="status-count">{mine.length}</span>}
          </p>

          {unavailable ? (
            <StateCard
              variant="error"
              icon="alert"
              title="Your documents couldn’t be read"
              action={{ label: "Try again", icon: "refresh", onClick: onRetry }}
            >
              Your files are safe and nothing has changed on your record. Until this loads, nothing
              here is shown as accepted. An unread decision is not the same as a decision.
            </StateCard>
          ) : mine.length === 0 ? (
            <StateCard variant="empty" icon="check" title="Nothing is waiting on you">
              Every document {tenant.shortName} has asked for is either settled or with{" "}
              {tenant.shortName}. If something comes back, it appears here and on your enrollment
              checklist at the same time.
            </StateCard>
          ) : (
            <div className="card-rows document-list">
              {mine.map((row) => (
                <DocumentRow key={row.id} row={row} onOpen={() => setOpen(row.id)} />
              ))}
            </div>
          )}
        </section>

        <section className="panel-run" aria-labelledby="panel-record-title">
          <p className="panel-label" id="panel-record-title">
            <span>On your record</span>
          </p>

          {checking ? (
            <Notice tone="working" icon="clock" title={`Edward is reading your ${checking.title.toLowerCase()}`}>
              You can go somewhere else. It keeps going, and your record shows where it got to
              whenever you come back.
            </Notice>
          ) : null}

          {unavailable ? (
            <StateCard variant="empty" icon="alert" title="Your record is here, but not readable yet">
              Nothing has been lost and nothing has changed. The files you sent are on your record.
              It is what {tenant.shortName} decided about them that could not be loaded.
            </StateCard>
          ) : settled.length === 0 ? (
            <StateCard variant="empty" icon="file" title="Nothing on the record yet">
              The first entry arrives when you send something {tenant.shortName} asked for, or when
              you sign something during enrollment. Both land here, and both stay.
            </StateCard>
          ) : (
            <div className="card-rows document-list">
              {sentByYou.length > 0 && (
                <>
                  <p className="rows-caption">Sent by you</p>
                  {sentByYou.map((row) => (
                    <DocumentRow key={row.id} row={row} onOpen={() => setOpen(row.id)} />
                  ))}
                </>
              )}
              {signed.length > 0 && (
                <>
                  <p className="rows-caption">Signed by you</p>
                  {signed.map((row) => (
                    <DocumentRow key={row.id} row={row} onOpen={() => setOpen(row.id)} />
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        {!unavailable ? (
          <section className="panel-run" aria-labelledby="panel-send-title">
            <p className="panel-label" id="panel-send-title">
              <span>Something else</span>
            </p>
            <div className="card-rows">
              <EntryRow
                icon="upload"
                title={`Send ${tenant.shortName} a document`}
                note="Anything outside your checklist. It is stored with your record and routed to the office that reads it."
                where="Open"
                onOpen={() => setSending(true)}
              />
            </div>
          </section>
        ) : null}

        <p className="card-foot panel-foot">
          <Icon name="shield" size={14} />
          <span>
            Every file you send is kept exactly as you sent it. {tenant.shortName} never writes over
            your first file — the new one sits next to it, and the reason the first came back stays
            readable.
          </span>
        </p>
      </section>

      {opened && (
        <DocumentDrawer
          row={opened}
          onClose={() => setOpen(null)}
          onDocumentChanged={onDocumentChanged}
        />
      )}

      {sending && (
        <Drawer
          variant="document"
          label={[tenant.shortName, "Send a document"]}
          titleId="send-document-title"
          closeLabel="Close"
          onClose={() => setSending(false)}
        >
          <div className="drawer-icon">
            <Icon weight="duotone" name="upload" size={25} />
          </div>
          <h2 id="send-document-title">Send {tenant.shortName} a document</h2>
          <p className="document-lede">
            For anything your checklist did not ask for. Something it did ask for is sent from its
            own step, so there is only ever one place it can go.
          </p>
          <section className="document-upload" aria-label="Send a document">
            <DocumentUpload onUploaded={onDocumentChanged} />
          </section>
        </Drawer>
      )}
    </>
  );
}

function DocumentRow({ row, onOpen }: { row: DocumentRowModel; onOpen: () => void }) {
  const info = STATES[row.state];
  const level = typeof row.daysLeft === "number" ? escalation(row.daysLeft) : null;
  const showDeadline = typeof row.daysLeft === "number" && info.holder === "you";

  return (
    <button
      className={`document-row ${info.tone}`}
      onClick={onOpen}
      aria-label={`${row.title}, ${info.label}, ${row.office}`}
    >
      <span className={`document-tile ${info.tone}`} aria-hidden="true">
        <Icon name={row.state === "accepted" ? "check" : row.document?.signature ? "pen" : "file"} size={17} />
      </span>

      <span className="document-body">
        <strong>{row.title}</strong>
        <span className="document-state">
          {row.state === "checking" && <i className="pulse" aria-hidden="true" />}
          {row.line}
        </span>
        {row.consequence && (
          <span className="document-consequence">
            <Icon name="alert" size={13} /> {row.consequence}
          </span>
        )}
      </span>

      <span className="document-trail">
        {showDeadline && row.daysLeft !== null && (
          <span className={`deadline-chip${level ? ` ${level}` : ""}`}>{deadlineLabel(row.daysLeft)}</span>
        )}
        <span className="document-open" aria-hidden="true">
          <Icon name="arrow" size={15} />
        </span>
      </span>
    </button>
  );
}

function DocumentDrawer({
  row,
  onClose,
  onDocumentChanged,
}: {
  row: DocumentRowModel;
  onClose: () => void;
  onDocumentChanged: (document: StudentDocument) => void;
}) {
  const { tenant } = useTenant();
  const info = STATES[row.state];
  const decision = decisionOf(row.files);
  const requirement = row.requirement;
  const routeAway = Boolean(requirement) && info.holder === "you";
  const history = [...row.files].reverse();
  const subject = row.document ?? history[0] ?? null;

  return (
    <Drawer
      variant="document"
      label={[row.office, info.label]}
      titleId="document-drawer-title"
      closeLabel="Close document"
      onClose={onClose}
    >
      <div className="drawer-icon">
        <Icon weight="duotone" name={subject?.signature ? "pen" : "file"} size={25} />
      </div>
      <h2 id="document-drawer-title">{row.title}</h2>
      <p className="document-lede" role="status">
        {row.line}
      </p>

      {row.state === "changes-requested" && (
        <section className="reject-panel" aria-labelledby="reject-title">
          <h3 id="reject-title">
            <Icon name="alert" size={17} /> Why it came back
          </h3>
          <p className="reject-reason">
            {decision?.note ?? `${row.office} asked for another copy. Send it from the same place.`}
          </p>
          <p className="reject-by">
            {row.office}
            {decision ? ` · ${formatDate(decision.decidedAt, tenant.localization.locale)}` : ""}
          </p>
        </section>
      )}

      <section className="document-brief">
        <h3>What {tenant.shortName} needs</h3>
        <p>
          {requirement
            ? requirement.description
            : subject?.signature
              ? `Your signed ${subject.signature.title.toLowerCase()}, kept with your record.`
              : subject
                ? `${categoryLabel(subject.category)}, stored with your record and read by ${row.office}.`
                : ""}
        </p>
        {subject ? (
          <p className="document-accepts">
            {subject.mimeType === "application/pdf" ? "PDF" : subject.mimeType === "image/png" ? "PNG" : "JPG"} ·{" "}
            {formatFileSize(subject.sizeBytes)}
            {subject.sha256 ? ` · integrity checked ${subject.sha256.slice(0, 8)}` : ""}
          </p>
        ) : (
          <p className="document-accepts">PDF, JPG or PNG · up to 10 MB each · up to 8 files</p>
        )}
        {requirement?.blocking && row.state !== "accepted" ? (
          <p className="document-unblocks">
            <Icon name="lock" size={14} /> Your enrollment does not finish until this is settled.
          </p>
        ) : null}
      </section>

      {routeAway && requirement ? (
        <div className="document-route">
          <p>
            This one is a step on your checklist, and that is where it is sent from, so there is
            only ever one place it can be submitted.
          </p>
          <Link className="primary-button" href={`/enrollment/requirements/${requirement.slug}`}>
            Open the step <Icon name="arrow" size={17} />
          </Link>
        </div>
      ) : null}

      {subject && !subject.signature && subject.extraction ? (
        <ExtractionReview
          key={`${subject.id}:${subject.extraction.status}:${subject.extraction.processedAt ?? ""}`}
          document={subject}
          onDocumentChanged={onDocumentChanged}
        />
      ) : null}

      {subject?.signature ? (
        <section className="document-brief">
          <h3>How it was signed</h3>
          <p>
            Signed by {subject.signature.signerName} · {subject.signature.method} signature ·
            onboarding v{subject.signature.onboardingVersion}.
          </p>
        </section>
      ) : null}

      <section className="document-history" aria-labelledby="history-title">
        <h3 id="history-title">Everything you have sent</h3>
        {history.length === 0 ? (
          <p className="inline-empty">
            Nothing has been sent for this one yet. When you send something it stays here, and so
            does whatever {tenant.shortName} decides about it.
          </p>
        ) : (
          <ol className="history-list">
            {history.map((file) => (
              <li key={file.id}>
                <div className="history-head">
                  <strong>{file.fileName}</strong>
                  <span>
                    {formatFileSize(file.sizeBytes)} · sent{" "}
                    {formatDate(file.createdAt, tenant.localization.locale)}
                  </span>
                </div>
                <p className={`history-outcome ${outcomeTone(file)}`}>{outcomeLine(file, row.office, tenant.localization.locale)}</p>
                {(file.reviewHistory?.length ?? 0) > 0 ? (
                  <ol className="document-decision-history" aria-label={`Decision history for ${file.fileName}`}>
                    {file.reviewHistory?.map((review) => (
                      <li key={review.id}>
                        <strong>
                          {review.decision === "accepted" ? "Accepted" : "Changes requested"}
                          {review.reasonLabel ? ` - ${review.reasonLabel}` : ""}
                        </strong>
                        <span>
                          {review.synthetic ? "Earlier status recorded" : formatDate(review.decidedAt, tenant.localization.locale)} · {review.reviewerName}
                        </span>
                        {review.note ? <p>{review.note}</p> : null}
                      </li>
                    ))}
                  </ol>
                ) : null}
                {file.contentUrl ? (
                  <SecureStudentDocumentLink document={file} label="Open the original" />
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <p className="history-rule">
          {tenant.shortName} keeps every file you send. A replacement is added beside the one before
          it, never over it.
        </p>
      </section>
    </Drawer>
  );
}

function outcomeTone(file: StudentDocument) {
  const state = documentState(file);
  if (state === "accepted") return "done";
  if (state === "changes-requested") return "stop";
  return "wait";
}

function outcomeLine(file: StudentDocument, office: string, locale: string) {
  const state = documentState(file);
  if (file.signature) return `Signed ${formatDate(file.signature.signedAt, locale) ?? ""}.`;
  if (state === "checking") return "Edward is reading it.";
  if (state === "review") return "Edward read it. Your check is what sends it on.";
  if (state === "accepted") {
    return file.review ? `Accepted ${formatDate(file.review.decidedAt, locale)}.` : "Accepted.";
  }
  if (state === "changes-requested") {
    return `Changes requested${file.review ? ` ${formatDate(file.review.decidedAt, locale)}` : ""}.${file.review?.note ? ` ${file.review.note}` : ""}`;
  }
  if (state === "needed") return "A placeholder. Nothing has been sent yet.";
  return `With ${office}. No decision yet.`;
}

/**
 * What Edward read out of the file, put back in front of the student — the
 * production review boundary (`confirmStudentDocumentExtraction`), drawn in
 * the reference's `extract-review` shape: every value is shown, nothing is
 * trusted until she confirms it.
 */
function ExtractionReview({
  document,
  onDocumentChanged,
}: {
  document: StudentDocument;
  onDocumentChanged: (document: StudentDocument) => void;
}) {
  const extraction = document.extraction;
  const intentKey = useRef<string | null>(null);
  const [acceptedKeys, setAcceptedKeys] = useState(
    () => new Set(defaultAcceptedDocumentExtractionFieldKeys(extraction)),
  );
  const confirmAction = useCallback(
    (fieldKeys: string[], key: string) =>
      confirmStudentDocumentExtraction(document.id, { acceptedFieldKeys: fieldKeys }, key),
    [document.id],
  );
  const confirm = useApiAction(confirmAction);

  if (!extraction) return null;

  if (extraction.status === "processing") {
    return (
      <section className="extract-review" aria-live="polite">
        <div className="extract-head">
          <h3>Edward is reading it</h3>
          <p className="extract-note">
            Your file is already on your record. What Edward reads out of it appears here, and this
            page refreshes on its own.
          </p>
        </div>
      </section>
    );
  }

  if (extraction.status === "pending_configuration" || extraction.status === "failed") {
    const failure =
      extraction.status === "failed" ? documentExtractionFailurePresentation(extraction) : null;
    return (
      <section className="extract-review" role={extraction.status === "failed" ? "alert" : undefined}>
        <div className="extract-head">
          <h3>{failure?.title ?? "Reading is not set up yet"}</h3>
          <p className="extract-note">{extraction.summary}</p>
          {failure ? <p className="extract-note">{failure.guidance}</p> : null}
        </div>
        {extraction.warnings.length ? (
          <ul className="extraction-warnings">
            {extraction.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <DocumentExtractionRetry document={document} onRetried={onDocumentChanged} />
      </section>
    );
  }

  if (extraction.status !== "completed") return null;

  const reviewable = document.status === "needs_review";
  const courses = extraction.courses ?? [];

  const confirmFields = async () => {
    const key = intentKey.current ?? (intentKey.current = crypto.randomUUID());
    try {
      const changed = await confirm.run([...acceptedKeys], key);
      intentKey.current = null;
      onDocumentChanged(changed);
    } catch {
      // Keep the idempotency key for a safe retry of the same confirmation.
    }
  };

  return (
    <section className="extract-review" aria-labelledby="extract-title">
      <div className="extract-head">
        <h3 id="extract-title">Check what Edward read</h3>
        <p className="extract-note">{extraction.summary}</p>
      </div>

      <DocumentContextMatches matches={extraction.contextMatches} />

      {extraction.fields.length > 0 ? (
        <ul className="extract-fields">
          {extraction.fields.map((field) => {
            const accepted = acceptedKeys.has(field.key);
            return (
              <li key={field.key} className={`extract-field ${reviewable ? (accepted ? "right" : "open") : "right"}`}>
                <label htmlFor={`extract-${field.key}`}>{field.label}</label>
                <div className="extract-control">
                  <input id={`extract-${field.key}`} type="text" value={field.value} readOnly />
                  {reviewable ? (
                    accepted ? (
                      <button
                        type="button"
                        className="extract-agree"
                        onClick={() =>
                          setAcceptedKeys((current) => {
                            const next = new Set(current);
                            next.delete(field.key);
                            return next;
                          })
                        }
                      >
                        <Icon name="check" size={14} /> Keep it
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="extract-agree"
                        onClick={() => setAcceptedKeys((current) => new Set(current).add(field.key))}
                      >
                        This is right
                      </button>
                    )
                  ) : (
                    <span className="extract-verdict right">
                      <Icon name="check" size={14} /> Confirmed
                    </span>
                  )}
                </div>
                <span className="extract-read">
                  read from your file · {Math.round(field.confidence * 100)}% sure
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {courses.length > 0 ? (
        <p className="extract-note">
          {courses.length} {courses.length === 1 ? "course" : "courses"} were read into your
          academic record for advisory matching. They are listed under Where I came from.
        </p>
      ) : null}

      {extraction.warnings.length ? (
        <ul className="extraction-warnings">
          {extraction.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {reviewable ? (
        <>
          <p className="extract-left" role="status">
            {acceptedKeys.size === extraction.fields.length
              ? "Every field is kept. Nothing was assumed."
              : `${extraction.fields.length - acceptedKeys.size} ${extraction.fields.length - acceptedKeys.size === 1 ? "field" : "fields"} will be left out. Mark right what is right.`}
          </p>
          {confirm.status === "error" ? (
            <p className="upload-refusal" role="alert">
              <Icon name="alert" size={14} /> {confirm.message}
            </p>
          ) : null}
          <Button kind="primary" icon="arrow" pending={confirm.status === "loading"} onClick={() => void confirmFields()}>
            Confirm what is right
          </Button>
        </>
      ) : (
        <p className="extract-left" role="status">
          Reviewed{" "}
          {extraction.verifiedAt ? formatDate(extraction.verifiedAt) : "by you"}. Nothing was
          assumed.
        </p>
      )}
    </section>
  );
}
