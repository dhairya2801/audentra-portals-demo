"use client";
import Icon from "../../design-system/Icon.jsx";
import Modal from "../../design-system/patterns/Modal.jsx";
import Button from "../../design-system/primitives/Button.jsx";
import { WAIVER_OFFICE } from "../steps/DepositStep";

/**
 * Asking for a waiver or a later date. A modal because it is a request with
 * a consequence, and because it answers the three things a student needs to
 * know before committing: who reads it, how long, and what happens to her
 * place meanwhile. Nothing here asks her to prove hardship.
 */
export function WaiverModal({ onSend, onClose }: { onSend: () => void; onClose: () => void }) {
  return (
    <Modal
      className="modal-panel"
      labelledBy="waiver-title"
      onClose={onClose}
      foot={
        <div className="modal-answers">
          <Button kind="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button kind="primary" icon="send" onClick={onSend}>
            Ask for a waiver
          </Button>
        </div>
      }
    >
      <span className="modal-kicker">
        <Icon name="shield" size={16} /> {WAIVER_OFFICE}
      </span>
      <h2 id="waiver-title">Your place is held while this is read</h2>
      <p>
        Asking counts the same as paying, for holding your place and for opening what comes next.{" "}
        {WAIVER_OFFICE} reads the request once you save this step, writes to you with a decision, and
        asking doesn’t affect your offer.
      </p>
      <p>Nothing here asks you to explain yourself. One choice, and the office takes it from there.</p>
    </Modal>
  );
}
