import {
  BREW_CONNECTORS,
  BREW_DELIVERY_TIMES,
  BREW_DEPTH_OPTIONS,
  BREW_READER_ROLE,
  BREW_SECTION_OPTIONS,
  BREW_TEAMS,
  BREW_TONE_OPTIONS,
} from "./catalog";
import type {
  BrewConnectorId,
  BrewDeliveryTime,
  BrewDepthId,
  BrewSectionId,
  BrewTeamId,
  BrewToneId,
} from "./types";

export type OnboardingStep = 1 | 2 | 3;

export interface OnboardingDraft {
  teams: BrewTeamId[];
  connectors: Record<BrewConnectorId, boolean>;
  depth: BrewDepthId;
  tone: BrewToneId;
  sections: Record<BrewSectionId, boolean>;
  deliveryTime: BrewDeliveryTime;
}

const STEP_TITLES: Record<OnboardingStep, string> = {
  1: "Which teams should your brief follow?",
  2: "Connect what your morning already runs on",
  3: "How would you like it written?",
};

export function MorningBrewOnboarding({
  step,
  firstName,
  draft,
  customizing,
  onToggleTeam,
  onToggleConnector,
  onChange,
  onToggleSection,
  onStep,
  onComplete,
  onCancel,
}: {
  step: OnboardingStep;
  firstName: string;
  draft: OnboardingDraft;
  customizing: boolean;
  onToggleTeam: (team: BrewTeamId) => void;
  onToggleConnector: (connector: BrewConnectorId) => void;
  onChange: (patch: Partial<OnboardingDraft>) => void;
  onToggleSection: (section: BrewSectionId) => void;
  onStep: (step: OnboardingStep) => void;
  onComplete: () => void;
  onCancel?: () => void;
}) {
  const connectedCount = BREW_CONNECTORS.filter((connector) => draft.connectors[connector.id]).length;
  const sectionCount = BREW_SECTION_OPTIONS.filter((section) => draft.sections[section.id]).length;

  return (
    <section className="brew-setup" aria-labelledby="brew-setup-title">
      <header className="brew-setup__header">
        <div className="brew-setup__intro">
          <span className="brew-setup__badge">
            <span className="brew-setup__cup" aria-hidden="true" />
            Morning Brew
          </span>
          {step === 1 ? (
            <>
              <p className="brew-setup__welcome">Good morning, {firstName} 👋</p>
              <h1 id="brew-setup-title">{STEP_TITLES[1]}</h1>
              <p className="brew-setup__lede">
                You lead Financial Aid, so we have pre-selected the three teams whose numbers usually land on
                your desk first. Keep them, drop them, or add the ones you also watch — you can change this any
                morning.
              </p>
            </>
          ) : (
            <>
              <p className="brew-setup__welcome">Step {step} of 3</p>
              <h1 id="brew-setup-title">{STEP_TITLES[step]}</h1>
              <p className="brew-setup__lede">
                {step === 2
                  ? "Your brief gets noticeably sharper when it can see the day you actually have. These are polished demo connections — no external account is contacted and nothing leaves this browser."
                  : "Two people can follow the same teams and still want very different briefings. Set the length, the sections, and the voice."}
              </p>
            </>
          )}
        </div>
        <ol className="brew-setup__steps" aria-label={`Step ${step} of 3`}>
          {([1, 2, 3] as OnboardingStep[]).map((value) => (
            <li className={value === step ? "is-active" : value < step ? "is-done" : ""} key={value}>
              <span aria-hidden="true">{value < step ? "✓" : value}</span>
              <small>{value === 1 ? "Teams" : value === 2 ? "Connections" : "Format"}</small>
            </li>
          ))}
        </ol>
      </header>

      {step === 1 ? (
        <>
          <p className="brew-setup__role">
            Signed in as <strong>{firstName}</strong> · {BREW_READER_ROLE}
          </p>
          <div className="brew-team-grid">
            {BREW_TEAMS.map((team) => {
              const selected = draft.teams.includes(team.id);
              return (
                <button
                  className={`brew-team-card brew-team-card--${team.accent}${selected ? " is-selected" : ""}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onToggleTeam(team.id)}
                  key={team.id}
                >
                  <span className="brew-team-card__icon" aria-hidden="true">
                    {team.icon}
                  </span>
                  <span className="brew-team-card__check" aria-hidden="true">
                    {selected ? "✓" : "+"}
                  </span>
                  <strong>{team.title}</strong>
                  <small className="brew-team-card__lead">{team.lead}</small>
                  <p>{team.description}</p>
                  {team.recommended ? (
                    <span className="brew-team-card__flag">Suggested · {team.recommendation}</span>
                  ) : (
                    <span className="brew-team-card__flag brew-team-card__flag--muted">{team.recommendation}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <div className="brew-connector-grid">
          {BREW_CONNECTORS.map((connector) => {
            const connected = draft.connectors[connector.id];
            return (
              <article
                className={connected ? "brew-connector-card is-connected" : "brew-connector-card"}
                key={connector.id}
              >
                <span className={`brew-connector-logo brew-connector-logo--${connector.id}`} aria-hidden="true">
                  {connector.icon}
                </span>
                <div>
                  <strong>{connector.title}</strong>
                  <p>{connector.vendor}</p>
                  <small>{connector.description}</small>
                  <em>{connector.unlocks}</em>
                </div>
                <button
                  type="button"
                  aria-pressed={connected}
                  disabled={!connector.optional}
                  onClick={() => connector.optional && onToggleConnector(connector.id)}
                >
                  {connected ? (connector.optional ? "Connected" : "Always on") : "Connect"}
                </button>
              </article>
            );
          })}
          <aside className="brew-privacy-note">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Presentation-safe connections</strong>
              <p>
                Email and calendar content in this demo is believable synthetic data. Only the on/off choice is
                stored, and it stays in this browser.
              </p>
            </div>
          </aside>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="brew-format">
          <fieldset className="brew-format__group">
            <legend>How much do you want in front of you?</legend>
            <div className="brew-choice-row">
              {BREW_DEPTH_OPTIONS.map((option) => (
                <button
                  className={draft.depth === option.id ? "brew-choice is-selected" : "brew-choice"}
                  type="button"
                  aria-pressed={draft.depth === option.id}
                  onClick={() => onChange({ depth: option.id })}
                  key={option.id}
                >
                  <span className="brew-choice__tick" aria-hidden="true" />
                  <strong>{option.title}</strong>
                  <small>{option.readTime}</small>
                  <p>{option.description}</p>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="brew-format__group">
            <legend>What should we always include?</legend>
            <div className="brew-toggle-list">
              {BREW_SECTION_OPTIONS.map((section) => {
                const on = draft.sections[section.id];
                return (
                  <button
                    className={on ? "brew-toggle is-on" : "brew-toggle"}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => onToggleSection(section.id)}
                    key={section.id}
                  >
                    <span className="brew-toggle__icon" aria-hidden="true">
                      {section.icon}
                    </span>
                    <span>
                      <strong>{section.title}</strong>
                      <small>{section.description}</small>
                    </span>
                    <i className="brew-toggle__switch" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="brew-format__split">
            <fieldset className="brew-format__group">
              <legend>When should it be ready?</legend>
              <div className="brew-time-row">
                {BREW_DELIVERY_TIMES.map((time) => (
                  <button
                    className={draft.deliveryTime === time.id ? "brew-time is-selected" : "brew-time"}
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
              <legend>Writing style</legend>
              <div className="brew-choice-row brew-choice-row--tone">
                {BREW_TONE_OPTIONS.map((option) => (
                  <button
                    className={draft.tone === option.id ? "brew-choice is-selected" : "brew-choice"}
                    type="button"
                    aria-pressed={draft.tone === option.id}
                    onClick={() => onChange({ tone: option.id })}
                    key={option.id}
                  >
                    <span className="brew-choice__tick" aria-hidden="true" />
                    <strong>{option.title}</strong>
                    <p>{option.description}</p>
                    <q>{option.sample}</q>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
      ) : null}

      <footer className="brew-setup__footer">
        <div>
          <strong>
            {step === 1
              ? `${draft.teams.length} of ${BREW_TEAMS.length} teams selected`
              : step === 2
                ? `${connectedCount} of ${BREW_CONNECTORS.length} sources connected`
                : `${sectionCount} sections · ${BREW_DEPTH_OPTIONS.find((option) => option.id === draft.depth)?.readTime}`}
          </strong>
          <span>
            {step === 1
              ? "Pick at least one team. You can change this any morning."
              : step === 2
                ? "Optional. Your brief still works without them."
                : `Delivered every weekday at ${draft.deliveryTime.replace(/^0/, "")} AM ET.`}
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
            disabled={!draft.teams.length}
            onClick={() => (step === 3 ? onComplete() : onStep((step + 1) as OnboardingStep))}
          >
            {step === 3 ? (customizing ? "Save my Morning Brew" : "Build my Morning Brew") : "Continue"}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </footer>
    </section>
  );
}
