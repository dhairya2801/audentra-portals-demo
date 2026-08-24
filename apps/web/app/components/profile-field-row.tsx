"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import {
  type ChannelId,
  type Office,
  type OfficeId,
  type ProfileField,
  type VerifyState,
  channelOptions,
} from "./profile-logic";

/**
 * One field of the record — the reference's `FieldRow`, with the one thing the
 * prototype only toasted about built in: `Change` opens the field in place, and
 * `Save` writes it through `updateStudentProfile`. The row's shape is otherwise
 * the reference's exactly: the value is the anchor, the label sits small above
 * it, an office-owned row keeps a lock on its label and offers the route to
 * that office instead of a control.
 */

const VERIFY_ICON: Record<VerifyState, string> = {
  verified: "check",
  pending: "clock",
  unverified: "info",
  unknown: "info",
};

export function needsYou(field: ProfileField) {
  return field.verify?.state === "pending" || field.verify?.state === "unverified";
}

export interface FieldEdit {
  /** The draft the student typed. Survives a version conflict so nothing is lost. */
  draft: string;
  saving: boolean;
  error: string | null;
  /** The record moved underneath the edit; the draft is kept and the latest version loaded. */
  conflict: boolean;
}

export default function ProfileFieldRow({
  field,
  offices,
  channel,
  channelSaving,
  textBlocked,
  choiceOpen,
  edit,
  onToggleChoice,
  onChannel,
  onEdit,
  onDraft,
  onSave,
  onCancel,
  onReload,
  onAsk,
}: {
  field: ProfileField;
  offices: Record<OfficeId, Office>;
  channel: ChannelId;
  channelSaving: boolean;
  textBlocked: boolean;
  choiceOpen: boolean;
  edit: FieldEdit | null;
  onToggleChoice: () => void;
  onChannel: (id: ChannelId) => void;
  onEdit: (field: ProfileField) => void;
  onDraft: (field: ProfileField, value: string) => void;
  onSave: (field: ProfileField) => void;
  onCancel: (field: ProfileField) => void;
  onReload: (field: ProfileField) => void;
  onAsk: (office: Office, field: ProfileField) => void;
}) {
  const office = field.owner === "student" ? null : offices[field.owner];
  const option = field.choice ? channelOptions.find(([value]) => value === channel) : null;

  const value = option ? option[1] : field.value;
  const note = option ? option[2] : field.note;
  const verify = field.verify;
  const editLabel = field.value || option ? "Change" : "Add";
  const editing = Boolean(edit);

  return (
    <div
      className={`field-row${office ? " owned" : ""}${needsYou(field) ? " needs-you" : ""}${editing ? " editing" : ""}`}
    >
      <div className="field-head">
        <span className="field-row-label">
          {office && <Icon name="lock" size={11} />}
          {field.label}
        </span>
        {verify && (
          <span className={`verify-pill ${verify.state}`}>
            <Icon name={VERIFY_ICON[verify.state]} size={12} />
            {verify.label}
          </span>
        )}
      </div>

      <div className="field-body">
        {edit ? (
          <EditPanel
            field={field}
            edit={edit}
            onDraft={(next) => onDraft(field, next)}
            onSave={() => onSave(field)}
            onCancel={() => onCancel(field)}
            onReload={() => onReload(field)}
          />
        ) : (
          <>
            <p
              className={`field-value${field.value || option ? "" : " blank"}${field.mono ? " mono" : ""}`}
            >
              {value ?? field.blank ?? "Not set"}
            </p>
            {note && <p className="field-note">{note}</p>}
            {option && textBlocked && (
              <p className="field-note pending">
                Aster can’t text you until that number is verified.
              </p>
            )}
            {verify?.detail && (
              <p className={`field-note${verify.state === "verified" ? " evidence" : ""}`}>
                {verify.detail}
              </p>
            )}
          </>
        )}

        {option && choiceOpen && (
          <fieldset className="choice-panel field-choice" disabled={channelSaving}>
            <legend className="sr-only">How Aster should reach you first</legend>
            {channelOptions.map(([id, label, hint]) => (
              <label key={id} className={channel === id ? "chosen" : ""}>
                <input
                  type="radio"
                  name="preferred-channel"
                  value={id}
                  checked={channel === id}
                  onChange={() => onChannel(id)}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
                <span className="radio-mark">
                  <Icon name="check" size={14} />
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </div>

      <div className="field-actions">
        {office ? (
          <button
            className="field-action office"
            aria-label={`Ask ${office.short} about your ${field.label.toLowerCase()}`}
            onClick={() => onAsk(office, field)}
          >
            Ask {office.short}
            <Icon name="arrow" size={14} />
          </button>
        ) : option ? (
          <button
            className="field-action"
            aria-expanded={choiceOpen}
            aria-label={`${choiceOpen ? "Done choosing" : "Change"} your preferred channel`}
            onClick={onToggleChoice}
          >
            <Icon name="pen" size={14} />
            {choiceOpen ? "Done" : editLabel}
          </button>
        ) : editing ? null : (
          <button
            className="field-action"
            aria-label={`${editLabel} your ${field.label.toLowerCase()}`}
            onClick={() => onEdit(field)}
          >
            <Icon name={field.photo ? "camera" : "pen"} size={14} />
            {editLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function EditPanel({
  field,
  edit,
  onDraft,
  onSave,
  onCancel,
  onReload,
}: {
  field: ProfileField;
  edit: FieldEdit;
  onDraft: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onReload: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [id] = useState(() => `field-edit-${field.id}`);

  useEffect(() => {
    input.current?.focus();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit.saving) onSave();
  }

  return (
    <form className="field-edit" onSubmit={submit}>
      <label className={edit.error ? "field invalid" : "field"} htmlFor={id}>
        <span className="sr-only">{field.label}</span>
        <span className="field-control">
          <input
            id={id}
            ref={input}
            type={field.inputType ?? "text"}
            value={edit.draft}
            maxLength={field.editKey === "preferredName" ? 120 : field.editKey === "pronouns" ? 80 : 30}
            autoComplete={
              field.editKey === "preferredName"
                ? "nickname"
                : field.editKey === "mobilePhone"
                  ? "tel"
                  : "off"
            }
            placeholder={field.editKey === "pronouns" ? "For example: she / her" : undefined}
            aria-invalid={edit.error ? true : undefined}
            disabled={edit.saving}
            onChange={(event) => onDraft(event.target.value)}
          />
          {edit.error ? <Icon name="alert" size={15} /> : null}
        </span>
        {edit.error ? (
          <small className="field-error" role="alert">
            <Icon name="alert" size={13} />
            {edit.error}
          </small>
        ) : null}
      </label>
      {field.note && !edit.error ? <p className="field-note">{field.note}</p> : null}
      <div className="field-edit-actions">
        <Button kind="primary" type="submit" icon="check" pending={edit.saving}>
          Save
        </Button>
        <Button kind="secondary" type="button" onClick={onCancel} disabled={edit.saving}>
          Cancel
        </Button>
        {edit.conflict ? (
          <button type="button" className="link-button" onClick={onReload} disabled={edit.saving}>
            <Icon name="refresh" size={14} /> Load the latest, keep what I typed
          </button>
        ) : null}
      </div>
    </form>
  );
}
