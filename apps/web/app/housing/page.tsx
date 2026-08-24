"use client";

import type { HousingPreference, StudentHousingPlan } from "@vv/contracts";
import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { StudentPortalIcon } from "../components/student-portal-icon";
import { TenantLink as Link } from "../components/tenant-link";
import { ErrorState, LoadingState } from "../components/portal-ui";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentHousingPlan, updateStudentHousingPlan } from "../lib/api-client";

const options: Array<{ id: HousingPreference; label: string; hint: string }> = [
  { id: "on_campus", label: "On campus", hint: "I want Residential Life to assign me a room." },
  { id: "commuting", label: "Commuting", hint: "I will travel to campus from home." },
  { id: "off_campus", label: "My own off-campus housing", hint: "I will arrange a place that is not managed by Aster." },
  { id: "family", label: "Living with family", hint: "I will live with family while I study." },
  { id: "undecided", label: "I’m still deciding", hint: "Save this honestly now and return before the deadline." },
];

function labelFor(value: HousingPreference | null) {
  return options.find((option) => option.id === value)?.label ?? "No plan yet";
}

export default function HousingPage() {
  const load = useCallback((signal: AbortSignal) => getStudentHousingPlan(signal), []);
  const housing = useApiResource(load);
  const [choice, setChoice] = useState<HousingPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (housing.data) setChoice(housing.data.preference);
  }, [housing.data]);

  const save = async (next: HousingPreference, residenceOption?: string) => {
    if (!housing.data) return;
    setChoice(next);
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await updateStudentHousingPlan({
        expectedVersion: housing.data.version,
        preference: next,
        ...(residenceOption ? { residenceOption, residencePreferences: [residenceOption] } : {}),
      });
      setChoice(updated.preference);
      setFeedback("Saved. Your enrollment checklist now reads this same answer.");
      housing.reload();
      window.dispatchEvent(new CustomEvent("vv:student-record-changed"));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "That change was not saved. Your choice is still here so you can retry.");
    } finally {
      setSaving(false);
    }
  };

  const current = housing.data as StudentHousingPlan | undefined;

  return (
    <PortalShell
      active="housing"
      eyebrow="Housing · Published by Residential Life"
      title="Where you’ll live."
      description="Two questions: where you’ll live, and which residence halls you’d like. Residential Life assigns the rooms."
    >
      {housing.status === "loading" ? <LoadingState label="Loading your housing plan" /> : housing.status === "error" ? <ErrorState message={housing.error} onRetry={housing.reload} /> : (
        <>
          <section className="page-summary" aria-label="Housing standing">
            <div className="summary-main">
              <div className="summary-figure"><div className="summary-figure-copy"><span className="panel-label">Housing plan</span><strong><span className={`status-pill ${choice && choice !== "undecided" ? "done" : "act"}`}>{choice ? "Recorded" : "Needs your answer"}</span><span className="figure-consequence">{labelFor(choice)}</span></strong><p>{choice ? "Your answer is saved. You can change it while the housing response window is open." : "Residential Life is waiting for your plan."}</p></div></div>
              <div className="advisor-bar"><img className="avatar avatar-md advisor-avatar" src="/people/tomas-okafor.webp" width="40" height="40" alt="" /><div className="advisor-bar-copy"><span className="panel-label">Your enrollment advisor</span><strong>Tomás Okafor <span>· Admissions Office</span></strong><small>Housing assignments belong to Residential Life.</small></div><div className="advisor-actions"><a className="advisor-action" href="mailto:admissions@aster.edu" aria-label="Email Tomás Okafor">✉</a><Link className="advisor-action" href="/messages" aria-label="Message Tomás Okafor"><StudentPortalIcon name="message" size={16} /></Link></div></div>
            </div>
          </section>

          <div className="page-body">
            <div className="page-main">
              <section className="section-card" aria-labelledby="housing-plan-heading">
                <div className="status-heading"><span className="status-icon accent"><StudentPortalIcon name="home" size={20} /></span><div><h2 id="housing-plan-heading">Where will you live?</h2><p>First question</p></div></div>
                <p className="panel-lede">All five are real answers. Pick the one that is true. Your saved answer also updates the housing step on My Enrollment.</p>
                <div className="choice-panel" role="radiogroup" aria-labelledby="housing-plan-heading">
                  {options.map((option) => <label key={option.id} className={choice === option.id ? "chosen" : ""}><input type="radio" name="housing-plan" value={option.id} checked={choice === option.id} disabled={saving} onChange={() => void save(option.id)} /><span><strong>{option.label}</strong><small>{option.hint}</small></span><span className="radio-mark"><span aria-hidden="true">✓</span></span></label>)}
                </div>
                {feedback ? <p className={feedback.startsWith("Saved") ? "choice-consequence" : "action-feedback"} role="status"><StudentPortalIcon name={feedback.startsWith("Saved") ? "checklist" : "close"} size={16} /><span>{feedback}</span></p> : null}
              </section>

              {choice === "on_campus" ? <section className="section-card" aria-labelledby="catalogue-heading"><div className="status-heading"><span className="status-icon accent"><StudentPortalIcon name="campus" size={20} /></span><div><h2 id="catalogue-heading">Residence halls</h2><p>Published by Residential Life</p></div><span className="status-count">{current?.residences.length ?? 0}</span></div><div className="card-rows residence-list">{current?.residences.map((residence) => { const ranked = current.residenceOption === residence.value || current.residencePreferences?.includes(residence.value); return <article className={`residence-row${ranked ? " ranked" : ""}`} key={residence.id}><div className="residence-main"><div className="task-type-icon housing"><StudentPortalIcon name="home" size={20} /></div><div className="residence-copy"><span className="residence-title">{residence.name}{ranked ? <span className="rank-chip">Your choice</span> : null}</span><span className="residence-summary">{residence.description}</span><span className="residence-meta">{residence.amenities.slice(0, 3).map((amenity) => <span key={amenity}>✓ {amenity}</span>)}</span></div></div><div className="residence-action">{ranked ? <span className="ranked-mark">✓ Ranked first</span> : <button className="secondary-button" type="button" disabled={saving} onClick={() => void save("on_campus", residence.value)}>Choose this hall</button>}</div></article>; })}</div></section> : <section className={`section-card outcome-card ${choice ? "" : "awaiting"}`}><span className="outcome-icon"><StudentPortalIcon name={choice ? "checklist" : "home"} size={20} /></span><h2>{choice ? "That is the whole housing question for now." : "Residence preferences come after your plan."}</h2><p>{choice ? "Residential Life has your answer. If your plan changes, return here and update it." : "Tell Residential Life where you plan to live first. If you choose on campus, the residence catalogue appears here next."}</p></section>}
            </div>
            <aside className="page-rail"><div className="anchor-card deadline-card"><span className="panel-label">Answer by</span><strong className="anchor-figure">June 1</strong><p>Your housing plan and residence preference remain yours to change until Residential Life closes responses.</p><p className="reply-note">Residential Life · Student Center 210</p></div><div className="provenance-card"><span className="panel-label">What a preference is worth</span><p>You tell Residential Life what you would like, in order. They decide, and may place you somewhere you did not name.</p><Link className="text-button" href="/help">How housing decisions work <StudentPortalIcon name="chevron" size={14} /></Link></div></aside>
          </div>
        </>
      )}
    </PortalShell>
  );
}
