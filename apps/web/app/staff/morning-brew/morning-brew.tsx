"use client";

import type { StaffOperationsWorkspace } from "@vv/contracts";
import { useEffect, useState } from "react";
import { useTenant } from "../../components/tenant-provider";
import { DEFAULT_MORNING_BREW_TOPICS } from "./data";
import { MorningBrewDashboard } from "./dashboard";
import { MorningBrewOnboarding } from "./onboarding";
import { browserMorningBrewPreferenceStore, DEFAULT_CONNECTORS } from "./preferences";
import type { MorningBrewConnectorId, MorningBrewDestination, MorningBrewPreferences, MorningBrewTopicId } from "./types";

type Mode = "loading" | "onboarding" | "briefing";

export function MorningBrewView({ workspace, navigate }: { workspace: StaffOperationsWorkspace; navigate: (destination: MorningBrewDestination) => void }) {
  const tenantRuntime = useTenant();
  const scope = `${tenantRuntime.tenant.slug}:${workspace.currentStaff.id}`;
  const [mode, setMode] = useState<Mode>("loading");
  const [step, setStep] = useState<1 | 2>(1);
  const [topics, setTopics] = useState<MorningBrewTopicId[]>(DEFAULT_MORNING_BREW_TOPICS);
  const [connectors, setConnectors] = useState({ ...DEFAULT_CONNECTORS });
  const [saved, setSaved] = useState<MorningBrewPreferences | null>(null);

  useEffect(() => {
    const preferences = browserMorningBrewPreferenceStore.load(scope);
    const timer = window.setTimeout(() => {
      if (preferences) {
        setTopics(preferences.topics.length ? preferences.topics : DEFAULT_MORNING_BREW_TOPICS);
        setConnectors(preferences.connectors);
        setSaved(preferences);
        setMode(preferences.onboardingComplete ? "briefing" : "onboarding");
      } else setMode("onboarding");
    }, 180);
    return () => window.clearTimeout(timer);
  }, [scope]);

  const save = () => {
    if (!topics.length) return;
    const value = browserMorningBrewPreferenceStore.save(scope, { topics, connectors, onboardingComplete: true });
    setSaved(value); setMode("briefing"); setStep(1); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancel = () => {
    if (!saved) return;
    setTopics(saved.topics); setConnectors(saved.connectors); setStep(1); setMode("briefing");
  };

  if (mode === "loading") return <section className="brew-loading" aria-label="Preparing Morning Brew" aria-live="polite"><div className="brew-loading__masthead"/><div className="brew-loading__headline"/><div className="brew-loading__deck"/><div className="brew-loading__cards"><span/><span/><span/></div></section>;
  if (mode === "onboarding") return <MorningBrewOnboarding step={step} topics={topics} connectors={connectors} customizing={Boolean(saved?.onboardingComplete)} onToggleTopic={(topic) => setTopics((current) => current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic])} onToggleConnector={(connector: MorningBrewConnectorId) => setConnectors((current) => ({ ...current, [connector]: !current[connector] }))} onNext={() => setStep(2)} onBack={() => setStep(1)} onComplete={save} onCancel={saved ? cancel : undefined}/>;
  return <MorningBrewDashboard workspace={workspace} topics={topics} connectors={connectors} navigate={navigate} onCustomize={() => { setStep(1); setMode("onboarding"); }} onManageConnections={() => { setStep(2); setMode("onboarding"); }}/>
}
