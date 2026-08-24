"use client";

import Icon from "../design-system/Icon.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import { useTenant } from "./tenant-provider";
import {
  ACCOMMODATION_ANSWERS,
  ACCOMMODATION_QUESTION,
  type AccommodationAnswer,
} from "./health-logic";

const OFFICE = "Accessibility Services";

/**
 * Accessibility — the accommodation question, as a panel (the reference
 * `AccessibilityPanel` + `AccommodationCard`).
 *
 * The backend holds the answer as `accommodationInterest` on the onboarding
 * record and offers the student no way to change it from the portal, so this
 * panel shows the answer honestly and never fakes a save: where the reference
 * offers two radio doors, this offers the office's own contact.
 */
export function HealthAccessibilityPanel({
  answer,
  unavailable,
  onRetry,
  onClose,
}: {
  answer: AccommodationAnswer;
  unavailable: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { tenant, copy } = useTenant();
  const contact = tenant.publicLinks.accessibility ?? null;
  const chosen = answer ? ACCOMMODATION_ANSWERS.find((item) => item.id === answer.value) ?? null : null;

  return (
    <Drawer
      variant="question"
      label={[OFFICE, "Optional"]}
      titleId="accommodation-title"
      closeLabel="Close Accessibility"
      onClose={onClose}
    >
      <div className="drawer-icon question">
        <Icon weight="duotone" name="accessibility" size={25} />
      </div>

      <div className="question-body">
        <div className="question-head">
          <h2 id="accommodation-title">{ACCOMMODATION_QUESTION.title}</h2>
          <p className="question-lede">{ACCOMMODATION_QUESTION.lede}</p>
          <p className="question-collects">
            <Icon name="info" size={14} /> {copy(ACCOMMODATION_QUESTION.collects)}
          </p>
        </div>

        {unavailable ? (
          <div className="question-unreadable" role="alert">
            <p>
              <strong>Your answer couldn’t be read just now.</strong> It isn’t shown as answered or as
              open, because neither can be read right now, and guessing either way would be wrong.
            </p>
            <button className="secondary-button" type="button" onClick={onRetry}>
              <Icon name="refresh" size={16} /> Try again
            </button>
          </div>
        ) : chosen && answer ? (
          <div className="question-answered">
            <p className="answered-said">
              <span className="answer-mark done" aria-hidden="true">
                <Icon name="check" size={15} />
              </span>
              <strong>{chosen.said}</strong>
              <span>
                {answer.on ?? ""}
                {answer.where ? `${answer.on ? " · " : ""}answered during ${answer.where}` : ""}
              </span>
            </p>
            <p className="answered-next">{chosen.next}</p>
            <div className="answered-change">
              <span>
                {answer.value === "yes"
                  ? "Changed your mind? Tell Accessibility Services directly."
                  : "You can change this any time, by talking to Accessibility Services directly."}
              </span>
              {contact ? (
                <a className="secondary-button" href={contact}>
                  Contact {OFFICE} <Icon name="arrow" size={16} />
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="question-ask">
            <span className="question-open-label">Not answered yet</span>
            <p className="answered-next">
              This question is asked while you accept your offer, and it stays open until you answer
              it. Nothing happens until you do, and nobody is waiting on you.
            </p>
            <div className="answered-change">
              <span>To start the conversation now, go to {OFFICE} directly.</span>
              {contact ? (
                <a className="secondary-button" href={contact}>
                  Contact {OFFICE} <Icon name="arrow" size={16} />
                </a>
              ) : null}
            </div>
          </div>
        )}

        <p className="card-foot question-foot">
          <Icon name="lock" size={14} /> {ACCOMMODATION_QUESTION.seenBy}
        </p>
      </div>
    </Drawer>
  );
}
