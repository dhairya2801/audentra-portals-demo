"use client";

import type { StudentDocument, StudentRequirementDetail } from "@vv/contracts";
import { studentRequirementSlug } from "@vv/contracts";
import { useRef, useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Button, { IconButton } from "../design-system/primitives/Button.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import type { ToastInput } from "../design-lib/toast.js";
import { getApiErrorMessage } from "../hooks/use-api-resource";
import {
  getStudentDocumentContent,
  uploadStudentDocumentBundle,
  type StudentDocumentUploadBundleEntry,
} from "../lib/api-client";
import { TenantLink as Link } from "./tenant-link";
import { useTenant } from "./tenant-provider";
import {
  dependencyTitles,
  documentOutcome,
  fileSize,
  latestDecision,
  officeName,
  shortDate,
  stateInfo,
  stateOf,
} from "./health-logic";

/** What the document API accepts — the same limits `document-upload.tsx` enforces. */
const ACCEPTS = {
  formats: ["PDF", "JPG", "PNG"],
  extensions: ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png",
  maxMb: 10,
  maxFiles: 8,
  bundleMb: 30,
};
const MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

type Chosen = { entry: StudentDocumentUploadBundleEntry; name: string; bytes: number; size: string };

function listFormats(formats: string[]) {
  if (formats.length < 2) return formats.join("");
  return `${formats.slice(0, -1).join(", ")} or ${formats[formats.length - 1]}`;
}

function refuse(file: File) {
  const dot = file.name.lastIndexOf(".");
  const ext = dot === -1 ? "" : file.name.slice(dot + 1).toUpperCase();
  if (!MIME.has(file.type) && !["PDF", "JPG", "JPEG", "PNG"].includes(ext)) {
    return `${file.name} is a ${ext || "file with no"} file. This one takes ${listFormats(ACCEPTS.formats)}.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > ACCEPTS.maxMb * 1024 * 1024) {
    return `${file.name} is over the ${ACCEPTS.maxMb} MB this one takes. Everything else you chose is still here.`;
  }
  return null;
}

function refuseCount(chosen: number, incoming: number) {
  const max = ACCEPTS.maxFiles;
  if (chosen + incoming <= max) return null;
  const room = Math.max(0, max - chosen);
  if (room === 0) return `${max} files is the limit for this one, and you have ${chosen}. Remove one to add another.`;
  const dropped = chosen + incoming - max;
  return `This one takes ${max} files. ${room === 1 ? "One was" : `${room} were`} added; ${
    dropped === 1 ? "the last one was" : `the last ${dropped} were`
  } not.`;
}

/**
 * One document requirement, opened — the reference `DocumentDrawer` at the
 * door Health owns, with the real upload behind the field.
 */
export function HealthRecordDrawer({
  requirement,
  documents,
  all,
  onClose,
  onSent,
  onToast,
}: {
  requirement: StudentRequirementDetail;
  documents: readonly StudentDocument[];
  all: readonly StudentRequirementDetail[];
  onClose: () => void;
  onSent: (uploaded: StudentDocument[]) => void;
  onToast: (toast: ToastInput) => void;
}) {
  const { tenant } = useTenant();
  const institution = tenant.shortName;
  const picker = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Chosen[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const office = officeName(requirement);
  const state = stateOf(requirement, documents);
  const info = stateInfo(state);
  const decision = latestDecision(documents);
  const deps = dependencyTitles(requirement, all);
  const history = [...documents].reverse();
  const blocked = state === "blocked";
  const canUpload = info.holder === "you";
  const ready = files.length > 0 && !sending;

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (chosen.length === 0) return;

    const full = refuseCount(files.length, chosen.length);
    const room = Math.max(0, ACCEPTS.maxFiles - files.length);
    const taking = full ? chosen.slice(0, room) : chosen;

    const kept: Chosen[] = [];
    let problem = full;
    let bytes = files.reduce((total, item) => total + item.bytes, 0);
    for (const item of taking) {
      const said = refuse(item);
      if (said) {
        problem = problem ?? said;
        continue;
      }
      if (bytes + item.size > ACCEPTS.bundleMb * 1024 * 1024) {
        problem = problem ?? `Together these are over the ${ACCEPTS.bundleMb} MB one send takes. ${item.name} was not added.`;
        continue;
      }
      if (files.some((existing) => existing.name === item.name) || kept.some((k) => k.name === item.name)) {
        continue;
      }
      bytes += item.size;
      kept.push({
        entry: { file: item, idempotencyKey: crypto.randomUUID() },
        name: item.name,
        bytes: item.size,
        size: fileSize(item.size),
      });
    }

    setRefusal(problem);
    setFailed(null);
    if (kept.length > 0) setFiles((current) => [...current, ...kept]);
  }

  function removeFile(name: string) {
    setFiles((current) => current.filter((item) => item.name !== name));
    setRefusal(null);
    setFailed(null);
  }

  async function send() {
    if (!ready) return;
    setSending(true);
    setFailed(null);
    try {
      const results = await uploadStudentDocumentBundle(
        files.map((item) => item.entry),
        { categoryHint: "health", requirementId: requirement.id },
      );
      const uploaded = results
        .filter((result): result is Extract<typeof result, { status: "uploaded" }> => result.status === "uploaded")
        .map((result) => result.document);
      const failures = results.filter((result) => result.status !== "uploaded");
      if (failures.length > 0) {
        const first = failures[0] as { error?: unknown };
        setFiles((current) =>
          current.filter((item) => failures.some((f) => f.idempotencyKey === item.entry.idempotencyKey)),
        );
        setFailed(
          uploaded.length > 0
            ? `${uploaded.length} of ${results.length} reached ${institution}. ${getApiErrorMessage(first.error)}`
            : getApiErrorMessage(first.error),
        );
        if (uploaded.length > 0) onSent(uploaded);
        return;
      }
      onToast({
        tone: "success",
        title: uploaded.length === 1 ? `Sent to ${institution}.` : `${uploaded.length} files sent to ${institution}.`,
        body: `${office} has ${uploaded.length === 1 ? "it" : "them"}. Nothing more is needed from you while they do.`,
      });
      onSent(uploaded);
      onClose();
    } catch (error) {
      setFailed(getApiErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function openOriginal(document: StudentDocument) {
    const viewer = window.open("", "_blank");
    if (viewer) {
      viewer.opener = null;
      viewer.document.title = "Loading protected document…";
    }
    setOpening(document.id);
    try {
      const blob = await getStudentDocumentContent(document);
      const url = URL.createObjectURL(blob);
      if (viewer && !viewer.closed) viewer.location.replace(url);
      else window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      if (viewer && !viewer.closed) viewer.close();
      onToast({ tone: "error", title: "That file couldn’t be opened.", body: getApiErrorMessage(error) });
    } finally {
      setOpening(null);
    }
  }

  return (
    <Drawer
      variant="document"
      label={[office, info.label]}
      titleId="document-drawer-title"
      closeLabel="Close document"
      onClose={onClose}
    >
      <div className="drawer-icon">
        <Icon weight="duotone" name="file" size={25} />
      </div>
      <h2 id="document-drawer-title">Immunization record</h2>
      <p className="document-lede" role="status">
        {state === "needed"
          ? `Not sent yet · ${office} is waiting for it`
          : state === "blocked"
            ? `Not open yet · it opens once ${deps.length > 0 ? `“${deps[0].title}”` : "an earlier step"} is complete`
            : state === "checking"
              ? `${institution} is checking it. You can close this page. It keeps going.`
              : state === "in-review"
                ? `With ${office}`
                : state === "accepted"
                  ? "Accepted. Nothing more is needed here."
                  : `Sent back by ${office}`}
      </p>

      {state === "changes-requested" && decision ? (
        <section className="reject-panel" aria-labelledby="reject-title">
          <h3 id="reject-title">
            <Icon name="alert" size={17} /> Why it came back
          </h3>
          {decision.note ? <p className="reject-reason">{decision.note}</p> : null}
          <p className="reject-lead">What would fix it</p>
          <ul className="reject-remedies">
            <li>
              <Icon name="check" size={14} />
              Send a new copy below. It is added beside the one that came back, never over it.
            </li>
            <li>
              <Icon name="check" size={14} />
              Photograph or scan each page flat, with every edge visible and every date legible.
            </li>
          </ul>
          <p className="reject-by">
            {office}
            {decision.decidedAt ? ` · ${shortDate(decision.decidedAt, tenant)}` : ""}
          </p>
        </section>
      ) : null}

      <section className="document-brief">
        <h3>What {institution} needs</h3>
        <p>{requirement.description}</p>
        <p className="document-accepts">
          {listFormats(ACCEPTS.formats)} · up to {ACCEPTS.maxMb} MB each · up to {ACCEPTS.maxFiles} files
        </p>
        {requirement.blocking ? (
          <p className="document-unblocks">
            <Icon name="lock" size={14} /> Class registration waits on this record until {office} accepts it.
          </p>
        ) : null}
      </section>

      {blocked ? (
        <div className="document-route">
          <p>
            This one opens once {deps.length > 0 ? `“${deps[0].title}”` : "an earlier step on your checklist"} is
            complete, so there is nothing to send here yet.
          </p>
          <Link
            className="primary-button"
            href={
              deps.length > 0
                ? `/enrollment/requirements/${encodeURIComponent(deps[0].slug || studentRequirementSlug(deps[0].code))}`
                : "/enrollment"
            }
            onClick={onClose}
          >
            {deps.length > 0 ? "Open the step" : "Open My Enrollment"} <Icon name="arrow" size={17} />
          </Link>
        </div>
      ) : null}

      {canUpload ? (
        <section className="document-upload" aria-labelledby="upload-title">
          <h3 id="upload-title">{state === "changes-requested" ? "Send a replacement" : "Send it"}</h3>

          <input
            type="file"
            ref={picker}
            className="visually-hidden"
            accept={ACCEPTS.extensions}
            multiple
            onChange={pick}
          />

          <div className={`upload-zone ${refusal ? "refused" : files.length > 0 ? "has-file" : ""}`}>
            <span className="upload-mark" aria-hidden="true">
              <Icon name={refusal ? "alert" : files.length > 0 ? "check" : "upload"} size={22} />
            </span>
            <div className="upload-chosen">
              <strong>
                {files.length === 0
                  ? "Choose your files"
                  : files.length === 1
                    ? files[0].name
                    : `${files.length} files ready to send`}
              </strong>
              <span>
                {files.length === 1
                  ? files[0].size
                  : `${listFormats(ACCEPTS.formats)} · up to ${ACCEPTS.maxMb} MB · ${ACCEPTS.maxFiles} files`}
              </span>
            </div>
            <button className="secondary-button" type="button" onClick={() => picker.current?.click()}>
              {files.length === 0 ? "Browse" : "Add more"}
            </button>
            {files.length === 1 ? (
              <IconButton
                name="close"
                size={18}
                label={`Remove ${files[0].name}`}
                tip="Remove"
                onClick={() => removeFile(files[0].name)}
              />
            ) : null}
          </div>

          {files.length > 1 ? (
            <ul className="upload-files">
              {files.map((item) => (
                <li key={item.name}>
                  <Icon name="file" size={15} />
                  <span className="upload-file-name">{item.name}</span>
                  <span className="upload-file-size">{item.size}</span>
                  <IconButton
                    name="close"
                    size={16}
                    label={`Remove ${item.name}`}
                    tip="Remove"
                    onClick={() => removeFile(item.name)}
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {refusal ? (
            <p className="upload-refusal" role="alert">
              <Icon name="alert" size={14} /> {refusal}
            </p>
          ) : null}

          <p className="upload-privacy">
            <Icon name="shield" size={14} /> Stored encrypted, and read only by {office} staff.
          </p>

          {failed ? (
            <div className="upload-failed" role="alert">
              <p>
                <strong>This did not reach {institution}.</strong> {failed} {files.length > 1 ? "Your files are" : "Your file is"}{" "}
                still here.
              </p>
              <div className="upload-failed-actions">
                <button className="primary-button" type="button" onClick={() => void send()}>
                  <Icon name="refresh" size={16} /> Try again
                </button>
                <button className="secondary-button" type="button" onClick={() => picker.current?.click()}>
                  Choose {files.length > 1 ? "other files" : "another file"}
                </button>
              </div>
            </div>
          ) : (
            <Button kind="primary" icon="arrow" disabled={!ready} pending={sending} onClick={() => void send()}>
              Send to {institution}
            </Button>
          )}
        </section>
      ) : null}

      <section className="document-history" aria-labelledby="history-title">
        <h3 id="history-title">Everything you have sent</h3>
        {history.length === 0 ? (
          <p className="inline-empty">
            Nothing has been sent for this one yet. When you send something it stays here, and so does
            whatever {institution} decides about it.
          </p>
        ) : (
          <ol className="history-list">
            {history.map((document) => {
              const outcome = documentOutcome(document);
              const tone = outcome === "accepted" ? "done" : outcome === "changes-requested" ? "stop" : "wait";
              return (
                <li key={document.id}>
                  <div className="history-head">
                    <strong>{document.fileName}</strong>
                    <span>
                      {fileSize(document.sizeBytes)}
                      {fileSize(document.sizeBytes) ? " · " : ""}sent {shortDate(document.createdAt, tenant)}
                    </span>
                  </div>
                  <p className={`history-outcome ${tone}`}>
                    {outcome === "checking"
                      ? `${institution} is checking it.`
                      : outcome === "in-review"
                        ? `With ${office}. No decision yet.`
                        : outcome === "accepted"
                          ? `Accepted${document.review?.decidedAt ? ` ${shortDate(document.review.decidedAt, tenant)}` : ""}.`
                          : `Changes requested${document.review?.decidedAt ? ` ${shortDate(document.review.decidedAt, tenant)}` : ""}.${
                              document.review?.note ? ` ${document.review.note}` : ""
                            }`}
                  </p>
                  {document.contentUrl ? (
                    <button
                      className="link-button"
                      type="button"
                      disabled={opening === document.id}
                      onClick={() => void openOriginal(document)}
                    >
                      <Icon name="download" size={14} />{" "}
                      {opening === document.id ? "Opening…" : "Open the original"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
        <p className="history-rule">
          {institution} keeps every file you send. A replacement is added beside the one before it, never over
          it.
        </p>
      </section>
    </Drawer>
  );
}
