"use client";

import type { StudentHelpRequest } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import type { TenantConfig } from "../lib/tenant";
import { longDate, shortDate, stateOf, threadOf } from "./help-logic";

/**
 * One request, opened — the reference's `RequestDrawer`: the state, the path it has taken, and the
 * box that keeps it moving. A reply is signed by the office; there is no name, no avatar and no
 * role on it.
 */
export function HelpRequestDrawer({
  request,
  office,
  tenant,
  institution,
  replyText,
  sending,
  error,
  onReply,
  onSend,
  onClose,
}: {
  request: StudentHelpRequest;
  office: string;
  tenant: TenantConfig;
  institution: string;
  replyText: string;
  sending: boolean;
  error: string | null;
  onReply: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  const state = stateOf(request);
  const answered = request.status === "resolved";
  const canSend = replyText.trim().length > 0 && !sending;

  return (
    <Drawer
      variant="request"
      label={[office, `Opened ${longDate(request.createdAt, tenant)}`]}
      titleId="request-drawer-title"
      closeLabel="Close request"
      onClose={onClose}
    >
      <div className="drawer-icon">
        <Icon weight="duotone" name="message" size={25} />
      </div>
      <h2 id="request-drawer-title">{request.subject}</h2>

      <div className="request-state" role="status">
        <span className={`request-chip ${state.tone}`}>{state.label}</span>
        <p>{state.line(office)}</p>
      </div>

      <ol className="request-thread">
        {threadOf(request, office).map((entry) =>
          entry.kind === "event" ? (
            <li className="thread-event" key={entry.id}>
              <span className="thread-dot" aria-hidden="true" />
              <p>
                {entry.text} <span>{shortDate(entry.when, tenant)}</span>
              </p>
            </li>
          ) : (
            <li className={`thread-message ${entry.from}`} key={entry.id}>
              <span className="thread-dot" aria-hidden="true" />
              <div>
                <p className="thread-from">
                  {entry.from === "student" ? "You asked" : `${office} replied`}
                  <span>{shortDate(entry.when, tenant)}</span>
                </p>
                {entry.body.map((paragraph, index) => (
                  <p key={`${entry.id}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </li>
          ),
        )}
      </ol>

      <div className="reply-panel">
        <label className="panel-label" htmlFor="request-reply">
          {answered ? "Not settled? Reply here" : "Add to this request"}
        </label>
        <textarea
          id="request-reply"
          className="ask-textarea"
          rows={4}
          value={replyText}
          maxLength={2000}
          placeholder={
            answered
              ? "Say what is still open and this request goes back to the same office."
              : "Anything that would help: a date, a document number, what changed."
          }
          onChange={(event) => onReply(event.target.value)}
        />
        {error ? (
          <small className="field-error" role="alert">
            <Icon name="alert" size={13} /> {error}
          </small>
        ) : null}
        <Button kind="primary" full leadingIcon="send" iconSize={16} disabled={!canSend} pending={sending} onClick={onSend}>
          {answered ? "Send reply and reopen" : `Send to ${office}`}
        </Button>
        <small className="prototype-note">
          {answered
            ? `Replying reopens this request and puts it back with ${office}. Nothing you have already been told is removed.`
            : "Replies are saved immediately. This conversation stays active for five days after the latest message; its history stays protected after that."}
        </small>
      </div>

      <p className="published-note">
        {institution} replies here, in the portal. A reply is signed by the office because a request belongs
        to the office, not to one person’s day.
      </p>
    </Drawer>
  );
}
