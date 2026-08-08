import {
  BREW_DELIVERY_TIMES,
  BREW_DEPTH_OPTIONS,
  BREW_INBOX_DEPTHS,
  BREW_INCLUDES,
  BREW_INSIGHT_DETAILS,
  BREW_PULSE_DEFAULTS,
  BREW_READER_ROLE,
  BREW_READING_SOURCES,
  BREW_TOPICS,
  BREW_TONE_OPTIONS,
} from "./catalog";
import type {
  BrewDeliveryTime,
  BrewDepthId,
  BrewIncludeId,
  BrewInboxDepthId,
  BrewInsightDetailId,
  BrewPulseDefault,
  BrewTopicId,
  BrewToneId,
} from "./types";

export type OnboardingStep = 1 | 2 | 3;

export interface OnboardingDraft {
  topics: BrewTopicId[];
  include: Record<BrewIncludeId, boolean>;
  depth: BrewDepthId;
  tone: BrewToneId;
  deliveryTime: BrewDeliveryTime;
  inboxDepth: BrewInboxDepthId;
  draftReplies: boolean;
  calendarPrep: boolean;
  pulseDefault: BrewPulseDefault;
  insightDetail: BrewInsightDetailId;
  readingSources: string[];
}

function Choice({
  selected,
  onClick,
  title,
  caption,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  caption?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      className={selected ? "brew-choice is-selected" : "brew-choice"}
      type="button"
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="brew-choice__tick" aria-hidden="true" />
      <strong>{title}</strong>
      {caption ? <small>{caption}</small> : null}
      {children}
    </button>
  );
}

function Switch({
  on,
  onClick,
  title,
  caption,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  caption: string;
}) {
  return (
    <button className={on ? "brew-switch is-on" : "brew-switch"} type="button" role="switch" aria-checked={on} onClick={onClick}>
      <span>
        <strong>{title}</strong>
        <small>{caption}</small>
      </span>
      <i className="brew-toggle__switch" aria-hidden="true" />
    </button>
  );
}

export function MorningBrewOnboarding({
  step,
  direction,
  firstName,
  draft,
  customizing,
  onToggleTopic,
  onToggleInclude,
  onToggleSource,
  onChange,
  onStep,
  onComplete,
  onCancel,
}: {
  step: OnboardingStep;
  /** 1 when moving forward, -1 when going back; drives the slide direction. */
  direction: 1 | -1;
  firstName: string;
  draft: OnboardingDraft;
  customizing: boolean;
  onToggleTopic: (topic: BrewTopicId) => void;
  onToggleInclude: (include: BrewIncludeId) => void;
  onToggleSource: (source: string) => void;
  onChange: (patch: Partial<OnboardingDraft>) => void;
  onStep: (step: OnboardingStep) => void;
  onComplete: () => void;
  onCancel?: () => void;
}) {
  const includedCount = BREW_INCLUDES.filter((include) => draft.include[include.id]).length;
  const depth = BREW_DEPTH_OPTIONS.find((option) => option.id === draft.depth);

  const heading =
    step === 1
      ? "What do you want to catch up on each morning?"
      : step === 2
        ? "Nice. What should we bring you?"
        : "Last thing — how do you like it?";

  const lede =
    step === 1
      ? "We picked a few based on what you look after. Add anything else you keep half an eye on, and drop what you don't. Nothing here is permanent."
      : step === 2
        ? "Your morning read gets a lot better when it knows about the rest of your day. Everything below is a polished demo — no real account is touched, and nothing leaves this browser."
        : "Just a few quick calls on what you picked. Sensible answers are already filled in, so you can hit go whenever you like.";

  return (
    <section className="brew-setup" aria-labelledby="brew-setup-title">
      <header className="brew-setup__header">
        <div className="brew-setup__intro">
          <span className="brew-setup__badge">
            <span className="brew-setup__cup" aria-hidden="true" />
            Morning Brew
          </span>
          <p className="brew-setup__welcome">
            {step === 1 ? `Hey ${firstName} 👋` : step === 2 ? "Two of three" : "Almost done"}
          </p>
          <h1 id="brew-setup-title">{heading}</h1>
          <p className="brew-setup__lede">{lede}</p>
        </div>
        <ol className="brew-setup__steps" aria-label={`Step ${step} of 3`}>
          {([1, 2, 3] as OnboardingStep[]).map((value) => (
            <li className={value === step ? "is-active" : value < step ? "is-done" : ""} key={value}>
              <span aria-hidden="true">{value < step ? "✓" : value}</span>
              <small>{value === 1 ? "Topics" : value === 2 ? "What's in it" : "Your style"}</small>
            </li>
          ))}
        </ol>
      </header>

      <div className="brew-setup__stage" data-direction={direction} key={step}>
        {step === 1 ? (
          <>
            <p className="brew-setup__role">
              Signed in as <strong>{firstName}</strong> · {BREW_READER_ROLE}
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
                      {topic.recommended ? `Picked for you · ${topic.recommendation}` : topic.recommendation}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="brew-include-grid">
              {BREW_INCLUDES.map((include) => {
                const on = draft.include[include.id];
                return (
                  <button
                    className={`brew-include-card brew-include-card--${include.accent}${on ? " is-on" : ""}`}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => onToggleInclude(include.id)}
                    key={include.id}
                  >
                    <span className="brew-include-card__icon" aria-hidden="true">
                      {include.icon}
                    </span>
                    <span className="brew-include-card__body">
                      <strong>{include.title}</strong>
                      <p>{include.blurb}</p>
                      <small>{include.source}</small>
                    </span>
                    <i className="brew-toggle__switch" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            <aside className="brew-privacy-note">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>Nothing here leaves your browser</strong>
                <p>
                  The mail and calendar you&rsquo;ll see are believable stand-ins written for this demo. We only
                  remember which switches you flipped.
                </p>
              </div>
            </aside>
          </>
        ) : null}

        {step === 3 ? (
          <div className="brew-format">
            <fieldset className="brew-format__group">
              <legend>How long should it be?</legend>
              <div className="brew-choice-row">
                {BREW_DEPTH_OPTIONS.map((option) => (
                  <Choice
                    selected={draft.depth === option.id}
                    onClick={() => onChange({ depth: option.id })}
                    title={option.title}
                    caption={option.readTime}
                    key={option.id}
                  >
                    <p>{option.description}</p>
                  </Choice>
                ))}
              </div>
            </fieldset>

            {draft.include.inbox ? (
              <fieldset className="brew-format__group">
                <legend>
                  <span className="brew-format__tag">Your inbox</span>
                  How much of it do you want?
                </legend>
                <div className="brew-choice-row">
                  {BREW_INBOX_DEPTHS.map((option) => (
                    <Choice
                      selected={draft.inboxDepth === option.id}
                      onClick={() => onChange({ inboxDepth: option.id })}
                      title={option.title}
                      caption={option.caption}
                      key={option.id}
                    />
                  ))}
                </div>
                <Switch
                  on={draft.draftReplies}
                  onClick={() => onChange({ draftReplies: !draft.draftReplies })}
                  title="Let Edward write the first draft"
                  caption="A reply waiting on each message, ready for you to edit or throw away."
                />
              </fieldset>
            ) : null}

            {draft.include.calendar ? (
              <fieldset className="brew-format__group">
                <legend>
                  <span className="brew-format__tag">Your calendar</span>
                  Anything you want alongside it?
                </legend>
                <Switch
                  on={draft.calendarPrep}
                  onClick={() => onChange({ calendarPrep: !draft.calendarPrep })}
                  title="Add a prep line to the meetings that matter"
                  caption="One sentence on what you'd want to know before you walk in."
                />
              </fieldset>
            ) : null}

            {draft.include.numbers ? (
              <fieldset className="brew-format__group">
                <legend>
                  <span className="brew-format__tag">Your numbers</span>
                  Which comparison do you think in?
                </legend>
                <div className="brew-pill-row">
                  {BREW_PULSE_DEFAULTS.map((option) => (
                    <button
                      className={draft.pulseDefault === option.id ? "brew-pill is-selected" : "brew-pill"}
                      type="button"
                      aria-pressed={draft.pulseDefault === option.id}
                      onClick={() => onChange({ pulseDefault: option.id })}
                      key={option.id}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.caption}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {draft.include.signals ? (
              <fieldset className="brew-format__group">
                <legend>
                  <span className="brew-format__tag">What we spot</span>
                  How much should we show?
                </legend>
                <div className="brew-choice-row">
                  {BREW_INSIGHT_DETAILS.map((option) => (
                    <Choice
                      selected={draft.insightDetail === option.id}
                      onClick={() => onChange({ insightDetail: option.id })}
                      title={option.title}
                      caption={option.caption}
                      key={option.id}
                    />
                  ))}
                </div>
              </fieldset>
            ) : null}

            {draft.include.headlines ? (
              <fieldset className="brew-format__group">
                <legend>
                  <span className="brew-format__tag">Your reading</span>
                  Where should we read from?
                </legend>
                <div className="brew-source-row">
                  {BREW_READING_SOURCES.map((source) => {
                    const on = draft.readingSources.includes(source.id);
                    return (
                      <button
                        className={on ? "brew-source-chip is-on" : "brew-source-chip"}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onToggleSource(source.id)}
                        key={source.id}
                      >
                        <i aria-hidden="true">{on ? "✓" : "+"}</i>
                        <span>
                          <strong>{source.label}</strong>
                          <small>{source.kind}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            <div className="brew-format__split">
              <fieldset className="brew-format__group">
                <legend>When do you want it?</legend>
                <div className="brew-pill-row">
                  {BREW_DELIVERY_TIMES.map((time) => (
                    <button
                      className={draft.deliveryTime === time.id ? "brew-pill is-selected" : "brew-pill"}
                      type="button"
                      aria-pressed={draft.deliveryTime === time.id}
                      onClick={() => onChange({ deliveryTime: time.id })}
                      key={time.id}
                    >
                      <strong>{time.label}</strong>
                      <small>{time.caption}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="brew-format__group">
                <legend>How should we write it?</legend>
                <div className="brew-choice-row brew-choice-row--tone">
                  {BREW_TONE_OPTIONS.map((option) => (
                    <Choice
                      selected={draft.tone === option.id}
                      onClick={() => onChange({ tone: option.id })}
                      title={option.title}
                      key={option.id}
                    >
                      <p>{option.description}</p>
                      <q>{option.sample}</q>
                    </Choice>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="brew-setup__footer">
        <div>
          <strong>
            {step === 1
              ? draft.topics.length
                ? `${draft.topics.length} ${draft.topics.length === 1 ? "topic" : "topics"} in your morning`
                : "Nothing picked yet"
              : step === 2
                ? `${includedCount} of ${BREW_INCLUDES.length} switched on`
                : `${depth?.title} · ${depth?.readTime}`}
          </strong>
          <span>
            {step === 1
              ? "Pick at least one. You can change this any morning."
              : step === 2
                ? "All optional — your read still works without any of them."
                : `Ready for you every weekday at ${draft.deliveryTime.replace(/^0/, "")} AM.`}
          </span>
        </div>
        <div className="brew-setup__actions">
          {step > 1 ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => onStep((step - 1) as OnboardingStep)}
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
            onClick={() => (step === 3 ? onComplete() : onStep((step + 1) as OnboardingStep))}
          >
            {step === 3 ? (customizing ? "Save it" : "Make my Morning Brew") : "Looks good"}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </footer>
    </section>
  );
}
