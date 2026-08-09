"use client";

import type { StaffOperationsWorkspace } from "@vv/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenant } from "../../components/tenant-provider";
import { buildBrewBriefing } from "./data";
import { MorningBrewDashboard } from "./dashboard";
import { MorningBrewDetail } from "./detail";
import { EdwardPanel } from "./edward-panel";
import { MorningBrewOnboarding, type OnboardingDraft, type OnboardingStep } from "./onboarding";
import { browserBrewPreferenceStore, DEFAULT_BREW_PREFERENCES } from "./preferences";
import type {
  BrewDetailRef,
  BrewIncludeId,
  BrewPreferences,
  BrewTopicId,
  EdwardRequest,
  MorningBrewDestination,
} from "./types";

type Mode = "loading" | "onboarding" | "briefing";

const draftFrom = (preferences: Omit<BrewPreferences, "version" | "updatedAt">): OnboardingDraft => ({
  topics: [...preferences.topics],
  include: { ...preferences.include },
  depth: preferences.depth,
  tone: preferences.tone,
  deliveryTime: preferences.deliveryTime,
  inboxDepth: preferences.inboxDepth,
  draftReplies: preferences.draftReplies,
  calendarPrep: preferences.calendarPrep,
  insightDetail: preferences.insightDetail,
  readingSources: [...preferences.readingSources],
});

function LoadingBrew() {
  return (
    <section className="brew-loading" aria-label="Preparing Morning Brew" aria-live="polite">
      <div className="brew-loading__masthead" />
      <div className="brew-loading__headline" />
      <div className="brew-loading__deck" />
      <div className="brew-loading__cards">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

export function MorningBrewView({
  workspace,
  navigate,
}: {
  workspace: StaffOperationsWorkspace;
  navigate: (destination: MorningBrewDestination) => void;
}) {
  const tenantRuntime = useTenant();
  const scope = `${tenantRuntime.tenant.slug}:${workspace.currentStaff.id}`;

  const [mode, setMode] = useState<Mode>("loading");
  const [step, setStep] = useState<OnboardingStep>(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [draft, setDraft] = useState<OnboardingDraft>(() => draftFrom(DEFAULT_BREW_PREFERENCES));
  const [saved, setSaved] = useState<BrewPreferences | null>(null);
  const [detail, setDetail] = useState<BrewDetailRef | null>(null);
  const [edward, setEdward] = useState<EdwardRequest | null>(null);

  useEffect(() => {
    const stored = browserBrewPreferenceStore.load(scope);
    // A short beat keeps the persisted-preference check from flashing setup.
    const timer = window.setTimeout(() => {
      if (stored) {
        setDraft(draftFrom(stored));
        setSaved(stored);
        setMode(stored.onboardingComplete ? "briefing" : "onboarding");
      } else {
        setMode("onboarding");
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [scope]);

  const preferences: BrewPreferences = useMemo(
    () => saved ?? { ...DEFAULT_BREW_PREFERENCES, ...draft, version: 4, updatedAt: "", onboardingComplete: false },
    [saved, draft],
  );

  const briefing = useMemo(() => buildBrewBriefing(workspace, preferences), [workspace, preferences]);

  /* Setup previews the draft, not the saved copy, so the miniature on screen
     reacts to a choice before it has been committed. */
  const draftBriefing = useMemo(
    () =>
      buildBrewBriefing(workspace, {
        ...DEFAULT_BREW_PREFERENCES,
        ...draft,
        version: 4,
        updatedAt: "",
        onboardingComplete: false,
      }),
    [workspace, draft],
  );

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const goToStep = (next: OnboardingStep) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    scrollToTop();
  };

  const complete = () => {
    if (!draft.topics.length) return;
    setSaved(browserBrewPreferenceStore.save(scope, { ...draft, onboardingComplete: true }));
    setDetail(null);
    setMode("briefing");
    setStep(1);
    setDirection(1);
    scrollToTop();
  };

  const cancel = () => {
    if (!saved) return;
    setDraft(draftFrom(saved));
    setStep(1);
    setDirection(1);
    setMode("briefing");
  };

  const openOnboarding = (target: OnboardingStep) => {
    if (saved) setDraft(draftFrom(saved));
    setDetail(null);
    setStep(target);
    setDirection(1);
    setMode("onboarding");
    scrollToTop();
  };

  const openDetail = useCallback((ref: BrewDetailRef) => {
    if (!ref.id) return;
    setDetail(ref);
    scrollToTop();
  }, []);

  const closeDetail = useCallback(() => {
    setDetail(null);
    scrollToTop();
  }, []);

  if (mode === "loading") return <LoadingBrew />;

  if (mode === "onboarding") {
    return (
      <MorningBrewOnboarding
        step={step}
        direction={direction}
        firstName={workspace.currentStaff.name.split(" ")[0] || "there"}
        draft={draft}
        preview={draftBriefing}
        customizing={Boolean(saved?.onboardingComplete)}
        onToggleTopic={(topic: BrewTopicId) =>
          setDraft((current) => ({
            ...current,
            topics: current.topics.includes(topic)
              ? current.topics.filter((item) => item !== topic)
              : [...current.topics, topic],
          }))
        }
        onToggleInclude={(include: BrewIncludeId) =>
          setDraft((current) => ({
            ...current,
            include: { ...current.include, [include]: !current.include[include] },
          }))
        }
        onToggleSource={(source: string) =>
          setDraft((current) => ({
            ...current,
            readingSources: current.readingSources.includes(source)
              ? current.readingSources.filter((item) => item !== source)
              : [...current.readingSources, source],
          }))
        }
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onStep={goToStep}
        onComplete={complete}
        onCancel={saved ? cancel : undefined}
      />
    );
  }

  return (
    <>
      {detail ? (
        <MorningBrewDetail
          detail={detail}
          briefing={briefing}
          onBack={closeDetail}
          navigate={navigate}
          onAskEdward={setEdward}
        />
      ) : (
        <MorningBrewDashboard
          briefing={briefing}
          preferences={preferences}
          staffName={workspace.currentStaff.name}
          navigate={navigate}
          onOpenDetail={openDetail}
          onAskEdward={setEdward}
          onCustomize={() => openOnboarding(1)}
          onManageConnections={() => openOnboarding(2)}
        />
      )}
      <EdwardPanel request={edward} briefing={briefing} onClose={() => setEdward(null)} />
    </>
  );
}
