"use client";
import type { TenantContact } from "@vv/contracts";
import Icon from "../../design-system/Icon.jsx";
import Modal from "../../design-system/patterns/Modal.jsx";
import Button from "../../design-system/primitives/Button.jsx";

export type Rung = {
  id: string;
  name: string;
  icon: string;
  expect: string;
  href: string;
};

/**
 * The rungs an institution has configured, from its published contacts. A
 * rung nobody configured does not appear and the ladder closes up: never an
 * empty rung, never a broken ladder.
 *
 * Edward is not a rung here: the portal, and Edward with it, opens once
 * these steps are done, so the first way to a person is the first rung.
 */
export function rungsFor(
  contacts: { admissions: TenantContact | null; support: TenantContact },
  href: (value: string) => string,
): Rung[] {
  const rungs: Rung[] = [];
  const offices = [contacts.admissions, contacts.support].filter(
    (office): office is TenantContact => Boolean(office),
  );
  for (const office of offices) {
    if (office.url) {
      rungs.push({
        id: `${office.label}-url`,
        name: office.label,
        icon: "message",
        expect: office.hours ?? "Opens the office’s own page.",
        href: href(office.url),
      });
    } else if (office.email) {
      rungs.push({
        id: `${office.label}-email`,
        name: `Email ${office.label}`,
        icon: "mail",
        expect: office.hours ?? "A reply within 2 business days.",
        href: `mailto:${office.email}`,
      });
    }
    if (office.phone) {
      rungs.push({
        id: `${office.label}-phone`,
        name: `Call ${office.label}`,
        icon: "phone",
        expect: office.hours ?? "During office hours.",
        href: `tel:${office.phone.replace(/[^+\d]/g, "")}`,
      });
    }
  }
  const seen = new Set<string>();
  return rungs.filter((rung) => {
    if (seen.has(rung.href)) return false;
    seen.add(rung.href);
    return true;
  });
}

/**
 * Help, as one system with one entry point. Each rung states what to expect
 * before she commits to it; only an explicit `This didn't solve it` moves
 * her down, so she never sees rung three before rung two.
 */
export function HelpLadder({
  rungs,
  reached,
  onDeeper,
  onClose,
}: {
  rungs: Rung[];
  reached: number;
  onDeeper: () => void;
  onClose: () => void;
}) {
  const shown = rungs.slice(0, Math.max(1, reached + 1));
  const more = rungs.length > reached + 1;

  return (
    <Modal
      className="modal-panel"
      labelledBy="help-title"
      onClose={onClose}
      foot={
        <div className="modal-answers">
          <Button kind="secondary" onClick={onClose}>
            Close
          </Button>
          {more ? (
            <Button kind="primary" onClick={onDeeper}>
              This didn’t solve it
            </Button>
          ) : null}
        </div>
      }
    >
      <span className="modal-kicker">
        <Icon name="help" size={16} /> Stuck on something
      </span>
      <h2 id="help-title">A person who can help</h2>
      <p>
        Nothing here changes your record. Ask, keep going, and come back to any step once it is
        answered.
      </p>

      {shown.length === 0 ? (
        <p className="ladder-foot">
          <Icon name="info" size={14} /> No office has published a way to reach it yet.
        </p>
      ) : (
        <div className="ladder">
          {shown.map((rung, index) => (
            <div key={rung.id} className={index === 0 ? "rung first" : "rung"}>
              <span className="rung-mark" aria-hidden="true">
                <Icon name={rung.icon} size={18} weight="duotone" />
              </span>
              <div className="rung-body">
                <strong>{rung.name}</strong>
                <small>{rung.expect}</small>
              </div>
              <a className={index === 0 ? "primary-button" : "secondary-button"} href={rung.href}>
                Open
              </a>
            </div>
          ))}
        </div>
      )}

      {more ? (
        <p className="ladder-foot">
          <Icon name="info" size={14} /> If that does not settle it, the next way to reach a person
          appears here.
        </p>
      ) : null}
    </Modal>
  );
}
