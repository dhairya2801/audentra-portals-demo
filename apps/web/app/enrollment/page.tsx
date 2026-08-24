"use client";

import type {
  FerpaPortalScope,
  StudentBootstrap,
  StudentFerpaAuthorization,
  StudentOnboarding,
  StudentRequirementDetail,
  StudentRequirementList,
} from "@vv/contracts";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { StudentPortalIcon } from "../components/student-portal-icon";
import { TenantLink as Link } from "../components/tenant-link";
import { useTenant } from "../components/tenant-provider";
import { EmptyState, ErrorState, LoadingState } from "../components/portal-ui";
import { useApiResource } from "../hooks/use-api-resource";
import { durationBucket, useActivityTracking } from "../hooks/use-activity-tracking";
import {
  getStudentBootstrap,
  getStudentFerpaAuthorization,
  getStudentOnboarding,
  getStudentRequirements,
} from "../lib/api-client";

type EnrollmentPageData = {
  bootstrap: StudentBootstrap;
  requirements: StudentRequirementList;
  onboarding: StudentOnboarding | null;
  authorization: StudentFerpaAuthorization | null;
  delegateScopes: FerpaPortalScope[] | null;
};

type RequirementGroup = "next" | "reviewing" | "later" | "completed";
const terminalStatuses = new Set(["completed", "waived", "not_applicable"]);

const actionLabels: Record<string, string> = {
  profile_verification: "Verify profile",
  identity_document: "Upload ID",
  official_transcript: "Upload transcript",
  financial_aid_verification: "Upload documents",
  immunization_record: "Send record",
  housing_preference: "Choose housing",
  enrollment_deposit: "Pay deposit",
  orientation_registration: "Choose a session",
};

function progressOf(item: StudentRequirementDetail) {
  return Math.round(Math.min(100, Math.max(0, item.progressPercent || 0)));
}

function groupOf(item: StudentRequirementDetail): RequirementGroup {
  if (terminalStatuses.has(item.status)) return "completed";
  if (item.status === "submitted" || item.status === "under_review") return "reviewing";
  if (item.status === "blocked") return "later";
  return "next";
}

function priorityOf(item: StudentRequirementDetail) {
  const priority = (item as StudentRequirementDetail & { priority?: number }).priority;
  return typeof priority === "number" ? priority : 0;
}

function dueTime(item: StudentRequirementDetail) {
  const time = item.dueAt ? Date.parse(item.dueAt) : Number.POSITIVE_INFINITY;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function dueLabel(item: StudentRequirementDetail) {
  if (!item.dueAt) return "No deadline";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(item.dueAt));
}

function daysLeft(item: StudentRequirementDetail) {
  if (!item.dueAt) return null;
  return Math.max(0, Math.ceil((Date.parse(item.dueAt) - Date.now()) / 86_400_000));
}

function actionLabel(item: StudentRequirementDetail) {
  if (item.interactionType === "ferpa") return terminalStatuses.has(item.status) ? "Manage access" : "Complete FERPA";
  if (terminalStatuses.has(item.status)) return "Review";
  if (item.status === "blocked") return "View prerequisites";
  if (item.status === "submitted" || item.status === "under_review") return "View submission";
  return actionLabels[item.code] ??
    (item.submissionType === "document" ? "Upload document" :
      item.submissionType === "payment" ? "Make payment" :
        item.submissionType === "form" ? "Complete form" : "View details");
}

function kindFor(item: StudentRequirementDetail) {
  if (item.code.includes("housing")) return { tone: "housing", icon: "home" as const };
  if (item.code.includes("profile") || item.code.includes("identity")) return { tone: "profile", icon: "profile" as const };
  if (item.submissionType === "document") return { tone: "upload", icon: "file" as const };
  if (item.submissionType === "payment") return { tone: "meeting", icon: "card" as const };
  return { tone: "preferences", icon: "checklist" as const };
}

function RequirementTask({ item, recommended, studentManaged, onView }: {
  item: StudentRequirementDetail;
  recommended: boolean;
  studentManaged: boolean;
  onView: (item: StudentRequirementDetail) => void;
}) {
  const kind = kindFor(item);
  const remaining = daysLeft(item);
  const points = item.reward?.points ?? 0;
  return (
    <article className={`task-card${recommended ? " recommended" : ""}`}>
      {recommended ? (
        <div className="action-band">
          <span className="action-band-label"><StudentPortalIcon name="spark" size={14} /> Start here</span>
          <span className="action-band-aside">Highest priority right now</span>
        </div>
      ) : null}
      <div className="task-card-body">
        <div className={`task-type-icon ${kind.tone}`} aria-hidden="true"><StudentPortalIcon name={kind.icon} size={21} /></div>
        <div className="task-main">
          <div className="task-meta-row">
            <span>{item.responsibleOffice || "Enrollment"}</span>
            {item.blocking || priorityOf(item) > 0 ? <span className="priority-badge critical">Important</span> : null}
          </div>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <div className="task-facts">
            <span><StudentPortalIcon name="calendar" size={15} /> Due {dueLabel(item)}{remaining != null ? <b>· {remaining} days</b> : null}</span>
            <span><StudentPortalIcon name="checklist" size={15} /> {progressOf(item)}% complete</span>
          </div>
        </div>
        <div className="task-action">
          {points > 0 ? <div className="point-reward"><span><StudentPortalIcon name="spark" size={14} /> {points} pts today</span></div> : null}
          {studentManaged ? (
            <span className="secondary-button" aria-disabled="true">Student managed</span>
          ) : (
            <Link className={recommended ? "primary-button" : "secondary-button"} href={`/enrollment/requirements/${encodeURIComponent(item.slug)}`} onClick={() => onView(item)}>
              {actionLabel(item)} <StudentPortalIcon name="chevron" size={15} />
            </Link>
          )}
          {!studentManaged ? <Link className="text-button" href={`/enrollment/requirements/${encodeURIComponent(item.slug)}`} onClick={() => onView(item)}>How this works</Link> : null}
          <Link className="edward-ask" href={`/edward?requirement=${encodeURIComponent(item.slug)}`}><span className="edward-ask-mark" aria-hidden="true">E</span> Ask Edward</Link>
        </div>
      </div>
    </article>
  );
}

function StatusHeading({ icon, tone, title, note, aside, count, open, onToggle }: {
  icon: "checklist" | "calendar" | "close";
  tone: string;
  title: string;
  note: string;
  aside?: ReactNode;
  count?: number;
  open?: boolean;
  onToggle?: () => void;
}) {
  const content = (
    <>
      <span className={`status-icon ${tone}`} aria-hidden="true"><StudentPortalIcon name={icon} size={20} /></span>
      <div><h2>{title}</h2><p>{note}</p></div>
      {aside}
      {count != null || onToggle ? (
        <span className="status-trailing">
          {count != null ? <span className="status-count">{count}</span> : null}
          {onToggle ? <span className={`status-chevron${open ? " open" : ""}`}><StudentPortalIcon name="chevron" size={18} /></span> : null}
        </span>
      ) : null}
    </>
  );
  return onToggle ? <button className={`status-heading collapsible${open ? " open" : ""}`} type="button" aria-expanded={open} onClick={onToggle}>{content}</button> : <div className="status-heading">{content}</div>;
}

function CompactRequirement({ item, group }: { item: StudentRequirementDetail; group: RequirementGroup }) {
  const kind = kindFor(item);
  return (
    <article className={`compact-task ${group === "reviewing" ? "review-task" : group === "later" ? "locked-task" : "done-task"}`}>
      <div className={`task-type-icon ${kind.tone}`} aria-hidden="true"><StudentPortalIcon name={kind.icon} size={21} /></div>
      <div className="compact-copy">
        <span className="compact-eyebrow">{item.responsibleOffice || "Enrollment"}</span>
        <h3>{item.title}</h3>
        {group !== "completed" ? <p>{item.description}</p> : null}
        <div className="compact-meta"><span>{group === "completed" ? "Completed" : group === "reviewing" ? "Submitted to Aster" : `Opens after prerequisites · Due ${dueLabel(item)}`}</span></div>
      </div>
      {group === "reviewing" ? <span className="status-pill wait">In review</span> : null}
      {group === "later" ? <span className="locked-due">Due {dueLabel(item)}</span> : null}
      {group === "completed" && item.reward ? <span className="earned"><StudentPortalIcon name="spark" size={13} /> +{item.reward.points} pts</span> : null}
    </article>
  );
}

function AdvisorBar({ email, messagesAllowed }: { email?: string; messagesAllowed: boolean }) {
  return (
    <div className="advisor-bar">
      <img className="avatar avatar-md advisor-avatar" src="/people/tomas-okafor.webp" width={40} height={40} alt="" />
      <div className="advisor-bar-copy"><span className="panel-label">Your enrollment advisor</span><strong>Tomás Okafor <span>· Admissions Office</span></strong></div>
      <div className="advisor-actions">
        <a className="advisor-action" aria-label="Email Tomás Okafor" href={`mailto:${email ?? "admissions@aster.edu"}`}>✉</a>
        {messagesAllowed ? <Link className="advisor-action" aria-label="Message Tomás Okafor" href="/messages"><StudentPortalIcon name="message" size={16} /></Link> : null}
      </div>
    </div>
  );
}

function EnrollmentRail({ data, openCount }: { data: EnrollmentPageData; openCount: number }) {
  const rewards = data.bootstrap.rewards;
  const earned = rewards?.lifetimePoints ?? 0;
  const available = data.requirements.items.reduce((sum, item) => sum + (!terminalStatuses.has(item.status) ? item.reward?.points ?? 0 : 0), 0);
  return (
    <>
      {rewards ? (
        <div className="momentum-card" id="momentum">
          <div className="momentum-header"><span className="points-icon large"><StudentPortalIcon name="spark" size={21} /></span><div><span>Your momentum</span><strong>{Math.max(0, 800 - earned)} pts to one late fee waived</strong></div></div>
          <div className="level-track"><span style={{ width: `${Math.min(100, Math.max(6, earned / 8))}%` }} /></div>
          <div className="level-labels"><span>{earned.toLocaleString()} earned</span><span>800 pts</span></div>
          <div className="today-reward"><span><StudentPortalIcon name="spark" size={18} /></span><div><strong>{available} points are on the table today</strong><p>Most rewards decrease a little each day.</p></div></div>
          <Link className="learn-link" href="/profile">How points work <StudentPortalIcon name="chevron" size={14} /></Link>
        </div>
      ) : null}
      <div className="skipped-card">
        <div className="skipped-top"><img className="avatar avatar-sm" src="/people/maya-johnson.webp" width={32} height={32} alt="" /><span className="resume-badge">Saved from welcome</span></div>
        <h3>No rush. You can finish these now.</h3>
        <p>{openCount > 0 ? `You still have ${openCount} details to finish. Your place is saved, so nothing is lost.` : "Your welcome details are saved and everything is up to date."}</p>
        <Link href="/profile">Continue where I left off <StudentPortalIcon name="chevron" size={16} /></Link>
      </div>
    </>
  );
}

export default function EnrollmentPage() {
  const tenantRuntime = useTenant();
  const loadEnrollment = useCallback(async (signal: AbortSignal): Promise<EnrollmentPageData> => {
    const bootstrap = await getStudentBootstrap(signal);
    const delegateScopes = bootstrap.actor?.type === "delegate" ? bootstrap.actor.scopes : null;
    const canReadOnboarding = delegateScopes === null || delegateScopes.includes("enrollment");
    const [requirements, onboarding, ferpa] = await Promise.all([
      getStudentRequirements(signal),
      canReadOnboarding ? getStudentOnboarding(signal) : Promise.resolve(null),
      delegateScopes === null ? getStudentFerpaAuthorization(signal) : Promise.resolve({ authorization: null }),
    ]);
    return { bootstrap, requirements, onboarding, authorization: ferpa.authorization, delegateScopes };
  }, []);
  const enrollment = useApiResource(loadEnrollment);
  const { track } = useActivityTracking();
  const viewedAt = useRef(0);
  const lastTask = useRef<StudentRequirementDetail | null>(null);
  const [sort, setSort] = useState<"smart" | "due" | "quick">("smart");
  const [groupsOpen, setGroupsOpen] = useState({ reviewing: false, later: false, completed: false });

  useEffect(() => {
    track("ui.enrollment_started.v1", { entry_point: "portal_navigation" });
    const onHidden = () => {
      if (document.visibilityState !== "hidden" || !lastTask.current) return;
      track("ui.enrollment_task_abandoned.v1", { task_code: lastTask.current.code, task_status: lastTask.current.status, duration_bucket: durationBucket(Date.now() - viewedAt.current), last_interaction: "checklist_view" });
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [track]);

  const viewTask = (item: StudentRequirementDetail) => {
    lastTask.current = item;
    viewedAt.current = Date.now();
    track("ui.enrollment_task_viewed.v1", { task_code: item.code, task_status: item.status, entry_point: "enrollment_checklist" });
  };

  const groups = useMemo(() => {
    const result: Record<RequirementGroup, StudentRequirementDetail[]> = { next: [], reviewing: [], later: [], completed: [] };
    if (enrollment.status !== "ready") return result;
    enrollment.data.requirements.items.forEach((item) => result[groupOf(item)].push(item));
    const sorter = (left: StudentRequirementDetail, right: StudentRequirementDetail) => sort === "due" ? dueTime(left) - dueTime(right) : sort === "quick" ? progressOf(right) - progressOf(left) : priorityOf(right) - priorityOf(left) || (right.reward?.points ?? 0) - (left.reward?.points ?? 0) || dueTime(left) - dueTime(right);
    result.next.sort(sorter);
    return result;
  }, [enrollment.data, enrollment.status, sort]);

  const shellProps = { active: "enrollment" as const, eyebrow: "Offer accepted · Class of 2030", title: "Your requirements", description: "Your next steps are in the order that keeps things moving. Start with the first one, or pick any task you can do now." };
  if (enrollment.status === "loading") return <PortalShell {...shellProps}><LoadingState label="Loading your enrollment requirements" /></PortalShell>;
  if (enrollment.status === "error") return <PortalShell {...shellProps}><ErrorState message={enrollment.error} onRetry={enrollment.reload} /></PortalShell>;
  if (enrollment.data.requirements.total === 0) return <PortalShell {...shellProps}><EmptyState title="No requirements assigned" description="Your enrollment requirements will appear here once your journey begins." /></PortalShell>;

  const completedCount = groups.completed.length;
  const totalSteps = Math.max(20, enrollment.data.requirements.total);
  const progress = Math.round((completedCount / totalSteps) * 100);
  const blocking = groups.next.filter((item) => item.blocking).length + groups.later.filter((item) => item.blocking).length;
  const messagesAllowed = enrollment.data.delegateScopes === null || enrollment.data.delegateScopes.includes("messages");
  const admissionsEmail = tenantRuntime.tenant.contacts.admissions?.email ?? undefined;

  return (
    <PortalShell {...shellProps}>
      <section className="page-summary" aria-label="Enrollment progress">
        <div className="summary-main">
          <div className="summary-figure">
            <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties}><span>{progress}%</span></div>
            <div className="summary-figure-copy"><span className="panel-label">Your enrollment progress ⓘ</span><strong>{completedCount} of {totalSteps} steps complete</strong><p>{groups.next.length > 0 ? "You’re right on track. Your next task is ready when you are." : "Nothing is waiting on you right now."}</p></div>
          </div>
          <AdvisorBar email={admissionsEmail} messagesAllowed={messagesAllowed} />
        </div>
        {blocking > 0 ? <div className="summary-alert"><div className="notice soon"><span className="notice-mark" aria-hidden="true">⚑</span><span className="notice-copy"><strong>{blocking} {blocking === 1 ? "step has" : "steps have"} to be done before class registration.</strong></span><a className="notice-action" href="#enrollment-next-steps">See the {blocking === 1 ? "step" : `${blocking} steps`} →</a></div></div> : null}
      </section>

      <div className="page-body">
        <div className="page-main">
          <section className="section-card" id="enrollment-next-steps">
            <StatusHeading
              icon="checklist"
              tone="accent"
              title="Your next steps"
              note={groups.next.length ? "Ready when you are." : "Nothing is waiting on you right now."}
              aside={(
                <div className="sort-group" aria-label="Sort your next steps">
                  <button className={sort === "smart" ? "selected" : ""} aria-pressed={sort === "smart"} onClick={() => setSort("smart")}><StudentPortalIcon name="spark" size={15} /> Smart order</button>
                  <button className={sort === "due" ? "selected" : ""} aria-pressed={sort === "due"} onClick={() => setSort("due")}>Due soon</button>
                  <button className={sort === "quick" ? "selected" : ""} aria-pressed={sort === "quick"} onClick={() => setSort("quick")}>Fastest</button>
                </div>
              )}
            />
            {groups.next.length ? <div className="card-rows task-list">{groups.next.map((item, index) => <RequirementTask key={item.id} item={item} recommended={index === 0 && sort === "smart"} studentManaged={enrollment.data.delegateScopes !== null && item.interactionType === "ferpa"} onView={viewTask} />)}</div> : <p className="inline-empty">You’re all caught up. New steps appear here when Aster adds them.</p>}
          </section>

          <section className={`section-card${groups.reviewing.length && !groupsOpen.reviewing ? " collapsed" : ""}`}>
            <StatusHeading icon="calendar" tone="review" title="Aster is reviewing" note="You’ve done your part. No action needed right now." count={groups.reviewing.length || undefined} open={groupsOpen.reviewing} onToggle={groups.reviewing.length ? () => setGroupsOpen((value) => ({ ...value, reviewing: !value.reviewing })) : undefined} />
            {groups.reviewing.length ? <div className="card-rows review-list" hidden={!groupsOpen.reviewing}>{groups.reviewing.map((item) => <CompactRequirement key={item.id} item={item} group="reviewing" />)}</div> : <p className="inline-empty">Nothing is with Aster right now.</p>}
          </section>

          <section className={`section-card${groups.later.length && !groupsOpen.later ? " collapsed" : ""}`}>
            <StatusHeading icon="close" tone="locked" title="Coming up later" note="These will open automatically when you’re ready for them." count={groups.later.length || undefined} open={groupsOpen.later} onToggle={groups.later.length ? () => setGroupsOpen((value) => ({ ...value, later: !value.later })) : undefined} />
            {groups.later.length ? <div className="card-rows locked-list" hidden={!groupsOpen.later}>{groups.later.map((item) => <CompactRequirement key={item.id} item={item} group="later" />)}</div> : <p className="inline-empty">Nothing is waiting on a prerequisite.</p>}
          </section>

          <section className={`section-card${groups.completed.length && !groupsOpen.completed ? " collapsed" : ""}`}>
            <StatusHeading icon="checklist" tone="done" title={groups.completed.length ? `${groups.completed.length} steps completed` : "No steps completed yet"} note="Everything you have already finished." count={groups.completed.length || undefined} open={groupsOpen.completed} onToggle={groups.completed.length ? () => setGroupsOpen((value) => ({ ...value, completed: !value.completed })) : undefined} />
            {groups.completed.length ? <div className="card-rows completed-list" hidden={!groupsOpen.completed}>{groups.completed.map((item) => <CompactRequirement key={item.id} item={item} group="completed" />)}</div> : null}
          </section>
        </div>
        <aside className="page-rail"><EnrollmentRail data={enrollment.data} openCount={groups.next.length} /></aside>
      </div>
    </PortalShell>
  );
}
