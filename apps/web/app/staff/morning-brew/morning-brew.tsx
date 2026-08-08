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
  BrewConnectorId,
  BrewDetailRef,
  BrewPreferences,
  BrewSectionId,
  BrewTeamId,
  EdwardRequest,
  MorningBrewDestination,
} from "./types";

type Mode = "loading" | "onboarding" | "briefing";

const draftFrom = (preferences: Omit<BrewPreferences, "version" | "updatedAt">): OnboardingDraft => ({
  teams: [...preferences.teams],
  connectors: { ...preferences.connectors },
  depth: preferences.depth,
  tone: preferences.tone,
  sections: { ...preferences.sections },
  deliveryTime: preferences.deliveryTime,
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
  const [draft, setDraft] = useState<OnboardingDraft>(() => draftFrom(DEFAULT_BREW_PREFERENCES));
  const [saved, setSaved] = useState<BrewPreferences | null>(null);
  const [detail, setDetail] = useState<BrewDetailRef | null>(null);
  const [edward, setEdward] = useState<EdwardRequest | null>(null);

  useEffect(() => {
    const stored = browserBrewPreferenceStore.load(scope);
    // A short beat keeps the persisted-preference check from flashing onboarding.
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
    () => saved ?? { ...DEFAULT_BREW_PREFERENCES, ...draft, version: 3, updatedAt: "", onboardingComplete: false },
    [saved, draft],
  );

  const briefing = useMemo(() => buildBrewBriefing(workspace, preferences), [workspace, preferences]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const complete = () => {
    if (!draft.teams.length) return;
    setSaved(browserBrewPreferenceStore.save(scope, { ...draft, onboardingComplete: true }));
    setDetail(null);
    setMode("briefing");
    setStep(1);
    scrollToTop();
  };

  const cancel = () => {
    if (!saved) return;
    setDraft(draftFrom(saved));
    setStep(1);
    setMode("briefing");
  };

  const openOnboarding = (target: OnboardingStep) => {
    if (saved) setDraft(draftFrom(saved));
    setDetail(null);
    setStep(target);
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
        firstName={workspace.currentStaff.name.split(" ")[0] || "there"}
        draft={draft}
        customizing={Boolean(saved?.onboardingComplete)}
        onToggleTeam={(team: BrewTeamId) =>
          setDraft((current) => ({
            ...current,
            teams: current.teams.includes(team)
              ? current.teams.filter((item) => item !== team)
              : [...current.teams, team],
          }))
        }
        onToggleConnector={(connector: BrewConnectorId) =>
          setDraft((current) => ({
            ...current,
            connectors: { ...current.connectors, [connector]: !current.connectors[connector] },
          }))
        }
        onToggleSection={(section: BrewSectionId) =>
          setDraft((current) => ({
            ...current,
            sections: { ...current.sections, [section]: !current.sections[section] },
          }))
        }
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onStep={(next) => {
          setStep(next);
          scrollToTop();
        }}
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
