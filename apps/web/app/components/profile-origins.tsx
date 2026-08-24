"use client";

import type { StudentDocument } from "@vv/contracts";
import { useEffect } from "react";
import Icon from "../design-system/Icon.jsx";
import StatusPill from "../design-system/primitives/StatusPill.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import { TenantLink as Link } from "./tenant-link";
import { formatDate, transcriptReading, transcriptsOf } from "./profile-logic";

/**
 * Where I came from — the reference's `OriginsSection`, read from the
 * transcripts on the student's record rather than a fixture: one card per
 * transcript Aster holds, the state of the Registrar's reading of it at its
 * head, and the coursework Edward read out of it as a table. It is a record,
 * not a form: nothing here is hers to edit, and nothing here is the
 * Registrar's decision either.
 */
const READING = {
  received: { tone: "wait", label: "Received" },
  "under-review": { tone: "progress", label: "Under review" },
  reviewed: { tone: "done", label: "Reviewed" },
  returned: { tone: "stop", label: "Sent back" },
} as const;

export default function ProfileOrigins({
  documents,
  highlight,
  unavailable = false,
  transcriptRoute,
  tenantShortName,
  locale,
}: {
  documents: readonly StudentDocument[];
  highlight: string | null;
  unavailable?: boolean;
  /** The checklist step a transcript is sent from, when the record has one. */
  transcriptRoute: string | null;
  tenantShortName: string;
  locale: string;
}) {
  const transcripts = transcriptsOf(documents);

  useEffect(() => {
    if (!highlight) return;
    document
      .getElementById(`origin-line-${highlight}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight]);

  if (unavailable) {
    return (
      <StateCard variant="warn" icon="alert" title="Where you came from couldn’t be read">
        The transcripts on your record are held with your documents, which this session cannot
        read. Nothing about them has changed.
      </StateCard>
    );
  }

  if (transcripts.length === 0) {
    return (
      <section className="section-card origin-card" aria-labelledby="origins-empty-title">
        <StateCard variant="empty" icon="graduation" title="No transcript on your record yet">
          The schools and colleges before {tenantShortName} appear here as their transcripts say,
          once you send one. What counts toward your degree is the Registrar’s reading of it.
        </StateCard>
        {transcriptRoute ? (
          <p className="card-foot origin-foot">
            <Icon name="info" size={14} />
            <span>
              A transcript is sent from your checklist, so there is only one place it can go.{" "}
              <Link href={transcriptRoute}>Open the step</Link>.
            </span>
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <>
      {transcripts.map((transcript) => {
        const extraction =
          transcript.extraction?.status === "completed" ? transcript.extraction : null;
        const reading = READING[transcriptReading(transcript)];
        const name = extraction?.institutionName?.trim() || transcript.fileName;
        const meta = [
          extraction?.documentType === "transcript" ? "Transcript" : "Document",
          extraction?.academicTerm?.trim() || null,
          extraction?.issueDate ? `issued ${formatDate(extraction.issueDate, locale)}` : null,
        ].filter(Boolean);
        const lines = extraction?.courses ?? [];
        const received = formatDate(transcript.createdAt, locale);

        return (
          <section
            className="section-card origin-card"
            key={transcript.id}
            aria-labelledby={`${transcript.id}-title`}
          >
            <div className="status-heading">
              <span className="status-icon record">
                <Icon name="graduation" size={18} />
              </span>
              <div>
                <h2 id={`${transcript.id}-title`}>{name}</h2>
                <p>{meta.join(" · ")}</p>
              </div>
              <span className="origin-standing">
                <StatusPill tone={reading.tone}>{reading.label}</StatusPill>
                <small>
                  {transcript.fileName}
                  {received ? ` · received ${received}` : ""}
                </small>
              </span>
            </div>

            {lines.length > 0 ? (
              <div className="origin-table-wrap">
                <table className="origin-table">
                  <caption className="sr-only">
                    Coursework at {name}, as the transcript records it
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Course</th>
                      <th scope="col">Term</th>
                      <th scope="col" className="numeric">
                        Grade
                      </th>
                      <th scope="col" className="numeric">
                        Credits
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const lineId = `${transcript.id}-${index}`;
                      return (
                        <tr
                          key={lineId}
                          id={`origin-line-${lineId}`}
                          className={highlight === lineId ? "cited" : ""}
                        >
                          <td>
                            {line.sourceCode ? `${line.sourceCode} ${line.title}` : line.title}
                            {line.score ? <small>Score {line.score}</small> : null}
                          </td>
                          <td>{line.term ?? "—"}</td>
                          <td className="numeric">{line.grade ?? "—"}</td>
                          <td className="numeric">{line.credits ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="inline-empty">
                {transcript.extraction?.status === "processing"
                  ? "Edward is still reading this transcript. The coursework appears here when it is done."
                  : "No coursework has been read out of this transcript yet."}
              </p>
            )}

            <p className="card-foot origin-foot">
              <Icon name="info" size={14} />
              <span>
                Read from the transcript as received. What counts toward your degree is the
                Registrar’s reading of it, on <Link href="/classrooms">My Degree</Link>.
              </span>
            </p>
          </section>
        );
      })}
    </>
  );
}
