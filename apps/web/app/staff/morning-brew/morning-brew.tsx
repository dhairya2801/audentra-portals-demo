"use client";

import type { StaffOperationsWorkspace } from "@vv/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApiResource } from "../../hooks/use-api-resource";
import { getStaffMorningBrew } from "../../lib/api-client";
import { useTenant } from "../../components/tenant-provider";
import { buildBrewBriefing } from "./data";
import { MorningBrewDashboard } from "./dashboard";
import { MorningBrewDetail } from "./detail";
import { EdwardPanel } from "./edward-panel";
import { BrewLoading } from "./loading";
import { MorningBrewOnboarding, type OnboardingDraft, type OnboardingStep } from "./onboarding";
import { browserBrewPreferenceStore, DEFAULT_BREW_PREFERENCES } from "./preferences";
import type {
  BrewDetailRef,
  BrewPreferences,
  BrewSourceId,
  BrewSourcePreference,
  BrewTopicId,
  EdwardRequest,
  MorningBrewNavigate,
} from "./types";

/**
 * `building` is the beat after setup: the reader has just answered, and the
 * screen reads their answers back while the aggregate read finishes. It is a
 * separate mode from `loading` because only one of the two knows what was
 * chosen.
 */
type Mode = "loading" | "onboarding" | "building" | "briefing";

const draftFrom = (preferences: Omit<BrewPreferences, "version" | "updatedAt">): OnboardingDraft => ({
  topics: [...preferences.topics],
  sources: Object.fromEntries(
    Object.entries(preferences.sources).map(([id, source]) => [id, { ...source }]),
  ) as Record<BrewSourceId, BrewSourcePreference>,
});

/**
 * The briefing is an aggregate read over the whole tenant, so it fails on its
 * own terms. Showing the last stale edition with a fabricated freshness stamp
 * would be worse than saying the read did not complete.
 */
function BrewUnavailable({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="brew-unavailable" role="alert">
      <span className="brew-cup" aria-hidden="true" />
      <div>
        <h1>Today&rsquo;s briefing could not be assembled</h1>
        <p>{message}</p>
        <p className="brew-unavailable__note">
          Morning Brew reads live enrollment records. Rather than show yesterday&rsquo;s numbers
          under today&rsquo;s date, it waits for a successful read.
        </p>
      </div>
      <button className="button button--primary" type="button" onClick={onRetry}>
        Try again
      </button>
    </section>
  );
}

export function MorningBrewView({
  workspace,
  navigate,
}: {
  workspace: StaffOperationsWorkspace;
  navigate: MorningBrewNavigate;
}) {
  const tenantRuntime = useTenant();
  const scope = `${tenantRuntime.tenant.slug}:${workspace.currentStaff.id}`;

  const loadBrew = useCallback((signal: AbortSignal) => getStaffMorningBrew(signal), []);
  const brew = useApiResource(loadBrew, { refreshOnAmbient: false });

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
    () =>
      saved ?? {
        ...DEFAULT_BREW_PREFERENCES,
        ...draft,
        version: 6,
        updatedAt: "",
        onboardingComplete: false,
      },
    [saved, draft],
  );

  const staffName = workspace.currentStaff.name;
  const source = brew.data;

  const briefing = useMemo(
    () => (source ? buildBrewBriefing(source, preferences, staffName) : null),
    [source, preferences, staffName],
  );

  /* Setup previews the draft, not the saved copy, so the miniature on screen
     reacts to a choice before it has been committed. */
  const draftBriefing = useMemo(
    () =>
      source
        ? buildBrewBriefing(
            source,
            {
              ...DEFAULT_BREW_PREFERENCES,
              ...draft,
              version: 6,
              updatedAt: "",
              onboardingComplete: false,
            },
            staffName,
          )
        : null,
    [source, draft, staffName],
  );

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const goToStep = (next: OnboardingStep) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    scrollToTop();
  };

  const complete = () => {
    if (!draft.topics.length) return;
    setSaved(
      browserBrewPreferenceStore.save(scope, {
        ...draft,
        deliveryTime: saved?.deliveryTime ?? DEFAULT_BREW_PREFERENCES.deliveryTime,
        onboardingComplete: true,
      }),
    );
    setDetail(null);
    setMode("building");
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

  if (mode === "loading" || brew.status === "loading") {
    return (
      <BrewLoading
        firstName={saved ? staffName.split(" ")[0] || null : null}
        draft={saved ? draft : null}
        students={source?.population.students ?? null}
      />
    );
  }

  if (brew.status === "error" || !briefing || !draftBriefing) {
    return (
      <BrewUnavailable
        message={brew.error ?? "The briefing read returned no data."}
        onRetry={brew.reload}
      />
    );
  }

  if (mode === "building") {
    return (
      <BrewLoading
        firstName={briefing.greetingName}
        draft={draft}
        students={briefing.students}
        onDone={() => setMode("briefing")}
      />
    );
  }

  if (mode === "onboarding") {
    return (
      <MorningBrewOnboarding
        step={step}
        direction={direction}
        firstName={briefing.greetingName}
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
        onChangeSource={(id: BrewSourceId, patch: Partial<BrewSourcePreference>) =>
          setDraft((current) => ({
            ...current,
            sources: { ...current.sources, [id]: { ...current.sources[id], ...patch } },
          }))
        }
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
          staffName={staffName}
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
