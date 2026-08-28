"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../design-system/Icon.jsx";
import { BREW_DETAIL_LEVELS, BREW_SOURCES, BREW_TOPICS } from "./catalog";
import { MorningBrewDashboard } from "./dashboard";
import { DEFAULT_BREW_PREFERENCES } from "./preferences";
import { SourcePreview } from "./source-previews";
import type {
  BrewBriefing,
  BrewDetailLevelId,
  BrewPreferences,
  BrewSourceDefinition,
  BrewSourceId,
  BrewSourcePreference,
  BrewTopicId,
} from "./types";

/** Setup is two questions now: what you follow, and what we bring you. */
export type OnboardingStep = 1 | 2;

export interface OnboardingDraft {
  topics: BrewTopicId[];
  sources: Record<BrewSourceId, BrewSourcePreference>;
}

const STEP_LABELS: Record<OnboardingStep, string> = { 1: "Topics", 2: "What's in it" };

const LEVEL_ICON: Record<BrewDetailLevelId, string> = {
  glance: "preview",
  context: "gauge",
  deep: "rise",
};

/** The dark tile that carries a source's glyph, in the list and in the preview. */
function SourceMark({ source, size = 18 }: { source: BrewSourceDefinition; size?: number }) {
  return (
    <span className={`brew-source-mark brew-source-mark--${source.accent}`} aria-hidden="true">
      <Icon name={source.icon} size={size} />
    </span>
  );
}

/* --------------------------------------------------------------- live preview */

/** Which section of the brief a source produces, for the scroll-to on open. */
const SECTION_OF: Record<BrewSourceId, string> = {
  pulse: "brew-pulse-title",
  news: "brew-news-title",
  calendar: "brew-deadlines-title",
  email: "brew-requests-title",
  actions: "brew-priorities-title",
  intelligence: "brew-insights-title",
};

/**
 * Tomorrow's edition, at a third of the size.
 *
 * This is not a drawing of the brief — it is the brief. The same
 * `MorningBrewDashboard` the reader meets after setup is rendered here from the
 * in-progress draft and scaled down, so there is no second implementation to
 * drift out of step with the first, and nothing the miniature shows can turn
 * out not to be what arrives. It is held inert: no focus, no pointer, no
 * navigation, and every callback a no-op.
 *
 * Opening a source card scrolls the miniature to the section that source
 * produces, so the answer to "what does this do to my morning" is on screen
 * beside the question.
 */
function BrewLivePreview({
  briefing,
  preferences,
  staffName,
  focus,
}: {
  briefing: BrewBriefing;
  preferences: BrewPreferences;
  staffName: string;
  /** The source whose card is open; the miniature scrolls to its section. */
  focus: BrewSourceId | null;
}) {
  const page = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = page.current;
    if (!container) return;
    const target = focus ? container.querySelector<HTMLElement>(`#${SECTION_OF[focus]}`) : null;
    // The masthead is the top of the brief, so an unfocused preview starts there.
    const top = target
      ? Math.max(0, target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 12)
      : 0;
    container.scrollTo({ top, behavior: "smooth" });
  }, [focus, briefing]);

  const noop = () => {};

  return (
    <aside className="brew-preview" aria-label="Preview of tomorrow's Morning Brew">
      <header className="brew-preview__head">
        <span className="brew-preview__eyebrow">
          <i className="brew-preview__pulse" aria-hidden="true" /> Live preview
        </span>
        <span className="brew-preview__meta">
          ~{briefing.readTimeMinutes} min · {briefing.deliveryLabel} AM
        </span>
      </header>

      <div className="brew-preview__frame">
        <div className="bp-chrome" aria-hidden="true">
          <i />
          <span>Morning Brew</span>
        </div>

        <div className="bp-page" ref={page}>
          {briefing.kpis.length ||
          briefing.insights.length ||
          briefing.news.length ||
          briefing.deadlines.length ||
          briefing.requests.length ||
          briefing.priorities.length ? (
            <div className="bp-scale" inert aria-hidden="true">
              <MorningBrewDashboard
                briefing={briefing}
                preferences={preferences}
                staffName={staffName}
                navigate={noop}
                onOpenDetail={noop}
                onAskEdward={noop}
                onCustomize={noop}
                onManageConnections={noop}
              />
            </div>
          ) : (
            <p className="bp-empty">
              Nothing is switched on yet. Add a source and it appears here.
            </p>
          )}
        </div>
      </div>

      <p className="brew-preview__foot">
        This is the real page, shrunk down — not a mock-up of it.
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------- step two */

function DetailOption({
  source,
  level,
  selected,
  onSelect,
}: {
  source: BrewSourceDefinition;
  level: BrewDetailLevelId;
  selected: boolean;
  onSelect: () => void;
}) {
  const option = source.details[level];
  return (
    <button
      className={`brew-detail-option${selected ? " is-selected" : ""}`}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
    >
      <span className="brew-detail-option__head">
        <i className="brew-detail-option__radio" aria-hidden="true" />
        <i className={`brew-detail-option__icon is-${level}`} aria-hidden="true">
          <Icon name={LEVEL_ICON[level]} size={14} />
        </i>
        <span>
          <b>{option.title}</b>
          <small>{option.kicker}</small>
        </span>
      </span>
      <p>{option.description}</p>
      <SourcePreview sourceId={source.id} level={level} />
      <span className={`brew-detail-option__tag is-${level}`}>{option.tag}</span>
    </button>
  );
}

function SourceCard({
  source,
  index,
  preference,
  expanded,
  onExpand,
  onChange,
}: {
  source: BrewSourceDefinition;
  index: number;
  preference: BrewSourcePreference;
  expanded: boolean;
  onExpand: () => void;
  onChange: (patch: Partial<BrewSourcePreference>) => void;
}) {
  const open = expanded && preference.enabled;
  return (
    <li className={`brew-source-card${preference.enabled ? " is-on" : ""}${open ? " is-open" : ""}`}>
      <div className="brew-source-card__row">
        <button
          className="brew-source-card__open"
          type="button"
          onClick={() => preference.enabled && onExpand()}
          aria-expanded={open}
          disabled={!preference.enabled}
        >
          <SourceMark source={source} />
          <span>
            <strong>
              {index}. {source.title}
            </strong>
            <small>{source.kicker}</small>
          </span>
        </button>
        <span className="brew-source-card__controls">
          <button
            className="brew-toggle"
            type="button"
            role="switch"
            aria-checked={preference.enabled}
            aria-label={`${preference.enabled ? "Remove" : "Add"} ${source.title}`}
            onClick={() => {
              const enabled = !preference.enabled;
              onChange({ enabled });
              if (enabled) onExpand();
            }}
          >
            <i className="brew-toggle__switch" aria-hidden="true" />
          </button>
          <i className="brew-source-card__chevron" aria-hidden="true">
            <Icon name="chevron" size={14} />
          </i>
        </span>
      </div>

      {open ? (
        <div className="brew-source-card__body">
          <p className="brew-source-card__blurb">{source.description}</p>
          <p className="brew-source-card__ask">How much context would you like?</p>
          <div
            className="brew-detail-options"
            role="radiogroup"
            aria-label={`${source.title} detail level`}
          >
            {BREW_DETAIL_LEVELS.map((level) => (
              <DetailOption
                source={source}
                level={level}
                selected={preference.detail === level}
                onSelect={() => onChange({ detail: level })}
                key={level}
              />
            ))}
          </div>
          <p className="brew-source-card__note">
            <Icon name="info" size={12} /> You will see this level of detail on every{" "}
            {source.title} card, and it reads {source.source.toLowerCase()}.
          </p>
        </div>
      ) : null}
    </li>
  );
}

/* --------------------------------------------------------------------- screen */

export function MorningBrewOnboarding({
  step,
  direction,
  firstName,
  staffName,
  draft,
  preview,
  customizing,
  onToggleTopic,
  onChangeSource,
  onStep,
  onComplete,
  onCancel,
}: {
  step: OnboardingStep;
  /** 1 when moving forward, -1 when going back; drives the slide direction. */
  direction: 1 | -1;
  firstName: string;
  /** The reader's full name; the miniature renders the real masthead. */
  staffName: string;
  draft: OnboardingDraft;
  /** Briefing built from the in-progress draft, for the live miniature. */
  preview: BrewBriefing;
  customizing: boolean;
  onToggleTopic: (topic: BrewTopicId) => void;
  onChangeSource: (id: BrewSourceId, patch: Partial<BrewSourcePreference>) => void;
  onStep: (step: OnboardingStep) => void;
  onComplete: () => void;
  onCancel?: () => void;
}) {
  const [expanded, setExpanded] = useState<BrewSourceId>("pulse");
  // The miniature is the real dashboard, so it needs real preferences rather
  // than the draft alone.
  const previewPreferences: BrewPreferences = useMemo(
    () => ({
      ...DEFAULT_BREW_PREFERENCES,
      ...draft,
      version: 6,
      updatedAt: "",
      onboardingComplete: false,
    }),
    [draft],
  );
  const enabledCount = BREW_SOURCES.filter((source) => draft.sources[source.id].enabled).length;
  const focus = step === 2 && draft.sources[expanded].enabled ? expanded : null;

  const heading =
    step === 1 ? "What do you want to catch up on each morning?" : "Nice. What should we bring you?";

  const lede =
    step === 1
      ? "We picked a few based on what you look after. Add anything else you keep half an eye on, and drop what you don't. Nothing here is permanent."
      : "Each of these is a slice of your live enrollment data. Switch off anything you don't want in front of you and the section simply won't appear.";

  return (
    <section className="brew-setup" aria-labelledby="brew-setup-title">
      <header className="brew-setup__header">
        <div className="brew-setup__intro">
          <span className="brew-setup__badge">
            <span className="brew-setup__cup" aria-hidden="true" />
            Morning Brew
          </span>
          <p className="brew-setup__welcome">Step {step} of 2</p>
          <h1 id="brew-setup-title">{heading}</h1>
          <p className="brew-setup__lede">{lede}</p>
        </div>
        <ol className="brew-setup__steps" aria-label={`Step ${step} of 2`}>
          {([1, 2] as OnboardingStep[]).map((value) => (
            <li className={value === step ? "is-active" : value < step ? "is-done" : ""} key={value}>
              <span aria-hidden="true">{value < step ? "✓" : value}</span>
              <small>{STEP_LABELS[value]}</small>
            </li>
          ))}
        </ol>
      </header>

      <div className="brew-setup__body">
        <div className="brew-setup__stage" data-direction={direction} key={step}>
          {step === 1 ? (
            <>
              <p className="brew-setup__role">
                Signed in as <strong>{firstName}</strong> · {preview.students} students on your
                roster
              </p>
              <div className="brew-topic-grid">
                {BREW_TOPICS.map((topic) => {
                  const selected = draft.topics.includes(topic.id);
                  return (
                    <button
                      className={`brew-topic-card brew-topic-card--${topic.accent}${selected ? " is-selected" : ""}`}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onToggleTopic(topic.id)}
                      key={topic.id}
                    >
                      <span className="brew-topic-card__icon" aria-hidden="true">
                        {topic.icon}
                      </span>
                      <span className="brew-topic-card__check" aria-hidden="true">
                        {selected ? "✓" : "+"}
                      </span>
                      <strong>{topic.title}</strong>
                      <p>{topic.blurb}</p>
                      <small className="brew-topic-card__preview">{topic.preview}</small>
                      <span
                        className={
                          topic.recommended
                            ? "brew-topic-card__flag"
                            : "brew-topic-card__flag brew-topic-card__flag--muted"
                        }
                      >
                        {topic.recommended
                          ? `Picked for you · ${topic.recommendation}`
                          : topic.recommendation}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="brew-sources__label">Sources</p>
              <ol className="brew-source-list">
                {BREW_SOURCES.map((source, position) => (
                  <SourceCard
                    source={source}
                    index={position + 1}
                    preference={draft.sources[source.id]}
                    expanded={expanded === source.id}
                    onExpand={() => setExpanded(source.id)}
                    onChange={(patch) => onChangeSource(source.id, patch)}
                    key={source.id}
                  />
                ))}
              </ol>
              <aside className="brew-privacy-note">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>Every section reads your live records</strong>
                  <p>
                    Only your choice of sections is remembered, and it stays in this browser.
                    Higher Education News is the one outside feed, and every story is credited and
                    linked.
                  </p>
                </div>
              </aside>
            </>
          )}
        </div>

        <BrewLivePreview
          briefing={preview}
          preferences={previewPreferences}
          staffName={staffName}
          focus={focus}
        />
      </div>

      <footer className="brew-setup__footer">
        <div>
          <strong>
            {step === 1
              ? draft.topics.length
                ? `${draft.topics.length} ${draft.topics.length === 1 ? "topic" : "topics"} in your morning`
                : "Nothing picked yet"
              : `${enabledCount} of ${BREW_SOURCES.length} sources switched on`}
          </strong>
          <span>
            {step === 1
              ? "Pick at least one. You can change this any morning."
              : "All optional — your read still works without any of them."}
          </span>
        </div>
        <div className="brew-setup__actions">
          {step > 1 ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => onStep(1)}
            >
              Back
            </button>
          ) : customizing && onCancel ? (
            <button className="button button--secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          <button
            className="button button--primary brew-build-button"
            type="button"
            disabled={!draft.topics.length}
            onClick={() => (step === 2 ? onComplete() : onStep(2))}
          >
            {step === 2 ? (customizing ? "Save it" : "Make my Morning Brew") : "Looks good"}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </footer>
    </section>
  );
}
