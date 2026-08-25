"use client";
import type { FerpaPortalScope, StudentFerpaDelegate } from "@vv/contracts";
import { useState } from "react";
import Icon from "../../design-system/Icon.jsx";
import Modal from "../../design-system/patterns/Modal.jsx";
import Button from "../../design-system/primitives/Button.jsx";
import Field from "../../design-system/primitives/Field.jsx";
import Select from "../../design-system/primitives/Select.jsx";
import ChoiceList from "../../design-system/patterns/ChoiceList.jsx";
import FieldGroup from "../../design-system/patterns/FieldGroup.jsx";
import Notice from "../../design-system/patterns/Notice.jsx";
import Signature from "../../design-system/patterns/Signature.jsx";
import { DELEGATE_RELATIONSHIPS, SCOPE_OPTIONS } from "../steps/PermissionsStep";

export type AuthorizeDraft = {
  fullName: string;
  relationship: StudentFerpaDelegate["relationship"] | "";
  email: string;
  scopes: FerpaPortalScope[];
  signature: string;
};

export function emptyAuthorization(): AuthorizeDraft {
  return { fullName: "", relationship: "", email: "", scopes: [], signature: "" };
}

/**
 * Authorizing a person: a modal, not a drawer, because it ends in a
 * signature. Two steps inside it, each with a short internal scroll. At
 * least one page is required: authorizing a person to nothing is not a valid
 * outcome. Closing never discards — the draft lives on the page.
 */
export function AuthorizeModal({
  draft,
  legalName,
  today,
  institution,
  allowedScopes,
  needsSignature,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: {
  draft: AuthorizeDraft;
  legalName: string;
  today: string;
  institution: string;
  allowedScopes: FerpaPortalScope[];
  needsSignature: boolean;
  saving: boolean;
  error: string | null;
  onChange: (draft: AuthorizeDraft) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<"who" | "sign">("who");
  const set = (values: Partial<AuthorizeDraft>) => onChange({ ...draft, ...values });

  const options = SCOPE_OPTIONS.filter((option) => allowedScopes.includes(option.value));
  const named = Boolean(draft.fullName.trim() && draft.relationship);
  const canContinue = named && draft.email.includes("@") && draft.scopes.length > 0;
  const canSign = !needsSignature || draft.signature.trim().length > 2;

  if (stage === "who") {
    return (
      <Modal
        className="modal-panel authorize"
        labelledBy="authorize-title"
        onClose={onClose}
        foot={
          <div className="modal-answers">
            <span className="modal-count">
              {draft.scopes.length} of {options.length} chosen
            </span>
            <Button kind="primary" icon="arrow" disabled={!canContinue} onClick={() => setStage("sign")}>
              Continue
            </Button>
          </div>
        }
      >
        <span className="modal-kicker">
          <Icon name="users" size={16} /> Step 1 of 2
        </span>
        <h2 id="authorize-title">Who, and what they can see</h2>

        <div className="field-pair">
          <Field label="Full name" value={draft.fullName} onChange={(v: string) => set({ fullName: v })} />
          <Select
            label="How they’re related to you"
            value={draft.relationship}
            options={[
              { value: "", label: "Choose one" },
              ...DELEGATE_RELATIONSHIPS.map((option) => ({ value: option.value, label: option.label })),
            ]}
            onChange={(next: string) => set({ relationship: next as AuthorizeDraft["relationship"] })}
          />
        </div>

        <Field
          label="Their email"
          type="email"
          hint={`${institution} uses it only to tell them what they have been given.`}
          value={draft.email}
          onChange={(v: string) => set({ email: v })}
        />

        <FieldGroup plain className="spaced" label="What they can see" labelId="scopes-label">
          <ChoiceList
            multiple
            name="scopes"
            labelledBy="scopes-label"
            options={options.map((option) => [option.value, option.label, option.description])}
            value={draft.scopes}
            onChange={(scopes: FerpaPortalScope[]) => set({ scopes })}
          />
        </FieldGroup>
      </Modal>
    );
  }

  return (
    <Modal
      className="modal-panel authorize"
      labelledBy="authorize-title"
      onClose={onClose}
      foot={
        <div className="modal-answers">
          <Button kind="secondary" onClick={() => setStage("who")}>
            Back
          </Button>
          <Button kind="primary" icon="check" disabled={!canSign} pending={saving} onClick={onSave}>
            {needsSignature ? "Sign and authorize" : "Authorize"}
          </Button>
        </div>
      }
    >
      <span className="modal-kicker">
        <Icon name="pen" size={16} /> Step 2 of 2
      </span>
      <h2 id="authorize-title">{needsSignature ? "Your signature" : "Confirm"}</h2>
      <p>
        {draft.fullName.trim()} gets their own sign-in link, sees only the pages you chose, and is
        never told what you do in the portal. You can revoke it from your profile at any time.
      </p>

      {needsSignature ? (
        <Signature
          legalName={legalName}
          value={draft.signature}
          onChange={(signature: string) => set({ signature })}
          date={today}
          label="Type your full legal name to sign the release"
        />
      ) : (
        <Notice tone="quiet" icon="info">
          You have already signed the FERPA release, so adding a person needs no new signature.
        </Notice>
      )}

      {error ? (
        <Notice tone="alert" icon="alert">
          {error}
        </Notice>
      ) : null}
    </Modal>
  );
}
