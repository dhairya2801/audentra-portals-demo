import { MORNING_BREW_CONNECTORS, MORNING_BREW_TOPICS } from "./data";
import type { MorningBrewConnectorId, MorningBrewTopicId } from "./types";

export function MorningBrewOnboarding({
  step,
  topics,
  connectors,
  customizing,
  onToggleTopic,
  onToggleConnector,
  onNext,
  onBack,
  onComplete,
  onCancel,
}: {
  step: 1 | 2;
  topics: MorningBrewTopicId[];
  connectors: Record<MorningBrewConnectorId, boolean>;
  customizing: boolean;
  onToggleTopic: (topic: MorningBrewTopicId) => void;
  onToggleConnector: (connector: MorningBrewConnectorId) => void;
  onNext: () => void;
  onBack: () => void;
  onComplete: () => void;
  onCancel?: () => void;
}) {
  return (
    <section className="brew-onboarding" aria-labelledby="brew-onboarding-title">
      <div className="brew-a-motif" aria-hidden="true">A</div>
      <header className="brew-onboarding__header">
        <span className="brew-edition-label">Morning Brew · Personal setup</span>
        <div className="brew-stepper" aria-label={`Step ${step} of 2`}>
          <span className={step >= 1 ? "is-active" : ""}>1</span><i /><span className={step >= 2 ? "is-active" : ""}>2</span>
        </div>
        <p className="eyebrow">Step {step} of 2</p>
        <h1 id="brew-onboarding-title">
          {step === 1 ? "What do you want to know every morning?" : "Connect your context"}
        </h1>
        <p>
          {step === 1
            ? "Choose the broad areas that deserve a place in your executive read. Audentra will still surface material exceptions."
            : "Optional demo connections make the briefing feel like your day—not another dashboard. No external account is contacted."}
        </p>
      </header>

      {step === 1 ? (
        <div className="brew-interest-grid brew-interest-grid--broad">
          {MORNING_BREW_TOPICS.map((topic) => {
            const selected = topics.includes(topic.id);
            return (
              <button className={`brew-interest-card brew-interest-card--${topic.accent}${selected ? " is-selected" : ""}`} type="button" aria-pressed={selected} onClick={() => onToggleTopic(topic.id)} key={topic.id}>
                <span className="brew-topic-icon" aria-hidden="true">{topic.icon}</span>
                <span className="brew-interest-card__check" aria-hidden="true">{selected ? "✓" : "+"}</span>
                <strong>{topic.title}</strong><small>{topic.description}</small>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="brew-connector-grid">
          {MORNING_BREW_CONNECTORS.map((connector) => {
            const connected = connectors[connector.id];
            return (
              <article className={connected ? "brew-connector-card is-connected" : "brew-connector-card"} key={connector.id}>
                <span className={`brew-connector-logo brew-connector-logo--${connector.id}`}>{connector.icon}</span>
                <div><strong>{connector.title}</strong><p>{connector.description}</p><small>{connector.optional ? "Optional · Mock integration" : "Included with your workspace"}</small></div>
                <button type="button" aria-pressed={connected} disabled={!connector.optional} onClick={() => connector.optional && onToggleConnector(connector.id)}>
                  {connected ? "Connected" : "Connect"}
                </button>
              </article>
            );
          })}
          <aside className="brew-privacy-note"><span>✓</span><div><strong>Presentation-safe connections</strong><p>Email and calendar content is believable synthetic data stored only as a connection preference in this browser.</p></div></aside>
        </div>
      )}

      <footer className="brew-onboarding__footer">
        <div><strong>{step === 1 ? `${topics.length} ${topics.length === 1 ? "area" : "areas"} selected` : "You stay in control"}</strong><span>You can customize this at any time.</span></div>
        <div className="brew-onboarding__actions">
          {step === 2 ? <button className="button button--secondary" type="button" onClick={onBack}>Back</button> : customizing && onCancel ? <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button> : null}
          <button className="button button--primary brew-build-button" type="button" disabled={!topics.length} onClick={step === 1 ? onNext : onComplete}>
            {step === 1 ? "Continue" : customizing ? "Save Morning Brew" : "Build my Morning Brew"}<span aria-hidden="true">→</span>
          </button>
        </div>
      </footer>
    </section>
  );
}
