"use client";

import { UniversityHousingPanel } from "../components/university-record";

import type {
  HousingPreference,
  StudentHousingPlan,
  StudentHousingResidence,
  UpdateStudentHousingPlanInput,
} from "@vv/contracts";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StatusPill from "../design-system/primitives/StatusPill.jsx";
import AdvisorBar from "../design-system/patterns/AdvisorBar.jsx";
import InfoModal from "../design-system/patterns/InfoModal.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import PageError from "../design-system/patterns/PageError.jsx";
import PageSkeleton from "../design-system/patterns/PageSkeleton.jsx";
import SummaryFigure from "../design-system/patterns/SummaryFigure.jsx";
import ToastStack from "../design-system/patterns/Toast.jsx";
import { type ToastInput, useToasts } from "../design-lib/toast.js";
import { HousingCatalogue } from "../components/housing-catalogue";
import {
  SHORTLIST_MAX,
  bandFor,
  deadlineOf,
  housingRequirement,
  opensShortlist,
  ordinal,
  planById,
  planSourceOf,
  planStanding,
  rankedLine,
  residenceById,
  shortlistOf,
  showsCatalogue,
} from "../components/housing-logic";
import { HousingPlanOutcome } from "../components/housing-plan-outcome";
import { HousingPlanPanel } from "../components/housing-plan-panel";
import { HousingRail } from "../components/housing-rail";
import { HousingResidenceDrawer } from "../components/housing-residence-drawer";
import { HousingShortlistPanel } from "../components/housing-shortlist-panel";
import { PortalShell } from "../components/portal-shell";
import { useTenant } from "../components/tenant-provider";
import { getApiErrorMessage, useApiResource } from "../hooks/use-api-resource";
import {
  getStudentHousingPlan,
  getStudentOnboarding,
  getStudentRequirements,
  updateStudentHousingPlan,
} from "../lib/api-client";


type Change = Omit<UpdateStudentHousingPlanInput, "expectedVersion">;
type ShortlistToast = { title: string; body?: string; action?: { label: string; onAct: () => void } };

export default function HousingPage() {
  const router = useRouter();
  const { tenant, href } = useTenant();
  // The institution's real admissions contact — no named advisor exists in the platform.
  const advisorContact = tenant.contacts.admissions ?? tenant.contacts.support ?? null;
  const ADVISOR = advisorContact
    ? { name: advisorContact.label, label: "Your admissions contact", office: null as string | null }
    : null;
  const { toasts, push, dismiss } = useToasts();

  const loadPlan = useCallback((signal: AbortSignal) => getStudentHousingPlan(signal), []);
  const loadRequirements = useCallback((signal: AbortSignal) => getStudentRequirements(signal), []);
  const loadOnboarding = useCallback((signal: AbortSignal) => getStudentOnboarding(signal), []);
  const housing = useApiResource(loadPlan);
  const requirements = useApiResource(loadRequirements);
  const onboarding = useApiResource(loadOnboarding);

  // The record as last confirmed by Residential Life. A change that did not
  // land never reaches it, so what is shown is always what was saved.
  const [saved, setRecord] = useState<StudentHousingPlan | null>(null);
  const record =
    saved && (!housing.data || saved.version >= housing.data.version) ? saved : housing.data;
  // Every save reads the version the record has *now* — an undo offered a
  // moment ago must not send the version from before the change it undoes.
  const latest = useRef(record);
  useEffect(() => {
    latest.current = record;
  }, [record]);

  // The plan she just chose, shown while Residential Life confirms it — and
  // dropped the moment the record answers, whichever way.
  const [pendingPlan, setPendingPlan] = useState<HousingPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const lastChange = useRef<Change | null>(null);
  const [open, setOpen] = useState<StudentHousingResidence | null>(null);
  const [how, setHow] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const requirement = useMemo(() => housingRequirement(requirements.data?.items ?? []), [requirements.data]);
  const office = requirement?.responsibleOffice?.trim() || "Residential Life";
  const deadline = deadlineOf(requirement, tenant);
  const plan = pendingPlan ?? record?.preference ?? null;
  const shortlist = useMemo(() => shortlistOf(record), [record]);
  const catalogue = useMemo(() => record?.residences ?? [], [record]);
  const source = planSourceOf(plan, onboarding.data ?? null);
  const standing = planStanding({ plan, source, deadline });
  const ranked = rankedLine(plan, shortlist);
  const band = bandFor({ plan, shortlist, catalogueCount: catalogue.length, deadline, failure });

  async function save(change: Change, onSaved: (saved: StudentHousingPlan) => void) {
    const record = latest.current;
    if (!record) return;
    lastChange.current = change;
    setSaving(true);
    setFailure(null);
    try {
      const saved = await updateStudentHousingPlan({ expectedVersion: record.version, ...change });
      // The change response carries the plan and not the published catalogue;
      // the catalogue is the one already read, until the next read.
      setRecord({ ...saved, residences: saved.residences?.length ? saved.residences : record.residences });
      onSaved(saved);
      housing.refresh();
      requirements.refresh();
      window.dispatchEvent(new CustomEvent("vv:student-record-changed"));
    } catch (error) {
      const current = planById(record.preference, deadline?.label ?? null);
      setFailure(
        `${getApiErrorMessage(error)} ${office}’s record still says ${
          current ? current.label.toLowerCase() : "no plan yet"
        }, and that is what is shown above.`,
      );
    } finally {
      setPendingPlan(null);
      setSaving(false);
    }
  }

  function retry() {
    const change = lastChange.current;
    if (!change) return;
    void save(change, () => push({ tone: "success", title: "Saved." }));
  }

  function choosePlan(next: HousingPreference) {
    const option = planById(next, deadline?.label ?? null);
    setPendingPlan(next);
    void save({ preference: next }, () =>
      push({
        tone: "success",
        title: option?.complete ? "Saved." : "Saved as still deciding.",
        body: option?.complete ? option.consequence : `${office} will help you decide.`,
      }),
    );
  }

  function saveShortlist(next: string[], toast: ShortlistToast) {
    const change: Change = {
      preference: "on_campus",
      residencePreferences: next,
      ...(next[0] ? { residenceOption: next[0] } : {}),
    };
    const confirmation: ToastInput = { tone: "success", ...toast };
    void save(change, () => push(confirmation));
  }

  function addResidence(value: string) {
    if (shortlist.length >= SHORTLIST_MAX || shortlist.includes(value)) return;
    const next = [...shortlist, value];
    saveShortlist(next, { title: `Saved as your ${ordinal(next.length - 1)}.` });
  }

  function removeResidence(value: string) {
    const rank = shortlist.indexOf(value);
    if (rank < 0) return;
    const before = [...shortlist];
    const name = residenceById(catalogue, value)?.name ?? "That residence";
    saveShortlist(
      shortlist.filter((item) => item !== value),
      {
        title: `${name} removed.`,
        body: "Your order saved on its own.",
        action: { label: "Undo", onAct: () => saveShortlist(before, { title: "Restored." }) },
      },
    );
  }

  function moveResidence(index: number, direction: 1 | -1) {
    const target = index + direction;
    if (target < 0 || target >= shortlist.length) return;
    const next = [...shortlist];
    [next[index], next[target]] = [next[target], next[index]];
    const moved = residenceById(catalogue, next[target])?.name ?? "It";
    saveShortlist(next, { title: "Saved.", body: `${moved} is now your ${ordinal(target)}.` });
  }

  function openResidence(residence: StudentHousingResidence, node: HTMLElement | null) {
    returnFocus.current = node;
    setOpen(residence);
  }

  function closeResidence() {
    setOpen(null);
    returnFocus.current?.focus();
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const contactAdvisor = (channel: string) => {
    if (channel === "email") {
      window.location.href = `mailto:${tenant.contacts.admissions?.email ?? tenant.contacts.support.email ?? ""}`;
      return;
    }
    router.push(href("/messages"));
  };

  const loading = housing.status === "loading" || (requirements.status === "loading" && requirements.data === null);
  const ready = housing.status === "ready" && record !== null && !loading;
  const catalogueUnavailable = false;

  return (
    <PortalShell
      active="housing"
      hero={{
        lede: deadline
          ? `Two questions: where you’ll live, and which residence halls you’d like if that’s on campus. You can change both until ${deadline.full}.`
          : undefined,
      }}
      summaryLabel="Housing standing"
      summary={
        ready ? (
          <>
            <SummaryFigure
              label="Housing plan"
              figure={
                <>
                  <StatusPill tone={standing.tone}>{standing.status}</StatusPill>
                  {ranked ? <span className="figure-consequence">{ranked}</span> : null}
                </>
              }
            >
              {standing.line}
            </SummaryFigure>
            {ADVISOR ? (
              <AdvisorBar
                advisor={ADVISOR}
                note={`For anything about enrollment. Your housing plan and your room are ${office}’s to decide.`}
                onContact={contactAdvisor}
              />
            ) : null}
          </>
        ) : undefined
      }
      notice={
        ready && failure ? (
          <Notice tone="urgent" icon="alert" title="That change was not saved">
            {failure}
          </Notice>
        ) : undefined
      }
      rail={ready ? <HousingRail office={office} deadline={deadline} onHow={() => setHow(true)} /> : undefined}
    >
      {ready && <UniversityHousingPanel />}
      {loading ? (
        <PageSkeleton label="your housing plan" />
      ) : housing.status === "error" || !record ? (
        <PageError label="Housing" onRetry={housing.reload} />
      ) : (
        <>
          <HousingPlanPanel
            plan={plan}
            source={source}
            deadline={deadline}
            saving={saving}
            band={band?.kind === "plan" || band?.kind === "retry" ? band : null}
            onChoose={choosePlan}
            onRetry={retry}
          />

          {!plan ? (
            <HousingPlanOutcome
              variant="awaiting"
              office={office}
              deadline={deadline}
              catalogueCount={catalogue.length}
              catalogueUnavailable={catalogueUnavailable}
              onHow={() => setHow(true)}
            />
          ) : null}
          {plan === "commuting" || plan === "family" || plan === "off_campus" || plan === "undecided" ? (
            <HousingPlanOutcome
              variant={plan}
              office={office}
              deadline={deadline}
              catalogueCount={catalogue.length}
              catalogueUnavailable={catalogueUnavailable}
              onHow={() => setHow(true)}
            />
          ) : null}

          {opensShortlist(plan) && (shortlist.length > 0 || catalogue.length > 0) ? (
            <HousingShortlistPanel
              shortlist={shortlist}
              catalogue={catalogue}
              office={office}
              deadline={deadline}
              saving={saving}
              band={band?.kind === "shortlist" ? band : null}
              onBand={() => scrollTo("catalogue-heading")}
              onMove={moveResidence}
              onRemove={removeResidence}
              onOpen={openResidence}
            />
          ) : null}

          {showsCatalogue(plan) ? (
            <HousingCatalogue
              catalogue={catalogue}
              unavailable={catalogueUnavailable}
              office={office}
              shortlist={shortlist}
              readOnly={plan === "undecided"}
              saving={saving}
              onAdd={addResidence}
              onOpen={openResidence}
              onSeeShortlist={() => scrollTo("shortlist-heading")}
              onRetry={housing.reload}
            />
          ) : null}

          {open ? (
            <HousingResidenceDrawer
              residence={open}
              office={office}
              rankIndex={shortlist.indexOf(open.value)}
              canAdd={shortlist.length < SHORTLIST_MAX}
              readOnly={plan !== "on_campus"}
              saving={saving}
              onAdd={(value) => {
                addResidence(value);
                closeResidence();
              }}
              onRemove={(value) => {
                removeResidence(value);
                closeResidence();
              }}
              onSeeShortlist={() => {
                closeResidence();
                scrollTo("shortlist-heading");
              }}
              onClose={closeResidence}
            />
          ) : null}

          {how ? (
            <InfoModal variant="housing" kicker="Housing" icon="home" title="How housing decisions work" onClose={() => setHow(false)}>
              <p>
                You are telling {office} what you would like, in the order you would like it. They decide,
                and they may place you somewhere you didn’t name. That’s what makes this a preference and
                not a booking.
              </p>
              <p>
                Your order still matters. They read it first to last, and a residence hall you never name
                is one you won’t be considered for.
              </p>
            </InfoModal>
          ) : null}
        </>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </PortalShell>
  );
}
