"use client";

import type { StudentDocument } from "@vv/contracts";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Card, { CardRows } from "../design-system/primitives/Card.jsx";
import StatusPill from "../design-system/primitives/StatusPill.jsx";
import ActionBand from "../design-system/patterns/ActionBand.jsx";
import AdvisorBar from "../design-system/patterns/AdvisorBar.jsx";
import EntryRow from "../design-system/patterns/EntryRow.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import PageError from "../design-system/patterns/PageError.jsx";
import PageSkeleton from "../design-system/patterns/PageSkeleton.jsx";
import SummaryFigure from "../design-system/patterns/SummaryFigure.jsx";
import ToastStack from "../design-system/patterns/Toast.jsx";
import { useToasts } from "../design-lib/toast.js";
import { HealthAccessibilityPanel } from "../components/health-accessibility-panel";
import {
  accommodationAnswer,
  bandFor,
  isImmunizationRequirement,
  officeName,
  questionStanding,
  recordDocuments,
  recordStanding,
} from "../components/health-logic";
import { HealthRecordCard } from "../components/health-record-card";
import { HealthRecordDrawer } from "../components/health-record-drawer";
import { HealthRecordHistory } from "../components/health-record-history";
import { HealthRail } from "../components/health-rail";
import { PortalShell } from "../components/portal-shell";
import { useTenant } from "../components/tenant-provider";
import { useApiResource } from "../hooks/use-api-resource";
import {
  getStudentDocuments,
  getStudentOnboarding,
  getStudentRequirements,
} from "../lib/api-client";

/** The one line the advisor bar may add, and only here — H2, rule 1. */
const ADVISOR_SCOPE =
  "For anything about enrollment. Not part of your health record or your accessibility answer.";


export default function HealthPage() {
  const router = useRouter();
  const { tenant, href } = useTenant();
  // The institution's real admissions contact — no named advisor exists in the platform.
  const advisorContact = tenant.contacts.admissions ?? tenant.contacts.support ?? null;
  const ADVISOR = advisorContact
    ? { name: advisorContact.label, label: "Your admissions contact", office: null as string | null }
    : null;
  const { toasts, push, dismiss } = useToasts();

  const loadRequirements = useCallback((signal: AbortSignal) => getStudentRequirements(signal), []);
  const loadDocuments = useCallback((signal: AbortSignal) => getStudentDocuments(signal), []);
  const loadOnboarding = useCallback((signal: AbortSignal) => getStudentOnboarding(signal), []);
  const requirements = useApiResource(loadRequirements);
  const documents = useApiResource(loadDocuments);
  const onboarding = useApiResource(loadOnboarding);

  const [open, setOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

  const all = useMemo(() => requirements.data?.items ?? [], [requirements.data]);
  const requirement = useMemo(() => all.find(isImmunizationRequirement) ?? null, [all]);
  const files = useMemo(
    () => recordDocuments(requirement, documents.data?.items ?? []),
    [requirement, documents.data],
  );

  // A file still being checked advances on the record, not on this page: read it
  // again until the machine's part is done.
  const checking = files.some((file) => file.status === "processing" || file.status === "placeholder");
  const refreshDocuments = documents.refresh;
  useEffect(() => {
    if (!checking) return undefined;
    const timer = window.setInterval(() => refreshDocuments(), 5_000);
    return () => window.clearInterval(timer);
  }, [checking, refreshDocuments]);

  const documentsUnavailable = Boolean(requirement) && documents.status === "error";
  const answerUnavailable = onboarding.status === "error";
  const answer = accommodationAnswer(onboarding.data ?? null, tenant);
  const office = officeName(requirement);

  const record = recordStanding({ requirement, documents: files, all, unavailable: documentsUnavailable, tenant });
  const question = questionStanding({ answer, unavailable: answerUnavailable });
  const band = bandFor({
    state: record.state,
    answer,
    gating: Boolean(requirement?.blocking),
    office,
    unavailable: documentsUnavailable || answerUnavailable,
  });

  const contactAdvisor = (channel: string) => {
    if (channel === "email") {
      window.location.href = `mailto:${tenant.contacts.admissions?.email ?? tenant.contacts.support.email ?? ""}`;
      return;
    }
    router.push(href("/messages"));
  };

  const onSent = (uploaded: StudentDocument[]) => {
    if (uploaded.length === 0) return;
    documents.refresh();
    requirements.refresh();
    window.dispatchEvent(new CustomEvent("vv:student-record-changed"));
  };

  const loading =
    requirements.status === "loading" ||
    (requirements.status === "ready" && documents.status === "loading" && documents.data === null) ||
    (onboarding.status === "loading" && onboarding.data === null && requirements.status !== "error");

  return (
    <PortalShell
      active="health"
      summaryLabel="Health standing"
      summary={
        requirements.status === "ready" && !loading ? (
          <>
            <SummaryFigure
              label="Immunization record"
              figure={
                record.pill ? (
                  <>
                    <StatusPill tone={record.pill.tone} pulse={record.pill.pulse}>
                      {record.pill.label}
                    </StatusPill>
                    {record.consequence ? <span className="figure-consequence">{record.consequence}</span> : null}
                  </>
                ) : (
                  record.figure
                )
              }
            >
              {record.line}
            </SummaryFigure>
            {ADVISOR ? <AdvisorBar advisor={ADVISOR} note={ADVISOR_SCOPE} onContact={contactAdvisor} /> : null}
          </>
        ) : undefined
      }
      notice={
        requirements.status === "ready" && !loading ? (
          <Notice tone="quiet" icon="accessibility">
            {question.foot}
          </Notice>
        ) : undefined
      }
      rail={
        requirements.status === "ready" && !loading ? (
          <HealthRail requirement={requirement} state={record.state} unavailable={documentsUnavailable} />
        ) : undefined
      }
    >
      {loading ? (
        <PageSkeleton label="your health record" />
      ) : requirements.status === "error" ? (
        <PageError label="My Health and Wellness" onRetry={requirements.reload} />
      ) : (
        <>
          <HealthRecordCard
            requirement={requirement}
            documents={files}
            all={all}
            unavailable={documentsUnavailable}
            band={band?.kind === "record" ? band : null}
            onOpen={() => setOpen(true)}
            onRetry={documents.reload}
          />

          {!documentsUnavailable && requirement && files.length > 0 ? (
            <HealthRecordHistory requirement={requirement} documents={files} onReplace={() => setOpen(true)} />
          ) : null}

          <Card>
            {band?.kind === "question" ? <ActionBand icon={band.icon} label={band.label} /> : null}
            <CardRows>
              <EntryRow
                icon="accessibility"
                title="Accessibility"
                note="One question that’s yours to answer, or not."
                status={
                  question.pill ? (
                    <>
                      <StatusPill tone={question.pill.tone}>{question.pill.label}</StatusPill>
                      {question.consequence}
                    </>
                  ) : (
                    question.consequence
                  )
                }
                where={question.where}
                onOpen={() => setAccessOpen(true)}
              />
            </CardRows>
          </Card>

          {open && requirement ? (
            <HealthRecordDrawer
              requirement={requirement}
              documents={files}
              all={all}
              onClose={() => setOpen(false)}
              onSent={onSent}
              onToast={push}
            />
          ) : null}

          {accessOpen ? (
            <HealthAccessibilityPanel
              answer={answer}
              unavailable={answerUnavailable}
              onRetry={onboarding.reload}
              onClose={() => setAccessOpen(false)}
            />
          ) : null}
        </>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </PortalShell>
  );
}
