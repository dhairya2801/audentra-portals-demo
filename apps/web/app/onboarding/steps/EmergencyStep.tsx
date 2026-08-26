"use client";
import FieldGroup from "../../design-system/patterns/FieldGroup.jsx";
import Field from "../../design-system/primitives/Field.jsx";
import Select from "../../design-system/primitives/Select.jsx";
import Button from "../../design-system/primitives/Button.jsx";
import Icon from "../../design-system/Icon.jsx";
import { MAX_EMERGENCY_CONTACTS, RELATIONSHIPS, type ContactDraft } from "../flow";

function ContactFields({
  contact,
  index,
  institution,
  problem,
  onChange,
  onRemove,
}: {
  contact: ContactDraft;
  index: number;
  institution: string;
  problem: string | null;
  onChange: (index: number, next: ContactDraft) => void;
  onRemove: (index: number) => void;
}) {
  const set = (values: Partial<ContactDraft>) => onChange(index, { ...contact, ...values });

  return (
    <div className="contact-block">
      <div className="contact-block-head">
        <p className="field-label field-group-label">
          {index === 0 ? `First person ${institution} tries` : `If they can’t be reached, ${index + 1}`}
        </p>
        {index > 0 ? (
          <Button kind="text" onClick={() => onRemove(index)}>
            Remove
          </Button>
        ) : null}
      </div>

      <div className="field-pair">
        <Field
          label="Full name"
          autoComplete="off"
          value={contact.fullName}
          error={problem && !contact.fullName.trim() ? problem : undefined}
          onChange={(value: string) => set({ fullName: value })}
        />
        <Select
          label="How they’re related to you"
          value={contact.relationship}
          options={[
            { value: "", label: "Choose one" },
            ...RELATIONSHIPS.map((option) => ({ value: option.value, label: option.label })),
          ]}
          onChange={(next: string) => set({ relationship: next as ContactDraft["relationship"] })}
        />
      </div>

      <div className="field-pair">
        <Field
          label="Phone number"
          type="tel"
          autoComplete="off"
          value={contact.mobilePhone}
          error={problem && contact.fullName.trim() && !contact.mobilePhone.trim() ? problem : undefined}
          onChange={(value: string) => set({ mobilePhone: value })}
        />
        <Field
          label="Email, optional"
          type="email"
          autoComplete="off"
          hint="Only so the next step can offer them record access. Being a contact gives them none."
          value={contact.email}
          onChange={(value: string) => set({ email: value })}
        />
      </div>
    </div>
  );
}

/**
 * Step 6. One person is required and up to two more are optional. The phone
 * number is not verified: nobody texts this person, they get called.
 */
export function EmergencyStep({
  contacts,
  institution,
  problems,
  onChangeContact,
  onAddContact,
  onRemoveContact,
}: {
  contacts: ContactDraft[];
  institution: string;
  problems: Array<string | null>;
  onChangeContact: (index: number, next: ContactDraft) => void;
  onAddContact: () => void;
  onRemoveContact: (index: number) => void;
}) {
  const first = contacts[0];
  const filled = Boolean(first?.fullName.trim() && first?.mobilePhone.trim());
  const room = contacts.length < MAX_EMERGENCY_CONTACTS;

  return (
    <FieldGroup
      footnote={
        <>
          <Icon name="lock" size={14} /> Being an emergency contact means {institution} can call them.
          It does not let them see anything about you. Who can see your record is the next step.
        </>
      }
    >
      {contacts.map((contact, index) => (
        <ContactFields
          key={index}
          contact={contact}
          index={index}
          institution={institution}
          problem={problems[index] ?? null}
          onChange={onChangeContact}
          onRemove={onRemoveContact}
        />
      ))}

      {filled && room ? (
        <div>
          <Button kind="secondary" leadingIcon="plus" onClick={onAddContact}>
            Add another contact
          </Button>
        </div>
      ) : null}
    </FieldGroup>
  );
}
