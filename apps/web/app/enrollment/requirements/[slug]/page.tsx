"use client";

import type { StudentDocument } from "@vv/contracts";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { DocumentUpload } from "../../../components/document-upload";
import { PortalShell } from "../../../components/portal-shell";
import {
  ErrorState,
  LoadingState,
  PageCard,
  StatusPill,
} from "../../../components/portal-ui";
import { useApiResource } from "../../../hooks/use-api-resource";
import { getStudentRequirement } from "../../../lib/api-client";

const actionByType = {
  form: { label: "Update your profile", href: "/profile" },
  payment: { label: "Go to payments", href: "/payments" },
  none: { label: "Ask for help", href: "/help" },
} as const;

export default function RequirementDetailPage() {
  const params = useParams<{ slug: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [uploadedDocument, setUploadedDocument] =
    useState<StudentDocument | null>(null);
  const loadRequirement = useCallback(
    (signal: AbortSignal) => getStudentRequirement(slug, signal),
    [slug],
  );
  const requirement = useApiResource(loadRequirement);

  return (
    <PortalShell
      active="enrollment"
      eyebrow="Enrollment requirement"
      title={requirement.data?.title || "Requirement details"}
      description="Review what is needed, why Aster asks for it, and where to complete the next action."
      actions={
        <Link className="button button--secondary" href="/enrollment">
          ← Back to requirements
        </Link>
      }
    >
      {requirement.status === "loading" ? (
        <LoadingState label="Loading requirement details" />
      ) : requirement.status === "error" ? (
        <ErrorState
          message={
            requirement.errorStatus === 400 || requirement.errorStatus === 404
              ? "We couldn’t find that enrollment requirement."
              : requirement.error
          }
          onRetry={requirement.reload}
        />
      ) : (
        <div className="resource-layout">
          <PageCard
            eyebrow={requirement.data.code}
            title={requirement.data.title}
            action={<StatusPill value={requirement.data.status} />}
          >
            <div className="requirement-detail">
              <p className="requirement-detail__description">
                {requirement.data.description}
              </p>
              <dl className="detail-grid">
                <div>
                  <dt>Responsible office</dt>
                  <dd>{requirement.data.responsibleOffice}</dd>
                </div>
                <div>
                  <dt>Due date</dt>
                  <dd>
                    {requirement.data.dueAt
                      ? new Intl.DateTimeFormat("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        }).format(new Date(requirement.data.dueAt))
                      : "No due date"}
                  </dd>
                </div>
                <div>
                  <dt>Submission type</dt>
                  <dd>{requirement.data.submissionType}</dd>
                </div>
                <div>
                  <dt>Progress</dt>
                  <dd>{requirement.data.progressPercent}%</dd>
                </div>
              </dl>
              <div
                className="progress-track detail-progress"
                role="progressbar"
                aria-label={`${requirement.data.title} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={requirement.data.progressPercent}
              >
                <span style={{ width: `${requirement.data.progressPercent}%` }} />
              </div>
              {requirement.data.submissionType === "document" ? (
                <div className="requirement-upload">
                  <div className="requirement-upload__heading">
                    <p className="eyebrow">Complete this requirement here</p>
                    <h2>No separate upload page needed</h2>
                    <p>
                      Select the file. Edward will identify what it contains,
                      extract structured information, and attach it to this
                      enrollment requirement.
                    </p>
                  </div>
                  <DocumentUpload
                    requirementId={requirement.data.id}
                    categoryHint={requirement.data.documentCategory ?? undefined}
                    expectedLabel={requirement.data.title
                      .replace(/^Submit your /i, "")
                      .replace(/^Provide /i, "")}
                    onUploaded={(document) => {
                      setUploadedDocument(document);
                      requirement.refresh();
                    }}
                  />
                  {uploadedDocument?.extraction ? (
                    <div className="requirement-upload__result" role="status">
                      <span aria-hidden="true">✓</span>
                      <div>
                        <strong>
                          {uploadedDocument.extraction.status === "completed"
                            ? `Identified as ${uploadedDocument.extraction.documentType.replaceAll(
                                "_",
                                " ",
                              )}`
                            : uploadedDocument.extraction.status ===
                                "pending_configuration"
                              ? "Document stored; parsing is not configured"
                              : uploadedDocument.extraction.status === "failed"
                                ? "Document stored; parsing needs attention"
                                : "Document parsing is in progress"}
                        </strong>
                        <p>{uploadedDocument.extraction.summary}</p>
                        {uploadedDocument.extraction.warnings.length ? (
                          <ul>
                            {uploadedDocument.extraction.warnings.map(
                              (warning) => (
                                <li key={warning}>{warning}</li>
                              ),
                            )}
                          </ul>
                        ) : null}
                        <Link href="/documents">
                          Review extracted fields <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Link
                  className="button button--primary"
                  href={
                    actionByType[requirement.data.submissionType].href
                  }
                >
                  {actionByType[requirement.data.submissionType].label}
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          </PageCard>
          <aside className="resource-aside">
            <div className="aside-note">
              <span aria-hidden="true">i</span>
              <h2>Why we ask</h2>
              <p>
                This item is managed by {requirement.data.responsibleOffice}.
                Its status only changes after Aster confirms the required record.
              </p>
            </div>
            {requirement.data.dependencyCodes.length > 0 ? (
              <div className="aside-note aside-note--plain">
                <h2>Complete first</h2>
                <ul>
                  {requirement.data.dependencyCodes.map((code) => (
                    <li key={code}>{code.replaceAll("_", " ")}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </PortalShell>
  );
}
