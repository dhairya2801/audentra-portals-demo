"use client";
import Icon from "../../design-system/Icon.jsx";
import Modal from "../../design-system/patterns/Modal.jsx";
import Button from "../../design-system/primitives/Button.jsx";

/**
 * What happens on No.
 *
 * The platform records a decline through Admissions rather than through the
 * portal — there is no student-facing decline command — so the modal says
 * what happens, plainly, and takes her to the one office that can act on it.
 * No typed confirmation: the friction that belongs here is the sentence.
 */
export function DeclineModal({
  institution,
  admissions,
  onClose,
}: {
  institution: string;
  admissions: { label: string; href: string | null };
  onClose: () => void;
}) {
  return (
    <Modal
      className="modal-panel"
      labelledBy="decline-title"
      onClose={onClose}
      foot={
        <div className="modal-answers">
          <Button kind="secondary" onClick={onClose}>
            Go back
          </Button>
          {admissions.href ? (
            <Button
              kind="danger"
              icon="mail"
              onClick={() => window.location.assign(admissions.href as string)}
            >
              Write to {admissions.label}
            </Button>
          ) : null}
        </div>
      }
    >
      <span className="modal-kicker alert">
        <Icon name="alert" size={16} /> This one is final
      </span>
      <h2 id="decline-title">Declining the offer goes through {admissions.label}</h2>
      <p>
        Your place goes to somebody else and these steps close. {institution} records a decline
        when {admissions.label} hears from you, so write to them and say so. Only they can reopen it
        afterwards, and they may not be able to.
      </p>
      <p>Nothing changes until you do. Going back keeps your offer exactly as it was.</p>
    </Modal>
  );
}
