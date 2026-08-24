"use client";

import type { HelpArticle, StudentHelpRequest, TenantContact } from "@vv/contracts";
import type { RefObject } from "react";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import { helpTopics, officeName, topicLabel } from "./help-logic";

/**
 * Where a question becomes a request — the reference's `AskCard`. The topic first, then where it
 * goes, then whatever the institution has already published about it, and only then the box to
 * write in. Success replaces the form with a receipt; failure leaves the form exactly as it was.
 */
export function HelpAskCard({
  topic,
  subject,
  message,
  sending,
  failed,
  receipt,
  guideOpen,
  guide,
  support,
  institution,
  onTopic,
  onSubject,
  onMessage,
  onToggleGuide,
  onSend,
  onSeeRequest,
  onAskAnother,
  formRef,
}: {
  topic: HelpArticle["category"] | null;
  subject: string;
  message: string;
  sending: boolean;
  failed: string | null;
  receipt: StudentHelpRequest | null;
  guideOpen: boolean;
  guide: HelpArticle | null;
  support: TenantContact;
  institution: string;
  onTopic: (topic: HelpArticle["category"]) => void;
  onSubject: (value: string) => void;
  onMessage: (value: string) => void;
  onToggleGuide: () => void;
  onSend: () => void;
  onSeeRequest: () => void;
  onAskAnother: () => void;
  formRef?: RefObject<HTMLFormElement | null>;
}) {
  const office = officeName(support);
  const ready = Boolean(topic && subject.trim() && message.trim());

  if (receipt) {
    return (
      <section className="section-card ask-card" aria-labelledby="ask-heading">
        <div className="status-heading">
          <span className="status-icon done" aria-hidden="true">
            <Icon name="send" size={20} />
          </span>
          <div>
            <h2 id="ask-heading">Ask an office</h2>
            <p>Sent</p>
          </div>
        </div>

        <div className="ask-receipt" role="status">
          <span className="receipt-tick" aria-hidden="true">
            <Icon name="check" size={24} />
          </span>
          <h3>{office} has your question.</h3>
          <p className="receipt-subject">“{receipt.subject}”</p>

          <p className="panel-label">What happens next</p>
          <ol className="receipt-next">
            <li>
              <strong>{office} reads it</strong>
              {support.hours ? `${support.hours}.` : `Topic: ${topicLabel(receipt.topicCode)}.`}
            </li>
            <li>
              <strong>A reply lands on this page</strong>
              If this one is going to take longer, the request will say so.
            </li>
            <li>
              <strong>Nothing is needed from you until it does</strong>
              You will see the answer here, with the request.
            </li>
          </ol>

          <div className="receipt-actions">
            <button className="primary-button" onClick={onSeeRequest}>
              See the request <Icon name="arrow" size={16} />
            </button>
            <button className="secondary-button" onClick={onAskAnother}>
              Ask something else
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section-card ask-card" aria-labelledby="ask-heading">
      <div className="status-heading">
        <span className="status-icon accent" aria-hidden="true">
          <Icon name="pen" size={20} />
        </span>
        <div>
          <h2 id="ask-heading">Ask an office</h2>
          <p>When a step needs a decision</p>
        </div>
      </div>

      <form
        className="ask-form"
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !sending) onSend();
        }}
      >
        <fieldset className="ask-step">
          <legend>What is it about?</legend>
          <div className="filter-chips">
            {helpTopics.map((item) => (
              <button
                key={item.id}
                type="button"
                className={topic === item.id ? "selected" : ""}
                aria-pressed={topic === item.id}
                onClick={() => onTopic(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        {topic && (
          <div className="ask-route">
            <span className="route-icon" aria-hidden="true">
              <Icon name="shield" size={18} />
            </span>
            <div>
              <span className="panel-label">This goes to</span>
              <strong>{office}</strong>
              <p>
                {institution}’s enrollment team reads it and the answer lands on this page.
              </p>
              {(support.hours || support.email) && (
                <p className="route-meta">
                  {support.hours ? (
                    <span>
                      <Icon name="clock" size={13} /> {support.hours}
                    </span>
                  ) : null}
                  {support.email ? (
                    <span>
                      <Icon name="mail" size={13} /> {support.email}
                    </span>
                  ) : null}
                </p>
              )}
            </div>
          </div>
        )}

        {guide && (
          <div className="ask-guide">
            <button
              type="button"
              className="guide-toggle"
              aria-expanded={guideOpen}
              aria-controls="ask-guide-body"
              onClick={onToggleGuide}
            >
              <span className="task-type-icon guide" aria-hidden="true">
                <Icon name="book" size={21} weight="duotone" />
              </span>
              <span>
                <span className="panel-label">{institution} has already answered this</span>
                <strong>{guide.question}</strong>
              </span>
              <span className={`guide-chevron ${guideOpen ? "open" : ""}`} aria-hidden="true">
                <Icon name="chevron" size={18} />
              </span>
            </button>

            {guideOpen && (
              <div className="guide-body" id="ask-guide-body">
                <p>{guide.answer}</p>
                <p className="guide-source">Published by {institution} · {topicLabel(guide.category)}</p>
              </div>
            )}
          </div>
        )}

        <div className="ask-step">
          <label htmlFor="ask-subject">What do you need?</label>
          <input
            id="ask-subject"
            className="ask-input"
            type="text"
            value={subject}
            maxLength={90}
            placeholder="One line: the thing you want decided or explained"
            onChange={(event) => onSubject(event.target.value)}
          />
        </div>

        <div className="ask-step">
          <label htmlFor="ask-message">Add any details</label>
          <textarea
            id="ask-message"
            className="ask-textarea"
            rows={5}
            value={message}
            maxLength={400}
            placeholder="What you have already tried, what is blocking you, and any date that matters."
            onChange={(event) => onMessage(event.target.value)}
          />
        </div>

        {failed && (
          <StateCard variant="error" icon="alert" title="Nothing was sent">
            Your question did not reach {office}. {failed} Nothing was saved and nobody has seen it. Every
            word is still above, exactly as you wrote it. Sending again is safe; there is no half-sent copy
            of this anywhere.
          </StateCard>
        )}

        <div className="ask-send">
          <Button kind="primary" type="submit" leadingIcon="send" iconSize={16} disabled={!ready} pending={sending}>
            {failed ? "Try sending again" : `Send to ${topic ? office : "an office"}`}
          </Button>
        </div>
      </form>
    </section>
  );
}
