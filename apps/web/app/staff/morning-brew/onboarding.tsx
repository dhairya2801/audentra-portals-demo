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

/** One question: a short label on the left, a compact control on the right. */
function Ask({
  label,
  hint,
  icon,
  stack,
  children,
}: {
  label: string;
  hint?: string;
  icon?: string;
  stack?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={stack ? "brew-ask brew-ask--stack" : "brew-ask"}>
      <span className="brew-ask__label">
        {icon ? (
          <i className="brew-ask__icon" aria-hidden="true">
            {icon}
          </i>
        ) : null}
        <span>
          <strong>{label}</strong>
          {hint ? <small>{hint}</small> : null}
        </span>
      </span>
      <span className="brew-ask__control">{children}</span>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <span className="brew-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          className={value === option.id ? "is-selected" : ""}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          key={option.id}
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}

function SwitchRow({
  on,
  onClick,
  icon,
  title,
  caption,
  sub,
}: {
  on: boolean;
  onClick: () => void;
  icon?: string;
  title: string;
  caption: string;
  /** Renders indented, as a follow-on to the question directly above it. */
  sub?: boolean;
}) {
  const className = ["brew-ask", "brew-ask--switch", sub ? "brew-ask--sub" : "", on ? "is-on" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={className} type="button" role="switch" aria-checked={on} onClick={onClick}>
      <span className="brew-ask__label">
        {icon ? (
          <i className="brew-ask__icon" aria-hidden="true">
            {icon}
          </i>
        ) : null}
        <span>
          <strong>{title}</strong>
          <small>{caption}</small>
        </span>
      </span>
      <i className="brew-toggle__switch" aria-hidden="true" />
    </button>
  );
}

const iconFor = (id: BrewIncludeId) => BREW_INCLUDES.find((include) => include.id === id)?.icon ?? "•";

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
  const depth = BREW_DEPTH_OPTIONS.find((option) => option.id === draft.depth) ?? BREW_DEPTH_OPTIONS[1];
  const tone = BREW_TONE_OPTIONS.find((option) => option.id === draft.tone) ?? BREW_TONE_OPTIONS[0];
  const { inbox, calendar, numbers, signals, movements, headlines } = draft.include;
  const hasFollowUps = inbox || calendar || numbers || signals || headlines;

  const emailCount = draft.inboxDepth === "urgent" ? 2 : draft.inboxDepth === "everything" ? 5 : 4;
  const meetingCount = draft.depth === "headlines" ? 3 : 5;
  const comparison = BREW_PULSE_DEFAULTS.find((option) => option.id === draft.pulseDefault)?.label ?? "Cycle through";

  /* What tomorrow's edition will actually contain, given the answers so far. */
  const preview: string[] = [];
  if (signals) preview.push(`${depth.storyCount} signals, ${draft.insightDetail === "headline" ? "headlines only" : draft.insightDetail === "impact" ? "with impact" : "with impact and next steps"}`);
  if (numbers) preview.push(`Your numbers board, opening on ${comparison.toLowerCase()}`);
  if (movements) preview.push("What moved since yesterday");
  if (inbox) preview.push(`${emailCount} messages${draft.draftReplies ? ", each with a draft reply" : ""}`);
  if (calendar) preview.push(`${meetingCount} meetings${draft.calendarPrep ? ", key ones with prep notes" : ""}`);
  if (headlines) preview.push(`Stories from ${draft.readingSources.length} ${draft.readingSources.length === 1 ? "source" : "sources"}`);

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
        : "A few quick calls, then you're done. Everything is already answered sensibly.";

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
            <div className="brew-format__main">
              <section className="brew-ask-card">
                <h2>Your read</h2>
                <Ask label="How long should it be?" hint={depth.readTime}>
                  <Segmented
                    label="Briefing length"
                    value={draft.depth}
                    onChange={(id) => onChange({ depth: id })}
                    options={BREW_DEPTH_OPTIONS.map((option) => ({ id: option.id, label: option.title }))}
                  />
                </Ask>
                <Ask label="How should we write it?" hint={tone.description}>
                  <Segmented
                    label="Writing style"
                    value={draft.tone}
                    onChange={(id) => onChange({ tone: id })}
                    options={BREW_TONE_OPTIONS.map((option) => ({ id: option.id, label: option.title }))}
                  />
                </Ask>
                <Ask label="When do you want it?" hint="Every weekday">
                  <Segmented
                    label="Delivery time"
                    value={draft.deliveryTime}
                    onChange={(id) => onChange({ deliveryTime: id })}
                    options={BREW_DELIVERY_TIMES.map((time) => ({ id: time.id, label: time.label }))}
                  />
                </Ask>
              </section>

              {hasFollowUps ? (
                <section className="brew-ask-card">
                  <h2>About the bits you picked</h2>

                  {inbox ? (
                    <>
                      <Ask label="How much of your inbox?" icon={iconFor("inbox")}>
                        <Segmented
                          label="Inbox depth"
                          value={draft.inboxDepth}
                          onChange={(id) => onChange({ inboxDepth: id })}
                          options={BREW_INBOX_DEPTHS.map((option) => ({ id: option.id, label: option.title }))}
                        />
                      </Ask>
                      <SwitchRow
                        sub
                        on={draft.draftReplies}
                        onClick={() => onChange({ draftReplies: !draft.draftReplies })}
                        title="Edward drafts a reply for each"
                        caption="Ready for you to edit or throw away"
                      />
                    </>
                  ) : null}

                  {calendar ? (
                    <SwitchRow
                      on={draft.calendarPrep}
                      onClick={() => onChange({ calendarPrep: !draft.calendarPrep })}
                      icon={iconFor("calendar")}
                      title="Prep note on the meetings that matter"
                      caption="One line on what to know before you walk in"
                    />
                  ) : null}

                  {numbers ? (
                    <Ask label="Which comparison do you think in?" icon={iconFor("numbers")}>
                      <Segmented
                        label="Default comparison"
                        value={draft.pulseDefault}
                        onChange={(id) => onChange({ pulseDefault: id })}
                        options={BREW_PULSE_DEFAULTS.map((option) => ({ id: option.id, label: option.label }))}
                      />
                    </Ask>
                  ) : null}

                  {signals ? (
                    <Ask label="How much detail on what we spot?" icon={iconFor("signals")}>
                      <Segmented
                        label="Signal detail"
                        value={draft.insightDetail}
                        onChange={(id) => onChange({ insightDetail: id })}
                        options={BREW_INSIGHT_DETAILS.map((option) => ({ id: option.id, label: option.title }))}
                      />
                    </Ask>
                  ) : null}

                  {headlines ? (
                    <Ask
                      label="Where should we read from?"
                      icon={iconFor("headlines")}
                      hint={`${draft.readingSources.length} of ${BREW_READING_SOURCES.length} selected`}
                      stack
                    >
                      <span className="brew-source-row">
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
                              {source.label}
                            </button>
                          );
                        })}
                      </span>
                    </Ask>
                  ) : null}
                </section>
              ) : null}
            </div>

            <aside className="brew-preview" aria-label="What tomorrow's brief will contain">
              <p className="brew-preview__eyebrow">Tomorrow morning</p>
              <strong className="brew-preview__time">{depth.readTime}</strong>
              <small className="brew-preview__when">Ready at {draft.deliveryTime.replace(/^0/, "")} AM</small>
              {preview.length ? (
                <ul>
                  {preview.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="brew-preview__empty">
                  Nothing switched on yet. Step back and pick what you&rsquo;d like in it.
                </p>
              )}
              <q>{tone.sample}</q>
            </aside>
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
                : `${depth.title} · ${depth.readTime}`}
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
