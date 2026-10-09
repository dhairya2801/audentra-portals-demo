"use client";

import "./morning-brew.css";

import {
  getBrewTeamSettings,
  saveBrewTeamSettings,
} from "../../lib/api-client";
import type { StaffBrewTeamSettings } from "@vv/contracts";
import type { StaffOperationsWorkspace } from "@vv/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildBrewBriefing } from "./data";
import { demoBrewSource } from "./demo-brew";
import { MorningBrewDashboard } from "./dashboard";
import { MorningBrewDetail } from "./detail";
import { openStaffEdward } from "../../lib/staff-edward-opening";
import { brewEdwardOpening } from "./edward-context";
import { BrewLoading } from "./loading";
import {
  MorningBrewOnboarding,
  type OnboardingDraft,
  type OnboardingStep,
} from "./onboarding";
import {
  browserBrewPreferenceStore,
  DEFAULT_BREW_PREFERENCES,
} from "./preferences";
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

const draftFrom = (
  preferences: Omit<BrewPreferences, "version" | "updatedAt">,
): OnboardingDraft => ({
  topics: [...preferences.topics],
  sources: Object.fromEntries(
    Object.entries(preferences.sources).map(([id, source]) => [
      id,
      { ...source },
    ]),
  ) as Record<BrewSourceId, BrewSourcePreference>,
});

export function MorningBrewView({
  workspace,
  navigate,
  subscribeToRealtimeInvalidation,
}: {
  workspace: Pick<StaffOperationsWorkspace, "currentStaff">;
  navigate: MorningBrewNavigate;
  subscribeToRealtimeInvalidation?: (invalidate: () => void) => () => void;
}) {
  const scope = `demo:${workspace.currentStaff.id}`;
  const firstName =
    workspace.currentStaff.name.trim().split(/\s+/)[0] || "there";

  // The corpus is one pinned morning — May 20, 2025, 7:30 AM ET — because
  // every relative label in it is counted from that date.
  const source = useMemo(() => demoBrewSource(), []);

  const [team, setTeam] = useState<StaffBrewTeamSettings | null>(null);
  const [teamError, setTeamError] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);
  const [mode, setMode] = useState<Mode>("loading");
  const [step, setStep] = useState<OnboardingStep>(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    draftFrom(DEFAULT_BREW_PREFERENCES),
  );
  const [saved, setSaved] = useState<BrewPreferences | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, string>>({});
  const detailOpener = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<BrewDetailRef | null>(null);

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
      void getBrewTeamSettings()
        .then((value) => {
          setTeam(value);
          setDraft((current) => ({
            ...current,
            sources: {
              ...current.sources,
              intelligence: {
                ...current.sources.intelligence,
                enabled: value.intelligenceEnabled,
              },
            },
          }));
        })
        .catch(() =>
          setTeamError(
            "Team setting unavailable. Your saved personal preview is shown; team controls are disabled.",
          ),
        );
    }, 180);
    return () => window.clearTimeout(timer);
  }, [scope]);

  // Canonical team changes invalidate the read. Never replace unsaved setup choices.
  useEffect(() => {
    if (mode !== "briefing") return;
    let active = true,
      pending = false;
    const refreshTeam = () => {
      if (pending || document.hidden) return;
      pending = true;
      void getBrewTeamSettings()
        .then((value) => {
          if (active) {
            setTeam(value);
            setTeamError("");
          }
        })
        .catch(() => {
          if (active)
            setTeamError(
              "Team visibility could not be refreshed. Showing the last saved setting.",
            );
        })
        .finally(() => {
          pending = false;
        });
    };
    const unsubscribe = subscribeToRealtimeInvalidation?.(refreshTeam);
    window.addEventListener("focus", refreshTeam);
    const timer = window.setInterval(refreshTeam, 60000);
    return () => {
      active = false;
      unsubscribe?.();
      window.removeEventListener("focus", refreshTeam);
      window.clearInterval(timer);
    };
  }, [mode, subscribeToRealtimeInvalidation]);

  const preferences: BrewPreferences = useMemo(
    () =>
      saved ?? {
        ...DEFAULT_BREW_PREFERENCES,
        ...draft,
        version: 7,
        updatedAt: "",
        onboardingComplete: false,
      },
    [saved, draft],
  );

  const briefing = useMemo(
    () =>
      buildBrewBriefing(
        source,
        {
          ...preferences,
          sources: {
            ...preferences.sources,
            intelligence: {
              ...preferences.sources.intelligence,
              enabled:
                team?.intelligenceEnabled ??
                preferences.sources.intelligence.enabled,
            },
          },
        },
        firstName,
      ),
    [source, preferences, firstName, team],
  );

  const askEdward = (request: EdwardRequest) => {
    openStaffEdward(brewEdwardOpening(request, briefing, detail));
    setDetail(null);
  };

  /* Setup previews the draft, not the saved copy, so the miniature on screen
     reacts to a choice before it has been committed. */
  const draftBriefing = useMemo(
    () =>
      buildBrewBriefing(
        source,
        {
          ...DEFAULT_BREW_PREFERENCES,
          ...draft,
          version: 7,
          updatedAt: "",
          onboardingComplete: false,
        },
        firstName,
      ),
    [source, draft, firstName],
  );

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const goToStep = (next: OnboardingStep) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    scrollToTop();
  };

  const complete = async () => {
    if (!draft.topics.length || savingTeam) return;
    if (
      team &&
      team.intelligenceEnabled !== draft.sources.intelligence.enabled
    ) {
      if (!team.canManage) return;
      setSavingTeam(true);
      setTeamError("");
      try {
        setTeam(
          await saveBrewTeamSettings({
            expectedVersion: team.version,
            intelligenceEnabled: draft.sources.intelligence.enabled,
          }),
        );
      } catch {
        setTeamError(
          "Your team setting could not be saved or changed elsewhere. Your choices are retained. Review the current team setting and try again.",
        );
        try {
          setTeam(await getBrewTeamSettings());
        } catch {}
        setSavingTeam(false);
        return;
      }
      setSavingTeam(false);
    }
    setSaved(
      browserBrewPreferenceStore.save(scope, {
        ...draft,
        deliveryTime:
          saved?.deliveryTime ?? DEFAULT_BREW_PREFERENCES.deliveryTime,
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
    setDraft(
      draftFrom({
        ...saved,
        sources: {
          ...saved.sources,
          intelligence: {
            ...saved.sources.intelligence,
            enabled:
              team?.intelligenceEnabled ?? saved.sources.intelligence.enabled,
          },
        },
      }),
    );
    setStep(1);
    setDirection(1);
    setMode("briefing");
  };

  const openOnboarding = (target: OnboardingStep) => {
    if (saved)
      setDraft(
        draftFrom({
          ...saved,
          sources: {
            ...saved.sources,
            intelligence: {
              ...saved.sources.intelligence,
              enabled:
                team?.intelligenceEnabled ?? saved.sources.intelligence.enabled,
            },
          },
        }),
      );
    setDetail(null);
    setStep(target);
    setDirection(1);
    setMode("onboarding");
    scrollToTop();
  };

  const openDetail = useCallback((ref: BrewDetailRef) => {
    if (!ref.id) return;
    if (!document.querySelector(".brew-detail-layer"))
      detailOpener.current = document.activeElement as HTMLElement;
    setDetail(ref);
  }, []);

  const closeDetail = useCallback(() => {
    setDetail(null);
    requestAnimationFrame(() => detailOpener.current?.focus());
  }, []);

  if (mode === "loading") {
    return (
      <BrewLoading
        firstName={saved ? briefing.greetingName : null}
        draft={saved ? draft : null}
        students={source.students}
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
        draft={draft}
        preview={draftBriefing}
        sample={buildBrewBriefing(source, {
          ...preferences,
          topics: draft.topics,
          sources: Object.fromEntries(
            Object.entries(draft.sources).map(([id, source]) => [
              id,
              { ...source, enabled: true, detail: "deep" },
            ]),
          ) as BrewPreferences["sources"],
        })}
        customizing={Boolean(saved?.onboardingComplete)}
        onToggleTopic={(topic: BrewTopicId) =>
          setDraft((current) => ({
            ...current,
            topics: current.topics.includes(topic)
              ? current.topics.filter((item) => item !== topic)
              : [...current.topics, topic],
          }))
        }
        onChangeSource={(
          id: BrewSourceId,
          patch: Partial<BrewSourcePreference>,
        ) =>
          setDraft((current) => ({
            ...current,
            sources: {
              ...current.sources,
              [id]: { ...current.sources[id], ...patch },
            },
          }))
        }
        onStep={goToStep}
        canManageTeam={Boolean(team?.canManage)}
        saving={savingTeam}
        teamNotice={
          <div className="brew-team-notice" role="status">
            {team ? (
              <>
                <strong>Team setting · {team.team}</strong>
                <span>
                  {team.canManage
                    ? "Changing this switch applies to everyone on your team when you save."
                    : "Your team administrator controls visibility. Your reading depth remains personal."}
                </span>
              </>
            ) : (
              "Loading your team setting…"
            )}
            {teamError ? <p role="alert">{teamError}</p> : null}
          </div>
        }
        onComplete={() => void complete()}
        onCancel={saved ? cancel : undefined}
      />
    );
  }

  return (
    <>
      <div inert={Boolean(detail)}>
        <MorningBrewDashboard
          liveNews
          briefing={briefing}
          preferences={preferences}
          replies={replies}
          onOpenDetail={openDetail}
          onAskEdward={askEdward}
          onCustomize={() => openOnboarding(1)}
          onManageConnections={() => openOnboarding(2)}
        />
      </div>
      {detail ? (
        <MorningBrewDetail
          detail={detail}
          briefing={briefing}
          onBack={closeDetail}
          onOpenDetail={openDetail}
          onManagePreferences={() => openOnboarding(2)}
          drafts={drafts}
          onDraftChange={(id, text) =>
            setDrafts((current) => ({ ...current, [id]: text }))
          }
          replies={replies}
          onDemoReply={(id, text) =>
            setReplies((current) => ({ ...current, [id]: text }))
          }
          navigate={navigate}
          onAskEdward={askEdward}
        />
      ) : null}
    </>
  );
}
