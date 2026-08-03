"use client";

import type { StudentRequirementInputField } from "@vv/contracts";
import { type DragEvent, useState } from "react";

export type FormBuilderField = StudentRequirementInputField;

export const responsibleOfficeOptions = [
  "Admissions",
  "Admissions and Financial Aid",
  "Enrollment Services",
  "Registrar",
  "Student Accounts",
  "Housing & Residence Life",
  "Dean of Students Office",
  "Student Life",
  "Financial Aid",
  "Health Services",
  "Accessibility Services",
  "Academic Advising",
  "Career Services",
] as const;

export const onboardingScreenDefaults: Record<
  string,
  { label: string; title: string; description: string }
> = {
  offer: {
    label: "Offer",
    title: "Your place at Aster",
    description: "Begin by confirming the admission decision that brought you here.",
  },
  about_you: {
    label: "About you",
    title: "Identity & home address",
    description:
      "Add the personal details and permanent address Aster needs to prepare your student record.",
  },
  housing: {
    label: "Housing",
    title: "One personalized story",
    description: "Tell us where you imagine starting your Aster experience.",
  },
  campus_life: {
    label: "Campus life",
    title: "Clubs, people & support",
    description: "Choose the communities and support you want to hear about.",
  },
  emergency_contacts: {
    label: "Emergency contacts",
    title: "People in your corner",
    description: "Enter one or more people Aster may contact in an emergency.",
  },
  family_permissions: {
    label: "Family permissions",
    title: "Your privacy, your choice",
    description: "Choose whether anyone else may discuss parts of your student record.",
  },
  review_and_sign: {
    label: "Review & sign",
    title: "Review and sign",
    description: "Review your answers and sign the enrollment and privacy acknowledgements.",
  },
  deposit: {
    label: "Deposit",
    title: "Review your deposit",
    description:
      "Confirm the enrollment-deposit amount and continue to the enrollment checklist.",
  },
};

export const aboutYouDefaultFields: FormBuilderField[] = [
  { id: "first_name", title: "Legal first name", field_type: "text", required: true },
  { id: "last_name", title: "Legal last name", field_type: "text", required: true },
  { id: "preferred_name", title: "What should we call you?", field_type: "text", required: true },
  { id: "personal_email", title: "Personal email", field_type: "email", required: true },
  { id: "mobile_phone", title: "Mobile number", field_type: "phone", required: true },
  {
    id: "citizenship_status",
    title: "Citizenship / student status",
    field_type: "single_select",
    required: true,
    options: [
      "U.S. citizen",
      "U.S. permanent resident",
      "Other eligible noncitizen / status",
      "International student · F-1 or J-1",
    ],
  },
  { id: "street_address", title: "Street address", field_type: "text", required: false },
  { id: "city", title: "City", field_type: "text", required: false },
  { id: "state_or_province", title: "State / province", field_type: "text", required: false },
  { id: "postal_code", title: "ZIP / postal code", field_type: "text", required: false },
  {
    id: "country",
    title: "Country",
    field_type: "single_select",
    required: false,
    options: [
      "United States",
      "Canada",
      "China",
      "India",
      "Mexico",
      "Türkiye",
      "United Kingdom",
      "Another country",
    ],
  },
  {
    id: "residency_verification_path",
    title: "How should residency be verified?",
    field_type: "single_select",
    required: false,
    options: [
      "Review my permanent address",
      "I will provide supporting documents",
      "I need an advisor review",
    ],
  },
];

const fieldTypeOptions: Array<{
  value: FormBuilderField["field_type"];
  label: string;
}> = [
  { value: "text", label: "Short text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Yes / no checkbox" },
  { value: "single_select", label: "Single choice" },
  { value: "multiple_select", label: "Multiple choice" },
];

function nextFieldId(fields: readonly FormBuilderField[]) {
  let index = fields.length + 1;
  while (fields.some((field) => field.id === `question_${index}`)) index += 1;
  return `question_${index}`;
}

function optionsFromText(value: string) {
  return value
    .split(/\r?\n/)
    .map((option) => option.trim())
    .filter(Boolean);
}

function FieldPreview({ field }: { field: FormBuilderField }) {
  const common = {
    "aria-label": field.title,
    disabled: true,
  };
  if (field.field_type === "checkbox") {
    return (
      <label className="staff-form-preview__check">
        <input type="checkbox" {...common} />
        <span>{field.title}{field.required ? " *" : ""}</span>
      </label>
    );
  }
  if (field.field_type === "single_select") {
    return (
      <label className="staff-form-preview__field">
        <span>{field.title}{field.required ? " *" : ""}</span>
        <select defaultValue="" {...common}>
          <option value="" disabled>Choose one</option>
          {(field.options ?? []).map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }
  if (field.field_type === "multiple_select") {
    return (
      <fieldset className="staff-form-preview__choices">
        <legend>{field.title}{field.required ? " *" : ""}</legend>
        {(field.options ?? []).map((option) => (
          <label key={option}>
            <input type="checkbox" />
            {option}
          </label>
        ))}
      </fieldset>
    );
  }
  const inputType =
    field.field_type === "phone" ? "tel" : field.field_type;
  return (
    <label className="staff-form-preview__field">
      <span>{field.title}{field.required ? " *" : ""}</span>
      <input type={inputType} {...common} />
    </label>
  );
}

export function FormCanvasBuilder({
  fields,
  onChange,
  screen,
}: {
  fields: FormBuilderField[];
  onChange: (fields: FormBuilderField[]) => void;
  screen: { label: string; title: string; description: string };
}) {
  const [newFieldType, setNewFieldType] =
    useState<FormBuilderField["field_type"]>("text");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<FormBuilderField>) => {
    onChange(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  };
  const move = (id: string, offset: -1 | 1) => {
    const index = fields.findIndex((field) => field.id === id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const drop = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") || draggedId;
    const sourceIndex = fields.findIndex((field) => field.id === sourceId);
    const targetIndex = fields.findIndex((field) => field.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const next = [...fields];
    const [source] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, source);
    onChange(next);
    setDraggedId(null);
  };
  const addField = () => {
    const id = nextFieldId(fields);
    const choice = ["single_select", "multiple_select"].includes(newFieldType);
    onChange([
      ...fields,
      {
        id,
        title: "New question",
        field_type: newFieldType,
        required: false,
        ...(choice ? { options: ["Option 1", "Option 2"] } : {}),
      },
    ]);
  };

  return (
    <section className="staff-form-builder" aria-label="Student form builder">
      <div className="staff-form-builder__heading">
        <div>
          <strong>Form canvas</strong>
          <p>Drag questions into order, choose their control, and preview the exact student layout.</p>
        </div>
        <div className="staff-form-builder__add">
          <label>
            New field type
            <select
              value={newFieldType}
              onChange={(event) =>
                setNewFieldType(event.target.value as FormBuilderField["field_type"])
              }
            >
              {fieldTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button className="button button--secondary" type="button" onClick={addField}>
            + Add question
          </button>
        </div>
      </div>
      <div className="staff-form-builder__workspace">
        <ol className="staff-form-builder__fields">
          {fields.map((field, index) => (
            <li
              key={field.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", field.id);
                setDraggedId(field.id);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, field.id)}
              onDragEnd={() => setDraggedId(null)}
            >
              <div className="staff-form-builder__field-heading">
                <span className="staff-form-builder__handle" aria-hidden="true">⋮⋮</span>
                <code>{field.id}</code>
                <div>
                  <button type="button" aria-label={`Move ${field.title} up`} disabled={index === 0} onClick={() => move(field.id, -1)}>↑</button>
                  <button type="button" aria-label={`Move ${field.title} down`} disabled={index === fields.length - 1} onClick={() => move(field.id, 1)}>↓</button>
                  <button type="button" aria-label={`Delete ${field.title}`} onClick={() => onChange(fields.filter((candidate) => candidate.id !== field.id))}>Delete</button>
                </div>
              </div>
              <div className="staff-form-grid">
                <label>
                  Student-facing label
                  <input value={field.title} maxLength={180} onChange={(event) => update(field.id, { title: event.target.value })} />
                </label>
                <label>
                  Input control
                  <select
                    value={field.field_type}
                    onChange={(event) => {
                      const fieldType = event.target.value as FormBuilderField["field_type"];
                      const choice = ["single_select", "multiple_select"].includes(fieldType);
                      update(field.id, {
                        field_type: fieldType,
                        ...(choice && !field.options ? { options: ["Option 1", "Option 2"] } : {}),
                      });
                    }}
                  >
                    {fieldTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {["single_select", "multiple_select"].includes(field.field_type) ? (
                <label>
                  Choices · one per line
                  <textarea
                    value={(field.options ?? []).join("\n")}
                    onChange={(event) => update(field.id, { options: optionsFromText(event.target.value) })}
                  />
                </label>
              ) : null}
              <label className="staff-checkbox">
                <input type="checkbox" checked={field.required} onChange={(event) => update(field.id, { required: event.target.checked })} />
                Required before the student can continue
              </label>
            </li>
          ))}
          {fields.length === 0 ? (
            <li className="staff-form-builder__empty">Add the first question to make this form publishable.</li>
          ) : null}
        </ol>
        <div className="staff-form-preview" aria-label="Student page preview">
          <div className="staff-form-preview__badge">Live student preview</div>
          <header>
            <p>{screen.label}</p>
            <h3>{screen.title || "Untitled student page"}</h3>
            <span>{screen.description || "Add an introduction for students."}</span>
          </header>
          <div className="staff-form-preview__card">
            {fields.map((field) => <FieldPreview key={field.id} field={field} />)}
            {fields.length === 0 ? <p>No questions configured yet.</p> : null}
            <button type="button">Save and continue →</button>
          </div>
        </div>
      </div>
    </section>
  );
}
