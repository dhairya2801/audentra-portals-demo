"use client";

import type { StudentRequirementDetail } from "@vv/contracts";
import { useCallback, useMemo } from "react";
import { PortalShell } from "../components/portal-shell";
import { StudentPortalIcon } from "../components/student-portal-icon";
import { TenantLink as Link } from "../components/tenant-link";
import { ErrorState, LoadingState } from "../components/portal-ui";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentRequirements } from "../lib/api-client";

const settled = new Set(["completed", "waived", "not_applicable"]);

function recordCopy(requirement: StudentRequirementDetail | null) {
  if (!requirement) return { label: "Not assigned", tone: "neutral", line: "Health Services has not requested a record from you." };
  if (settled.has(requirement.status)) return { label: "Accepted", tone: "done", line: "Health Services has accepted your current record." };
  if (["submitted", "under_review"].includes(requirement.status)) return { label: "In review", tone: "wait", line: "You have done your part. Health Services is reviewing what you sent." };
  if (requirement.status === "blocked") return { label: "Coming up", tone: "neutral", line: "This record opens when its enrollment prerequisites are complete." };
  return { label: "Needs you", tone: "act", line: requirement.dueAt ? `Send your record before ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date(requirement.dueAt))}.` : "Health Services is waiting for your immunization record." };
}

export default function HealthPage() {
  const load = useCallback((signal: AbortSignal) => getStudentRequirements(signal), []);
  const requirements = useApiResource(load);
  const record = useMemo(
    () => requirements.data?.items.find((item) => item.code === "immunization_record" || item.slug.includes("immunization")) ?? null,
    [requirements.data],
  );
  const standing = recordCopy(record);

  return (
    <PortalShell
      active="health"
      eyebrow="My Health and Wellness"
      title="One record, and one question."
      description="Health Services needs your immunization record before you can register. Accessibility Services has a question you can answer whenever you want, or not at all."
    >
      {requirements.status === "loading" ? <LoadingState label="Loading your health standing" /> : requirements.status === "error" ? <ErrorState message={requirements.error} onRetry={requirements.reload} /> : (
        <>
          <section className="page-summary" aria-label="Health standing">
            <div className="summary-main">
              <div className="summary-figure">
                <div className="summary-figure-copy">
                  <span className="panel-label">Immunization record</span>
                  <strong><span className={`status-pill ${standing.tone}`}>{standing.label}</span>{record?.blocking ? <span className="figure-consequence">Required before registration</span> : null}</strong>
                  <p>{standing.line}</p>
                </div>
              </div>
              <div className="advisor-bar">
                <img className="avatar avatar-md advisor-avatar" src="/people/tomas-okafor.webp" width="40" height="40" alt="" />
                <div className="advisor-bar-copy"><span className="panel-label">Your enrollment advisor</span><strong>Tomás Okafor <span>· Admissions Office</span></strong><small>For enrollment questions. He is not part of your health record.</small></div>
                <div className="advisor-actions"><a className="advisor-action" href="mailto:admissions@aster.edu" aria-label="Email Tomás Okafor">✉</a><Link className="advisor-action" href="/messages" aria-label="Message Tomás Okafor"><StudentPortalIcon name="message" size={16} /></Link></div>
              </div>
            </div>
            <div className="summary-alert"><div className="notice quiet"><span className="notice-mark" aria-hidden="true">♿</span><span className="notice-copy"><strong>Accessibility and accommodations are optional to discuss.</strong> You decide whether to answer.</span></div></div>
          </section>

          <div className="page-body">
            <div className="page-main">
              <section className="section-card immunization-card">
                <div className="status-heading"><span className={`status-icon ${standing.tone}`}><StudentPortalIcon name="health" size={20} /></span><div><h2>Your immunization record</h2><p>Published by Health Services</p></div><span className={`status-pill ${standing.tone}`}>{standing.label}</span></div>
                {record ? <div className="card-rows"><article className="record-state compact-task"><div className="compact-copy"><p className="record-line">{record.description}</p>{record.dueAt ? <span className="record-due"><StudentPortalIcon name="calendar" size={15} /> Due {new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(record.dueAt))}</span> : null}</div><Link className="primary-button" href={`/enrollment/requirements/${encodeURIComponent(record.slug)}`}>{settled.has(record.status) ? "View record" : ["submitted", "under_review"].includes(record.status) ? "View submission" : "Send your record"} <StudentPortalIcon name="chevron" size={15} /></Link></article></div> : <p className="inline-empty">No immunization record has been requested.</p>}
              </section>

              <section className="section-card">
                <div className="card-rows"><article className="entry-row"><span className="task-type-icon preferences"><span aria-hidden="true">♿</span></span><div className="compact-copy"><span className="compact-eyebrow">Optional</span><h3>Accessibility and accommodations</h3><p>Tell Accessibility Services if you would like information about academic or housing accommodations.</p></div><Link className="secondary-button" href="/profile">See the question <StudentPortalIcon name="chevron" size={15} /></Link></article></div>
              </section>
            </div>
            <aside className="page-rail">
              <div className="anchor-card published-card"><span className="panel-label">Who handles what</span><ul className="teams-list"><li><strong>Health Services</strong><span>Reads and verifies immunization records.</span></li><li><strong>Accessibility Services</strong><span>Handles accommodation conversations privately.</span></li><li><strong>Admissions</strong><span>Helps with your enrollment timeline.</span></li></ul><Link className="learn-link" href="/help">Open student help <StudentPortalIcon name="chevron" size={14} /></Link></div>
            </aside>
          </div>
        </>
      )}
    </PortalShell>
  );
}
