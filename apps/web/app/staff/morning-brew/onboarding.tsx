"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Icon from "../../design-system/Icon.jsx";
import { BREW_SOURCES, BREW_TOPICS } from "./catalog";
import { Glyph, OutlookMark } from "./glyphs";
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

/**
 * The tile that carries a source's glyph, in the list and in the preview.
 *
 * Email is the exception: its mark is Outlook's own square rather than a tinted
 * tile, because the row names the mailbox provider the reader has connected,
 * and a house-styled envelope would be us quietly claiming that connection as
 * ours.
 */
function SourceMark({ source, size = 18 }: { source: BrewSourceDefinition; size?: number }) {
  if (source.icon === "outlook") {
    return (
      <span className="brew-source-mark brew-source-mark--plain" aria-hidden="true">
        <OutlookMark size={size + 6} />
      </span>
    );
  }
  return (
    <span className={`brew-source-mark brew-source-mark--${source.accent}`} aria-hidden="true">
      <Glyph name={source.icon} size={size} />
    </span>
  );
}

/* --------------------------------------------------------------- live preview */

/** Which section of the brief a source produces, for the scroll-to on open. */
const SECTION_OF: Record<BrewSourceId, string> = {
  pulse: "brew-pulse-title",
  news: "brew-news-title",
  calendar: "meetings-title",
  email: "emails-title",
  actions: "priorities-title",
  intelligence: "brew-insights-title",
};

/** The miniature's scale. Stated once, because two places have to agree on it. */
const PREVIEW_SCALE = 1 / 3;

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
  focus,
}: {
  briefing: BrewBriefing;
  preferences: BrewPreferences;
  /** The source whose card is open; the miniature scrolls to its section. */
  focus: BrewSourceId | null;
}) {
  const page = useRef<HTMLDivElement | null>(null);
  const scaled = useRef<HTMLDivElement | null>(null);
  /**
   * `transform: scale()` paints smaller but still lays out at full size, so the
   * scroll container used to believe the miniature was three times taller than
   * it looked — the reader could scroll a page and a half past the end of the
   * brief into nothing. The wrapper is given the height the page actually
   * occupies once scaled, measured rather than guessed, so scrolling stops on
   * the last band.
   */
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);

  useEffect(() => {
    const node = scaled.current;
    if (!node) return;
    const measure = () => setScaledHeight(node.offsetHeight * PREVIEW_SCALE);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [briefing, preferences]);

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
    <aside className="brew-preview" aria-label="Preview of your Morning Brew">
      <header className="brew-preview__head">
        <span className="brew-preview__eyebrow">
          <i className="brew-preview__pulse" aria-hidden="true" /> Live preview
        </span>
        <span className="brew-preview__meta">
          <Glyph name="clock" size={14} /> {briefing.readTimeMinutes} min read
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
          briefing.meetings.length ||
          briefing.requests.length ||
          briefing.priorities.length ? (
            <div
              className="bp-scale-clip"
              style={scaledHeight ? { height: `${scaledHeight}px` } : undefined}
            >
              <div className="bp-scale" ref={scaled} inert aria-hidden="true">
                <MorningBrewDashboard
                  briefing={briefing}
                  preferences={preferences}
                  onOpenDetail={noop}
                  onAskEdward={noop}
                  onCustomize={noop}
                  onManageConnections={noop}
                />
              </div>
            </div>
          ) : (
            <p className="bp-empty">
              Nothing is switched on yet. Add a source and it appears here.
            </p>
          )}
        </div>
      </div>

      <p className="brew-preview__foot">
        Your selections shape this preview and your daily briefing.
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
  sample,
}: {
  source: BrewSourceDefinition;
  level: BrewDetailLevelId;
  selected: boolean;
  onSelect: () => void;
  sample: BrewBriefing;
}) {
  const option = source.details[level];
  return (
    <div
      className={`brew-detail-option${selected ? " is-selected" : ""}`}
      tabIndex={selected ? 0 : -1}
      onKeyDown={(event) => {
        if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); onSelect(); }
        if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          const options = [...event.currentTarget.parentElement!.querySelectorAll<HTMLElement>('[role="radio"]')];
          const next = options[(options.indexOf(event.currentTarget) + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length];
          next.focus(); next.click();
        }
      }}
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
      <SourcePreview sourceId={source.id} level={level} briefing={sample} />
      <span className={`brew-detail-option__tag is-${level}`}>{option.tag}</span>
    </div>
  );
}

function SourceCard({
  source,
  index,
  preference,
  expanded,
  onExpand,
  onChange,
  sample,
}: {
  source: BrewSourceDefinition;
  index: number;
  preference: BrewSourcePreference;
  expanded: boolean;
  onExpand: () => void;
  onChange: (patch: Partial<BrewSourcePreference>) => void;
  sample: BrewBriefing;
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
            style={{ "--brew-detail-columns": source.levels.length } as CSSProperties}
          >
            {source.levels.map((level) => (
              <DetailOption
                source={source}
                sample={sample}
                level={level}
                selected={preference.detail === level}
                onSelect={() => onChange({ detail: level })}
                key={level}
              />
            ))}
          </div>
          <p className="brew-source-card__note">
            <Icon name="info" size={12} /> You will see this level of detail on every{" "}
            {source.title} card. Open a card for its full detail.
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
  draft,
  preview,
  sample,
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
  /** The reader's full name; the miniature renders the real masthead. */
  draft: OnboardingDraft;
  /** Briefing built from the in-progress draft, for the live miniature. */
  preview: BrewBriefing;
  sample: BrewBriefing;
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
      version: 7,
      updatedAt: "",
      onboardingComplete: false,
    }),
    [draft],
  );
  const enabledCount = BREW_SOURCES.filter((source) => draft.sources[source.id].enabled).length;
  const focus = step === 2 && draft.sources[expanded].enabled ? expanded : null;

  const heading =
    step === 1 ? `${preview.reader.firstName}, start your morning with what matters.` : "Nice. What should we bring you?";

  const lede =
    step === 1
      ? `As ${preview.reader.role}, you need a clear view of the areas you lead. We’ve selected topics around your responsibilities. Choose what belongs in your morning.`
      : "Each of these is a slice of your live enrollment data. Switch off anything you don't want in front of you and the section simply won't appear.";

  return (
    <section className="brew-setup" data-step={step} aria-labelledby="brew-setup-title">
      <header className="brew-setup__header">
        <div className="brew-setup__intro">
          <span className="brew-setup__badge">
            <span className="brew-setup__cup" aria-hidden="true" />
            Morning Brew
          </span>
          <p className="brew-setup__welcome">Step {step} of 2</p>
          <h1 id="brew-setup-title">{heading}</h1>
          <p className="brew-setup__lede">{lede}</p>
          <div className="brew-setup__timing">
            <span role="status" aria-live="polite"><Glyph name="clock" size={18} /><span>Estimated read time<strong>{preview.readTimeMinutes} min</strong></span></span>
            <span><Glyph name="calendar" size={18} /><span>Daily briefing<strong>Generated at {preview.deliveryLabel} AM</strong></span></span>
          </div>
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
                        <Glyph name={topic.icon} size={18} />
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
                    sample={sample}
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
                  <strong>A preview of your daily briefing</strong>
                  <p>
                    This edition uses demo data. Your preferences are saved in this browser.
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
