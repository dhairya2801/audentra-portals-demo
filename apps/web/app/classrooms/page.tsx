"use client";

import { UniversityRecordPanel } from "../components/university-record";

import type { CatalogCourse } from "@vv/contracts";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Icon from "../design-system/Icon.jsx";
import ActionBand from "../design-system/patterns/ActionBand.jsx";
import InfoModal from "../design-system/patterns/InfoModal.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import PageError from "../design-system/patterns/PageError.jsx";
import PageSkeleton from "../design-system/patterns/PageSkeleton.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import SummaryFigure from "../design-system/patterns/SummaryFigure.jsx";
import Card, { CardHead, CardRows } from "../design-system/primitives/Card.jsx";
import { openEdward } from "../design-lib/door.js";
import { PortalShell } from "../components/portal-shell";
import { useTenant } from "../components/tenant-provider";
import { TenantLink as Link } from "../components/tenant-link";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentAcademics } from "../lib/api-client";
import { AcademicDrawer, type DrawerItem } from "../components/classrooms-academic-drawer";
import { ClassroomsCatalogSearch } from "../components/classrooms-catalog-search";
import { CreditMatchCard } from "../components/classrooms-credit-match-card";
import {
  MATCH_SOURCES,
  type CreditMatch,
  type DegreeCourse,
  type DegreeRequirement,
  bandFor,
  buildMatches,
  buildRequirements,
  courseSlug,
  creditTotals,
  creditsUnderReview,
  defaultOpenRequirements,
  electiveRemaining,
  groupRequirements,
  matchesFor,
} from "../components/classrooms-model";
import { ClassroomsRail } from "../components/classrooms-rail";
import { RequirementCard } from "../components/classrooms-requirement-card";

/**
 * The plan is the student's own list (brief, rule 3): remembered in
 * `localStorage`, one key per tenant, never sent anywhere, and not an input to
 * any counter on the page.
 */
function planKey(tenantId: string) {
  return `${tenantId}.degree.plan`;
}

function readPlan(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return new Set<string>(Array.isArray(list) ? list : []);
  } catch {
    return new Set<string>();
  }
}

function writePlan(key: string, plan: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...plan]));
  } catch {
    /* a browser that refuses storage still gets the plan for the session */
  }
}

function toggleIn(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function addTo(list: string[], id: string) {
  return list.includes(id) ? list : [...list, id];
}

const REGISTRAR = "Office of the Registrar";

export default function ClassroomsPage() {
  const { tenant } = useTenant();
  const load = useCallback((signal: AbortSignal) => getStudentAcademics(signal), []);
  const academics = useApiResource(load);
  const { track } = useActivityTracking();

  const currentTerm = tenant.academicContext.currentTermLabel ?? "";
  const institution = tenant.shortName;

  const data = academics.status === "ready" ? academics.data : null;
  const requirements = useMemo(() => (data ? buildRequirements(data) : []), [data]);
  const matches = useMemo(() => (data ? buildMatches(data, requirements) : []), [data, requirements]);

  const [open, setOpen] = useState<string[] | null>(null);
  const [openMatches, setOpenMatches] = useState<string[]>([]);
  const key = planKey(tenant.id);
  // Lazily, and only in the browser: the rows it marks render after the fetch,
  // so the server's empty plan and the browser's own never disagree on paint.
  const [plan, setPlan] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : readPlan(key),
  );
  const [drawerItem, setDrawerItem] = useState<DrawerItem | null>(null);
  const [creditModal, setCreditModal] = useState(false);

  useEffect(() => {
    if (!creditModal) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCreditModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [creditModal]);

  /** Scroll to something after the render that opens it has painted. */
  function setReveal({ id, block }: { id: string; block?: ScrollLogicalPosition }) {
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: block ?? "center" });
      }),
    );
  }

  const openIds = open ?? defaultOpenRequirements(requirements);

  function toggle(id: string) {
    setOpen(toggleIn(openIds, id));
  }

  function toggleMatch(id: string) {
    setOpenMatches((current) => toggleIn(current, id));
  }

  function revealRequirement(id: string, group?: string) {
    setOpen(addTo(openIds, id));
    setReveal({ id: group ? `requirement-${id}-${group}` : `requirement-${id}` });
  }

  function revealMatch(match: CreditMatch) {
    setOpenMatches((current) => addTo(current, match.id));
    setReveal({ id: `match-${match.id}` });
  }

  function revealCourse(match: CreditMatch) {
    setOpen(addTo(openIds, match.target.requirementId));
    setReveal({ id: `course-${courseSlug(match.target.courseCode)}` });
  }

  function revealMatches() {
    setReveal({ id: "waiting-on-registrar", block: "start" });
  }

  function addToPlan(code: string) {
    setPlan((current) => {
      const next = new Set(current);
      next.add(code);
      writePlan(key, next);
      return next;
    });
  }

  function removeFromPlan(code: string) {
    setPlan((current) => {
      const next = new Set(current);
      next.delete(code);
      writePlan(key, next);
      return next;
    });
  }

  function openCourse(course: DegreeCourse, requirement: DegreeRequirement) {
    setDrawerItem({ kind: "course", catalog: course.catalog, course, requirement });
    track("ui.course_viewed.v1", { course_code: course.code, surface: "program_plan" });
  }

  function openCatalogCourse(course: CatalogCourse) {
    const known = requirements
      .flatMap((requirement) =>
        requirement.courses.map((item) => ({ course: item, requirement })),
      )
      .find(({ course: item }) => item.code === course.code);
    setDrawerItem({
      kind: "course",
      catalog: course,
      course: known?.course ?? null,
      requirement: known?.requirement ?? null,
    });
    track("ui.course_viewed.v1", { course_code: course.code, surface: "catalog_search" });
  }

  function openMatch(match: CreditMatch) {
    setDrawerItem({ kind: "match", match });
    track("ui.exemption_reviewed.v1", {
      rule_code: match.ruleCode,
      recommendation_status: match.status,
    });
  }

  function askRegistrar(match: CreditMatch) {
    const what = match.evidence.detail.split(" ·")[0];
    openEdward({
      question: `Would the ${what} on my ${match.evidence.document} count toward ${match.target.requirementName}, and who decides that?`,
      context: {
        label: `My Degree · ${match.target.requirementName}`,
        intent: "advisor",
        office: "registrar",
        topic: "academic",
      },
    });
  }

  const program = data?.selectedProgram ?? null;
  const catalogVersion = data?.catalogVersion ?? "";
  const unknownProgram = data !== null && (!program || data.plan.length === 0);
  const creditsToGraduate = program?.totalCredits ?? data?.progress.requiredCredits ?? 0;

  const totals = creditTotals(requirements);
  const underReview = creditsUnderReview(matches);
  const approvedCredits = data
    ? data.progress.completedCredits + data.progress.exemptedCredits
    : 0;
  const percent = data ? data.progress.percent : 0;
  const groups = groupRequirements(requirements);
  const elective = electiveRemaining(requirements, creditsToGraduate);
  const band = data && !unknownProgram ? bandFor({ matches, requirements, currentTerm }) : null;

  const hero = {
    kicker: unknownProgram
      ? "My Degree · Program not assigned yet"
      : program
        ? `My Degree · ${program.degree} · ${program.name}`
        : "My Degree",
  };

  const summary =
    data && !unknownProgram ? (
      <SummaryFigure
        mark={
          <div className="progress-ring" style={{ "--progress": `${percent * 3.6}deg` } as CSSProperties}>
            <span>{percent}%</span>
          </div>
        }
        label="Credits approved"
        explain={{
          title: "Credits approved",
          body: `Credit the ${REGISTRAR} has approved, out of the ${creditsToGraduate} your program asks for. A potential match is reported below and is deliberately not counted here, and nothing you add to your plan moves it.`,
        }}
        figure={`${approvedCredits} of ${creditsToGraduate} credits approved`}
      >
        {totals.met} of {totals.total} requirements met · {elective} elective credits remaining ·{" "}
        {underReview > 0
          ? `${underReview} credits under review, not counted yet`
          : "nothing under review right now"}
      </SummaryFigure>
    ) : null;

  const caveat =
    data && !unknownProgram ? (
      <Notice tone="quiet" icon="info">
        {matches.length > 0
          ? `${matches.length} potential ${matches.length === 1 ? "match is" : "matches are"} waiting on the Registrar`
          : "Nothing is waiting on a credit decision"}
      </Notice>
    ) : null;

  return (
    <>
      <PortalShell
        active="classrooms"
        hero={hero}
        summaryLabel="Degree progress"
        summary={summary}
        notice={caveat}
        rail={
          data ? (
            <ClassroomsRail
              program={unknownProgram ? null : program}
              catalogVersion={data.catalogVersion}
              institution={institution}
              registrar={REGISTRAR}
              onOpenCredit={() => setCreditModal(true)}
            />
          ) : null
        }
      >
        <UniversityRecordPanel initialDomain="academics" />
        {academics.status === "loading" ? (
          <PageSkeleton label="your degree" />
        ) : academics.status === "error" ? (
          <PageError label="your degree" onRetry={academics.reload} />
        ) : unknownProgram ? (
          <StateCard variant="empty" icon="book" title="Your program hasn’t been assigned yet">
            {institution} assigns your academic program after your enrollment is confirmed. When
            it does, your degree requirements appear here: every requirement, what satisfies it,
            and any credit you already have.
          </StateCard>
        ) : (
          <>
            {groups.map((group, index) => (
              <Card key={group.id}>
                <CardHead
                  kind="status"
                  icon="book"
                  tone="requirement"
                  title={group.name}
                  note={group.summary}
                  aside={
                    <span className="group-count">
                      {group.requirements.length}{" "}
                      {group.requirements.length === 1 ? "requirement" : "requirements"}
                    </span>
                  }
                />

                {index === 0 && band ? (
                  <ActionBand
                    icon={band.kind === "matches" ? "clock" : "spark"}
                    label={band.label}
                    action={{
                      label: band.action,
                      onClick:
                        band.kind === "matches"
                          ? revealMatches
                          : () => revealRequirement(band.requirementId, "now"),
                    }}
                  />
                ) : null}

                <CardRows className="requirement-list">
                  {group.requirements.map((requirement) => (
                    <RequirementCard
                      key={requirement.id}
                      requirement={requirement}
                      matches={matches}
                      requirementMatches={matchesFor(matches, requirement.id)}
                      currentTerm={currentTerm}
                      open={openIds.includes(requirement.id)}
                      onToggle={toggle}
                      onReveal={revealRequirement}
                      plan={plan}
                      onPlan={addToPlan}
                      onUnplan={removeFromPlan}
                      onOpenCourse={openCourse}
                      onRevealMatch={revealMatch}
                    />
                  ))}
                </CardRows>
              </Card>
            ))}

            <Card className="match-section" id="waiting-on-registrar">
              <CardHead
                kind="status"
                icon="clock"
                tone="advisory"
                title="Waiting on the Registrar"
                note="Nothing here has been approved. None of it counts toward your degree yet."
                aside={<span className="advisory-badge">Advisory</span>}
              />

              {matches.length === 0 ? (
                <div className="match-empty">
                  <span className="state-icon" aria-hidden="true">
                    <Icon name="file" size={24} />
                  </span>
                  <h3>No potential matches yet</h3>
                  <p>
                    A match appears when a document you send {institution} looks like it might
                    cover a course in your catalog. Any of these would produce one:
                  </p>
                  <ul>
                    {MATCH_SOURCES.map((source) => (
                      <li key={source}>
                        <span>
                          <Icon name="check" size={14} />
                        </span>
                        {source}
                      </li>
                    ))}
                  </ul>
                  <Link className="secondary-button" href="/documents">
                    Send a record <Icon name="arrow" size={15} />
                  </Link>
                </div>
              ) : (
                <div className="match-list">
                  {matches.map((match) => (
                    <CreditMatchCard
                      key={match.id}
                      match={match}
                      requirements={requirements}
                      registrar={REGISTRAR}
                      open={openMatches.includes(match.id)}
                      onToggle={toggleMatch}
                      onOpen={openMatch}
                      onAsk={askRegistrar}
                      onRevealCourse={revealCourse}
                    />
                  ))}
                </div>
              )}
            </Card>

            <ClassroomsCatalogSearch
              institution={institution}
              catalogVersion={catalogVersion}
              onOpen={openCatalogCourse}
            />
          </>
        )}
      </PortalShell>

      {drawerItem && data ? (
        <AcademicDrawer
          item={drawerItem}
          catalogVersion={data.catalogVersion}
          institution={institution}
          registrar={REGISTRAR}
          suspended={creditModal}
          onClose={() => setDrawerItem(null)}
          onAsk={askRegistrar}
          onOpenCredit={() => setCreditModal(true)}
        />
      ) : null}

      {creditModal ? <InfoModal variant="credit" onClose={() => setCreditModal(false)} /> : null}
    </>
  );
}
