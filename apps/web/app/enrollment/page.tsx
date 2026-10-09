"use client";

import type {
  FerpaPortalScope,
  StudentBootstrap,
  StudentFerpaAuthorization,
  StudentOnboarding,
  StudentRequirementDetail,
  StudentRequirementList,
} from "@vv/contracts";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "../components/student-meeting-refresh.css";
import { EnrollmentTour } from "../components/enrollment-tour";
import { TenantLink as Link } from "../components/tenant-link";
import { formatTenantDate } from "../lib/tenant";
import Icon from "../design-system/Icon.jsx";
import Card, { CardHead, CardRows } from "../design-system/primitives/Card.jsx";
import StatusPill from "../design-system/primitives/StatusPill.jsx";
import Tooltip from "../design-system/primitives/Tooltip.jsx";
import { StaffAvatar } from "../components/staff-avatar";
import InfoModal from "../design-system/patterns/InfoModal.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import PageError from "../design-system/patterns/PageError.jsx";
import PageSkeleton from "../design-system/patterns/PageSkeleton.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import SummaryFigure from "../design-system/patterns/SummaryFigure.jsx";
import { PortalShell } from "../components/portal-shell";
import { PointsInfoModal } from "../components/points-popover";
import { EnrollmentTaskCard } from "../components/enrollment-task-card";
import { EnrollmentTaskDrawer, type DrawerTab } from "../components/enrollment-task-drawer";
import { sampleRewards, displayedTaskPoints } from "../components/student-ui-preview";
import { EnrollmentCalendar } from "../components/enrollment-calendar";
import { MomentumCard, SkippedCard } from "../components/enrollment-rail";
import {
  GROUPS_DEFAULT,
  GROUPS_STORE,
  type GroupId,
  type RequirementGroup,
  type SortMode,
  criticalPath,
  completedLabel,
  daysLeft,
  dueLabel,
  groupOf,
  iconOf,
  kindOf,
  prerequisiteLine,
  requirementHref,
  sortTasks,
  unlocksOf,
} from "../components/enrollment-model";
import { useTenant } from "../components/tenant-provider";
import { useApiResource } from "../hooks/use-api-resource";
import { durationBucket, useActivityTracking } from "../hooks/use-activity-tracking";
import {
  getStudentAdvising,
  getStudentDocuments,
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

/** The remembered disclosure state of the three not-open groups; unreadable storage falls back to closed. */
function readGroups(): Record<GroupId, boolean> {
  try {
    const raw = window.localStorage.getItem(GROUPS_STORE);
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<GroupId, boolean>>) : null;
    return parsed && typeof parsed === "object" ? { ...GROUPS_DEFAULT, ...parsed } : GROUPS_DEFAULT;
  } catch {
    return GROUPS_DEFAULT;
  }
}

/** The onboarding step a skipped detail is finished on, as a requirement code. */
const REQUIREMENT_OF_STEP: Partial<Record<string, string>> = {
  deposit: "enrollment_deposit",
  housing: "housing_preference",
  about_you: "profile_verification",
};

export default function EnrollmentPage() {
  const { tenant, href } = useTenant();
  const router = useRouter();
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
  const enrollment = useApiResource(loadEnrollment, {refreshOnStudentEvents: true});
  const advising = useApiResource(useCallback((signal: AbortSignal) => getStudentAdvising(signal), []));
  const documents = useApiResource(useCallback((signal: AbortSignal) => getStudentDocuments(signal), []));
  const { track } = useActivityTracking();
  const viewedAt = useRef(0);
  const lastTask = useRef<StudentRequirementDetail | null>(null);
  const [sort, setSort] = useState<SortMode>("smart");
  // Read lazily: the groups only render once the data has loaded on the client.
  const [groupsOpen, setGroupsOpen] = useState<Record<GroupId, boolean>>(() =>
    typeof window === "undefined" ? GROUPS_DEFAULT : readGroups(),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("action");
  const [tourOpen, setTourOpen] = useState(false);
  const [smartModal, setSmartModal] = useState(false);
  const [pointsModal, setPointsModal] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(GROUPS_STORE, JSON.stringify(groupsOpen));
    } catch {
      // A portal that cannot remember a preference still has to work.
    }
  }, [groupsOpen]);

  useEffect(() => {
    track("ui.enrollment_started.v1", { entry_point: "portal_navigation" });
    const onHidden = () => {
      if (document.visibilityState !== "hidden" || !lastTask.current) return;
      track("ui.enrollment_task_abandoned.v1", {
        task_code: lastTask.current.code,
        task_status: lastTask.current.status,
        duration_bucket: durationBucket(Date.now() - viewedAt.current),
        last_interaction: "checklist_view",
      });
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [track]);

  const viewTask = useCallback(
    (item: StudentRequirementDetail) => {
      lastTask.current = item;
      viewedAt.current = Date.now();
      track("ui.enrollment_task_viewed.v1", {
        task_code: item.code,
        task_status: item.status,
        entry_point: "enrollment_checklist",
      });
    },
    [track],
  );

  const openTask = useCallback(
    (item: StudentRequirementDetail, tab: DrawerTab = "action") => {
      viewTask(item);
      if (tab === "action" && item.submissionType === "document" && item.status !== "blocked") {
        router.push(href(requirementHref(item)));
        return;
      }
      setActiveId(item.id);
      setDrawerTab(tab);
    },
    [href, router, viewTask],
  );
  const closeTask = useCallback(() => setActiveId(null), []);
  const closeModals = useCallback(() => {
    setSmartModal(false);
    setPointsModal(false);
  }, []);

  const items = useMemo(
    () => (enrollment.status === "ready" ? enrollment.data.requirements.items : []),
    [enrollment],
  );
  const groups = useMemo(() => {
    const result: Record<RequirementGroup, StudentRequirementDetail[]> = { next: [], reviewing: [], later: [], completed: [] };
    items.forEach((item) => result[groupOf(item)].push(item));
    result.next = sortTasks(result.next, sort, items);
    return result;
  }, [items, sort]);

  const shellProps = { active: "enrollment" as const };
  if (enrollment.status === "loading") {
    return (
      <PortalShell {...shellProps}>
        <PageSkeleton label="your enrollment" />
      </PortalShell>
    );
  }
  if (enrollment.status === "error") {
    return (
      <PortalShell {...shellProps}>
        <PageError label="your enrollment" onRetry={enrollment.reload} />
      </PortalShell>
    );
  }

  const data = enrollment.data;
  const rewards = data.bootstrap.rewards ?? sampleRewards;
  const rewardsOn = rewards !== null;
  const totalSteps = data.requirements.total || items.length;
  const completedCount = groups.completed.length;
  const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const earnedPoints = rewards?.lifetimePoints ?? 0;
  const availableToday = groups.next.reduce((sum, item) => sum + displayedTaskPoints(item), 0);
  const canToggle = true;
  const open = (id: GroupId) => groupsOpen[id];
  const toggle = (id: GroupId) => setGroupsOpen((current) => ({ ...current, [id]: !current[id] }));

  // ENR-214 semantics on the platform's `blocking` flag: what is yours to act
  // on holds registration; what is with the institution is waiting on them.
  const gatingMine = [...groups.next, ...groups.later].filter((item) => item.blocking);
  const gatingWaiting = groups.reviewing.filter((item) => item.blocking);
  const gateUrgent = gatingMine.some((item) => {
    const days = daysLeft(item);
    return days != null && days <= 7;
  });

  const contact = tenant.contacts.support ?? tenant.contacts.admissions ?? null;
  const enrollmentStaff = advising.data?.advisers.find(entry => entry.role === "admissions_counselor")?.staff;
  const advisor = enrollmentStaff ?? {name: "Bennett Abernathy", title: "Enrollment Support", email: null};
  const contactEmail = advisor.email || contact?.email;
  const contactPhone = contact?.phone;

  const skipped = data.onboarding?.data.skippedSteps ?? [];
  const resumeTarget = skipped
    .map((step) => REQUIREMENT_OF_STEP[step])
    .map((code) => groups.next.find((item) => item.code === code))
    .find((item): item is StudentRequirementDetail => Boolean(item));
  const onboardingOpen = data.onboarding ? data.onboarding.status !== "completed" : false;

  const active = activeId ? items.find((item) => item.id === activeId) ?? null : null;
  const summaryLine =
    groups.next.length > 0 ? "You’re right on track. Your next step is ready when you are." : "Nothing is waiting on you right now.";

  return (
    <PortalShell
      {...shellProps}
      summaryLabel="Enrollment progress"
      summary={
        <>
          <SummaryFigure
            mark={
              <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties}>
                <span>{progress}%</span>
              </div>
            }
            label="Your enrollment progress"
            explain={{
              title: "Steps complete",
              body: `${totalSteps} steps make up enrolling. One counts here once you have finished it. A step ${tenant.shortName} is still reading is with ${tenant.shortName}, and is not counted until it comes back.`,
            }}
            figure={`${completedCount} of ${totalSteps} steps complete`}
          >
            {summaryLine}
          </SummaryFigure>
          <div className="enrollment-adviser">
            <figure className="enrollment-adviser-portrait"><StaffAvatar person={advisor} size="lg"/></figure>
            <div className="enrollment-adviser-copy">
              <span className="panel-label">Your Enrollment Contact</span>
              <strong>{advisor.name}</strong>
              <span>{advisor.title}</span>
              <span className="enrollment-contact-phone">{contactPhone ? <a href={`tel:${contactPhone.replace(/[^+0-9]/g, "")}`}>{contactPhone}</a> : "(202) 555-0143"}</span>
              <div className="enrollment-contact-actions">
                {contactEmail && <a href={`mailto:${contactEmail}`}><Icon name="mail" size={14}/>Email</a>}
                <Link href={`/appointments?topic=enrollment_support${enrollmentStaff ? `&staff=${encodeURIComponent(enrollmentStaff.id)}` : ""}`}><Icon name="calendar" size={14}/>Book a Meeting</Link>
              </div>
            </div>
          </div>
        </>
      }
      notice={
        gatingMine.length > 0 ? (
          <Notice
            tone={gateUrgent ? "urgent" : "soon"}
            icon="flag"
            action={{
              label: `See the ${gatingMine.length === 1 ? "step" : `${gatingMine.length} steps`}`,
              onClick: () => {
                const first = gatingMine[0];
                setGroupsOpen(current => ({...current, [groupOf(first)]: true}));
                openTask(first, first.status === "blocked" ? "how" : "action");
              },
            }}
          >
            {gatingMine.length === 1 ? "One step has" : `${gatingMine.length} steps have`} to be done before you register for
            classes.
          </Notice>
        ) : gatingWaiting.length > 0 ? (
          <Notice tone="working" icon="clock">
            {gatingWaiting.length === 1
              ? `Your ${gatingWaiting[0].title.toLowerCase()} is with ${tenant.shortName}. Nothing more is needed from you before you register for classes.`
              : `Everything class registration needs is with ${tenant.shortName}. Nothing more is needed from you before you register.`}
          </Notice>
        ) : null
      }
      rail={
        <>
          {rewards ? (
            <MomentumCard rewards={rewards} availableToday={availableToday} onOpenPoints={() => setPointsModal(true)} />
          ) : null}
          <EnrollmentCalendar items={items} onOpen={item => openTask(item, "how")} />
          {skipped.length > 0 ? (
            <SkippedCard
              student={{ name: data.bootstrap.student.fullName }}
              skipped={skipped}
              onResume={
                resumeTarget
                  ? () => openTask(resumeTarget)
                  : onboardingOpen
                    ? () => router.push(href("/onboarding"))
                    : null
              }
            />
          ) : null}
        </>
      }
    >
      <div className="enrollment-intro"><span><Icon name="spark" size={15} /> A little progress, every day.</span><button type="button" onClick={()=>setTourOpen(true)}><Icon name="preview" size={15}/> Take a quick tour</button></div>
      {totalSteps === 0 ? (
        <Card>
          <StateCard variant="empty" icon="checklist" title="No steps assigned yet." className="inset">
            Your enrollment steps appear here once your journey begins.
          </StateCard>
        </Card>
      ) : (
        <>
          <Card>
            <CardHead
              kind="status"
              icon="checklist"
              tone="accent"
              title="Your next steps"
              note={groups.next.length > 0 ? "Ready when you are." : "Nothing is waiting on you right now."}
              aside={
                <div className="sort-group" aria-label="Sort your next steps">
                  <button
                    type="button"
                    className={sort === "smart" ? "selected" : ""}
                    aria-pressed={sort === "smart"}
                    onClick={() => setSort("smart")}
                  >
                    <Icon name="spark" size={15} weight={sort === "smart" ? "fill" : "bold"} /> Smart order
                  </button>
                  <button type="button" className={sort === "due" ? "selected" : ""} aria-pressed={sort === "due"} onClick={() => setSort("due")}>
                    Due soon
                  </button>
                  <button type="button" className={sort === "quick" ? "selected" : ""} aria-pressed={sort === "quick"} onClick={() => setSort("quick")}>
                    Fastest
                  </button>
                  <Tooltip tip="How smart order works">
                    <button type="button" className="sort-info" aria-label="How smart order works" onClick={() => setSmartModal(true)}>
                      <Icon name="info" size={17} />
                    </button>
                  </Tooltip>
                </div>
              }
            />

            {groups.next.length > 0 ? (
              <CardRows className="task-list">
                {groups.next.map((item, index) => (
                  <EnrollmentTaskCard
                    key={item.id}
                    item={item}
                    unlocks={unlocksOf(item, items)}
                    recommended={index === 0 && sort === "smart"}
                    feedback={documents.data?.items.filter(doc=>doc.requirementId===item.id && ['rejected','needs_resubmission'].includes(doc.status)).sort((a,b)=>Date.parse(b.review?.decidedAt||'')-Date.parse(a.review?.decidedAt||''))[0]?.review?.note || undefined}
                    rewardsOn={rewardsOn}
                    studentManaged={data.delegateScopes !== null && item.interactionType === "ferpa"}
                    onOpen={openTask}
                  />
                ))}
              </CardRows>
            ) : (
              <StateCard variant="done" icon="spark" title="You’re all caught up." className="inset">
                New steps appear here when {tenant.shortName} adds them.
              </StateCard>
            )}
          </Card>

          <Card className={groups.reviewing.length > 0 && !open("reviewing") ? "collapsed" : ""}>
            <CardHead
              kind="status"
              icon="clock"
              tone="review"
              title={`${tenant.shortName} is reviewing`}
              note="You’ve done your part. No action needed right now."
              count={groups.reviewing.length > 0 ? groups.reviewing.length : undefined}
              open={open("reviewing")}
              onToggle={canToggle && groups.reviewing.length > 0 ? () => toggle("reviewing") : undefined}
              controls="enrollment-reviewing"
            />
            {groups.reviewing.length > 0 ? (
              <CardRows className="review-list" id="enrollment-reviewing" hidden={!open("reviewing")}>
                {groups.reviewing.map((item) => (
                  <article className="compact-task review-task" key={item.id}>
                    <div className={`task-type-icon ${kindOf(item)}`} aria-hidden="true">
                      <Icon name={iconOf(item)} size={21} weight="duotone" />
                    </div>
                    <div className="compact-copy">
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <div className="compact-meta">
                        <span>Submitted to {item.responsibleOffice || tenant.shortName}</span>
                      </div>
                    </div>
                    <StatusPill tone="wait" pulse>
                      In review
                    </StatusPill>
                  </article>
                ))}
              </CardRows>
            ) : (
              <p className="inline-empty">
                Nothing is with {tenant.shortName} right now. Anything you send appears here while a team reads it.
              </p>
            )}
          </Card>

          <Card className={groups.later.length > 0 && !open("later") ? "collapsed" : ""}>
            <CardHead
              kind="status"
              icon="lock"
              tone="locked"
              title="Coming up later"
              note="These will open automatically when you’re ready for them."
              count={groups.later.length > 0 ? groups.later.length : undefined}
              open={open("later")}
              onToggle={canToggle && groups.later.length > 0 ? () => toggle("later") : undefined}
              controls="enrollment-later"
            />
            {groups.later.length > 0 ? (
              <CardRows className="locked-list" id="enrollment-later" hidden={!open("later")}>
                {groups.later.map((item) => (
                  <article className="compact-task locked-task" key={item.id}>
                    <div className={`task-type-icon ${kindOf(item)}`} aria-hidden="true">
                      <Icon name={iconOf(item)} size={21} weight="duotone" />
                    </div>
                    <div className="compact-copy">
                      {item.responsibleOffice ? <span className="compact-eyebrow">{item.responsibleOffice}</span> : null}
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <div className="prerequisite">
                        <Icon name="arrow" size={14} /> {prerequisiteLine(item, items)}
                      </div>
                    </div>
                    <span className="locked-due">{dueLabel(item, tenant)}</span>
                  </article>
                ))}
              </CardRows>
            ) : (
              <p className="inline-empty">
                Nothing is waiting on a prerequisite. Steps that need another one first appear here.
              </p>
            )}
          </Card>

          <Card className={groups.completed.length > 0 && !open("completed") ? "collapsed" : ""}>
            <CardHead
              kind="status"
              icon="check"
              tone="done"
              title={completedCount === 0 ? "No steps completed yet" : `${completedCount} ${completedCount === 1 ? "step" : "steps"} completed`}
              note={
                completedCount === 0
                  ? rewardsOn
                    ? "Each step you finish is listed here with the points it earned."
                    : "Each step you finish is listed here."
                  : rewardsOn
                    ? `${earnedPoints.toLocaleString()} ${rewards?.pointName ?? "points"} earned`
                    : "Everything you have already finished."
              }
              count={completedCount > 0 ? completedCount : undefined}
              open={open("completed")}
              onToggle={canToggle && completedCount > 0 ? () => toggle("completed") : undefined}
              controls="enrollment-completed"
            />
            {completedCount > 0 && (
              <CardRows className="completed-list" id="enrollment-completed" hidden={!open("completed")}>
                {groups.completed.map((item) => (
                  <article className="compact-task done-task" key={item.id}>
                    <div className={`task-type-icon ${kindOf(item)}`} aria-hidden="true">
                      <Icon name={iconOf(item)} size={21} weight="duotone" />
                    </div>
                    <div className="compact-copy">
                      {item.responsibleOffice ? <span className="compact-eyebrow">{item.responsibleOffice}</span> : null}
                      <h3>{item.title}</h3>
                      <div className="compact-meta">
                        <span>{completedLabel(item, tenant)}</span>
                      </div>
                    </div>
                    {rewardsOn && item.reward?.earned ? (
                      <span className="earned">
                        <Icon name="spark" size={13} /> +{item.reward.points} pts
                      </span>
                    ) : null}
                  </article>
                ))}
              </CardRows>
            )}
          </Card>
        </>
      )}

      {active && (
        <EnrollmentTaskDrawer
          item={active}
          unlocked={items.filter((other) => other.id !== active.id && other.dependencyCodes.includes(active.code))}
          tab={drawerTab}
          suspended={smartModal || pointsModal}
          rewardsOn={rewardsOn}
          onTab={setDrawerTab}
          onClose={closeTask}
          onOpenPoints={() => setPointsModal(true)}
          onView={viewTask}
        />
      )}

      {tourOpen && <EnrollmentTour onClose={()=>setTourOpen(false)} />}
      {smartModal && <InfoModal variant="smart" title="The path that moves you forward." icon="flow" kicker="SMART ORDER · EXPLAINED" onClose={closeModals}>
        <p>We follow the prerequisites published by your university, then look at the longest chain of remaining work, its nearest deadline and your estimated effort. Registration requirements come first.</p>
        <div className="smart-path-list">{groups.next.slice(0,3).map(item=>{const path=criticalPath(item,items);return <div key={item.id}><strong>{item.title}</strong><span>{path.count} dependent steps · about {path.minutes} min across the longest path</span><small>{Number.isFinite(path.deadline)?`Nearest deadline: ${formatTenantDate(new Date(path.deadline).toISOString(),tenant,{month:'short',day:'numeric'})}`:'No deadline published'}</small></div>;})}</div>
        <p>Effort is an estimate of your time. University review can take longer. Due soon sorts by date alone; Fastest starts with the shortest individual task.</p>
      </InfoModal>}
      {pointsModal && rewards && <PointsInfoModal rewards={rewards} onClose={closeModals} />}
    </PortalShell>
  );
}
