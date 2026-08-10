"use client";

import type {
  StudentRequirementFormDefinition,
  StudentRequirementFormPage,
  StudentRequirementInputField,
} from "@vv/contracts";
import { type DragEvent, useMemo, useState } from "react";

export type FormBuilderField = StudentRequirementInputField;
export type FormBuilderPage = StudentRequirementFormPage;
export type FormBuilderDefinition = StudentRequirementFormDefinition;

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
      "International student - F-1 or J-1",
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
      "Turkiye",
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

export function onePageForm(
  fields: readonly FormBuilderField[],
  page: Pick<FormBuilderPage, "id" | "title" | "description"> = {
    id: "student_details",
    title: "Student details",
    description: "Complete the questions below.",
  },
): FormBuilderDefinition {
  return {
    version: 1,
    pages: [{ ...page, fields: structuredClone([...fields]) }],
  };
}

export function flattenFormDefinition(form: FormBuilderDefinition) {
  return form.pages.flatMap((page) => page.fields);
}

export const aboutYouDefaultForm: FormBuilderDefinition = {
  version: 1,
  pages: [
    {
      id: "identity_and_contact",
      title: "Identity and contact",
      description: "Confirm how the university should identify and contact you.",
      fields: structuredClone(aboutYouDefaultFields.slice(0, 6)),
    },
    {
      id: "permanent_address",
      title: "Permanent address",
      description: "Add the address used for residency and student records.",
      fields: structuredClone(aboutYouDefaultFields.slice(6)),
    },
  ],
};

export interface FormScaffoldTemplate {
  id: string;
  name: string;
  description: string;
  bestFor: string;
  form: FormBuilderDefinition;
}

export const formScaffoldTemplates: FormScaffoldTemplate[] = [
  {
    id: "profile_contact",
    name: "Profile & contact",
    description: "Two short pages for identity, contact, and permanent-address details.",
    bestFor: "Admissions and onboarding",
    form: structuredClone(aboutYouDefaultForm),
  },
  {
    id: "student_support",
    name: "Student support intake",
    description: "Understand the topic, urgency, preferred channel, and best follow-up time.",
    bestFor: "Advising and support",
    form: {
      version: 1,
      pages: [
        {
          id: "support_need",
          title: "How can we help?",
          description: "Tell us what you need so the request reaches the right team.",
          fields: [
            { id: "support_topic", title: "Support topic", field_type: "single_select", required: true, options: ["Documents", "Financial aid", "Housing", "Academics", "Something else"] },
            { id: "support_details", title: "What would you like us to know?", field_type: "text", required: true },
            { id: "time_sensitive", title: "Is this time-sensitive?", field_type: "checkbox", required: false },
          ],
        },
        {
          id: "follow_up_preferences",
          title: "Follow-up preferences",
          description: "Choose how and when staff should contact you.",
          fields: [
            { id: "preferred_channel", title: "Preferred contact channel", field_type: "single_select", required: true, options: ["Portal message", "Email", "Phone call"] },
            { id: "best_contact_date", title: "Best date to follow up", field_type: "date", required: false },
            { id: "contact_phone", title: "Phone number", field_type: "phone", required: false, when: { field: "preferred_channel", equals: "Phone call" } },
          ],
        },
      ],
    },
  },
  {
    id: "orientation_preferences",
    name: "Orientation preferences",
    description: "Collect session, accessibility, guest, and activity preferences in two steps.",
    bestFor: "Orientation registration",
    form: {
      version: 1,
      pages: [
        {
          id: "session_preferences",
          title: "Choose your session",
          description: "Share the format and date that work best for you.",
          fields: [
            { id: "session_format", title: "Session format", field_type: "single_select", required: true, options: ["On campus", "Online", "No preference"] },
            { id: "preferred_date", title: "Preferred date", field_type: "date", required: true },
            { id: "bringing_guest", title: "I plan to bring a guest", field_type: "checkbox", required: false },
          ],
        },
        {
          id: "experience_preferences",
          title: "Shape your experience",
          description: "Choose the topics you would most like to explore.",
          fields: [
            { id: "orientation_topics", title: "Topics of interest", field_type: "multiple_select", required: true, options: ["Academics", "Campus life", "Financial planning", "Housing", "Career services"], maximum_selections: 3 },
            { id: "accessibility_support", title: "I would like accessibility information", field_type: "checkbox", required: false },
          ],
        },
      ],
    },
  },
  {
    id: "emergency_contact",
    name: "Emergency contact",
    description: "A compact, ready-to-edit contact form with a confirmation page.",
    bestFor: "Student records",
    form: {
      version: 1,
      pages: [
        {
          id: "contact_information",
          title: "Contact information",
          description: "Add the person the university should contact in an emergency.",
          fields: [
            { id: "contact_name", title: "Full name", field_type: "text", required: true },
            { id: "relationship", title: "Relationship", field_type: "single_select", required: true, options: ["Parent", "Guardian", "Partner", "Sibling", "Friend", "Other"] },
            { id: "contact_phone", title: "Mobile number", field_type: "phone", required: true },
            { id: "contact_email", title: "Email", field_type: "email", required: false },
          ],
        },
        {
          id: "contact_confirmation",
          title: "Confirm permission",
          description: "Review how this information may be used.",
          fields: [
            { id: "emergency_contact_consent", title: "I confirm this person may be contacted in an emergency", field_type: "checkbox", required: true },
          ],
        },
      ],
    },
  },
  {
    id: "simple_confirmation",
    name: "Simple confirmation",
    description: "One page for a policy acknowledgement and optional follow-up request.",
    bestFor: "Quick requirements",
    form: {
      version: 1,
      pages: [
        {
          id: "confirmation",
          title: "Review and confirm",
          description: "Read the instructions above, then record your response.",
          fields: [
            { id: "confirmed", title: "I have reviewed and understand this information", field_type: "checkbox", required: true },
            { id: "needs_follow_up", title: "I would like a staff member to follow up", field_type: "checkbox", required: false },
          ],
        },
      ],
    },
  },
];

const fieldTypeOptions: Array<{
  value: FormBuilderField["field_type"];
  label: string;
  symbol: string;
  description: string;
}> = [
  { value: "text", label: "Short text", symbol: "Aa", description: "Names, IDs, or a short response" },
  { value: "email", label: "Email", symbol: "@", description: "Validated email address" },
  { value: "phone", label: "Phone", symbol: "TEL", description: "Telephone number" },
  { value: "date", label: "Date", symbol: "DATE", description: "Calendar date" },
  { value: "number", label: "Number", symbol: "123", description: "Scores, counts, or numeric thresholds" },
  { value: "checkbox", label: "Yes / no", symbol: "YES", description: "Consent or confirmation" },
  { value: "single_select", label: "Single choice", symbol: "1", description: "Select one option" },
  { value: "multiple_select", label: "Multiple choice", symbol: "N", description: "Select several options" },
];

function nextFieldId(form: FormBuilderDefinition) {
  const fields = flattenFormDefinition(form);
  let index = fields.length + 1;
  while (fields.some((field) => field.id === `question_${index}`)) index += 1;
  return `question_${index}`;
}

function nextPageId(pages: readonly FormBuilderPage[]) {
  let index = pages.length + 1;
  while (pages.some((page) => page.id === `page_${index}`)) index += 1;
  return `page_${index}`;
}

function optionsFromText(value: string) {
  return value.split(/\r?\n/).map((option) => option.trim()).filter(Boolean);
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function FieldPreview({ field }: { field: FormBuilderField }) {
  const common = { "aria-label": field.title, disabled: true };
  if (field.field_type === "checkbox") {
    return <label className="staff-form-preview__check"><input type="checkbox" {...common} /><span>{field.title}{field.required ? " *" : ""}</span></label>;
  }
  if (field.field_type === "single_select") {
    return (
      <label className="staff-form-preview__field">
        <span>{field.title}{field.required ? " *" : ""}</span>
        <select defaultValue="" {...common}><option value="" disabled>Choose one</option>{(field.options ?? []).map((option) => <option key={option}>{option}</option>)}</select>
      </label>
    );
  }
  if (field.field_type === "multiple_select") {
    return <fieldset className="staff-form-preview__choices"><legend>{field.title}{field.required ? " *" : ""}</legend>{(field.options ?? []).map((option) => <label key={option}><input type="checkbox" />{option}</label>)}</fieldset>;
  }
  return <label className="staff-form-preview__field"><span>{field.title}{field.required ? " *" : ""}</span><input type={field.field_type === "phone" ? "tel" : field.field_type} min={field.minimum} max={field.maximum} step={field.step} {...common} /></label>;
}

export function FormCanvasBuilder({
  form,
  onChange,
  screen,
}: {
  form: FormBuilderDefinition;
  onChange: (form: FormBuilderDefinition) => void;
  screen: { label: string; title: string; description: string };
}) {
  const [activePageId, setActivePageId] = useState(form.pages[0]?.id ?? "");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const activePage = form.pages.find((page) => page.id === activePageId) ?? form.pages[0];
  const activePageIndex = Math.max(0, form.pages.findIndex((page) => page.id === activePage?.id));
  const questionCount = useMemo(() => flattenFormDefinition(form).length, [form]);

  const updatePage = (pageId: string, patch: Partial<FormBuilderPage>) => {
    onChange({ ...form, pages: form.pages.map((page) => page.id === pageId ? { ...page, ...patch } : page) });
  };
  const updateFields = (fields: FormBuilderField[]) => {
    if (activePage) updatePage(activePage.id, { fields });
  };
  const updateField = (id: string, patch: Partial<FormBuilderField>) => {
    if (!activePage) return;
    updateFields(activePage.fields.map((field) => field.id === id ? { ...field, ...patch } : field));
  };
  const movePage = (pageId: string, offset: -1 | 1) => {
    const index = form.pages.findIndex((page) => page.id === pageId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= form.pages.length) return;
    const pages = [...form.pages];
    [pages[index], pages[target]] = [pages[target], pages[index]];
    onChange({ ...form, pages });
  };
  const addPage = () => {
    const id = nextPageId(form.pages);
    onChange({ ...form, pages: [...form.pages, { id, title: "New page", description: "Tell students what to complete on this page.", fields: [] }] });
    setActivePageId(id);
  };
  const duplicatePage = (page: FormBuilderPage) => {
    let nextForm = structuredClone(form);
    const copiedFields = page.fields.map((field) => {
      const id = nextFieldId(nextForm);
      const copy = { ...structuredClone(field), id };
      nextForm = { ...nextForm, pages: nextForm.pages.map((candidate) => candidate.id === page.id ? { ...candidate, fields: [...candidate.fields, copy] } : candidate) };
      return copy;
    });
    const id = nextPageId(nextForm.pages);
    const pages = [...form.pages];
    const index = pages.findIndex((candidate) => candidate.id === page.id);
    pages.splice(index + 1, 0, { ...structuredClone(page), id, title: `${page.title} copy`, fields: copiedFields });
    onChange({ ...form, pages });
    setActivePageId(id);
  };
  const removePage = (pageId: string) => {
    if (form.pages.length === 1) return;
    const index = form.pages.findIndex((page) => page.id === pageId);
    const pages = form.pages.filter((page) => page.id !== pageId);
    onChange({ ...form, pages });
    setActivePageId(pages[Math.min(index, pages.length - 1)]?.id ?? "");
  };
  const moveField = (id: string, offset: -1 | 1) => {
    if (!activePage) return;
    const index = activePage.fields.findIndex((field) => field.id === id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= activePage.fields.length) return;
    const fields = [...activePage.fields];
    [fields[index], fields[target]] = [fields[target], fields[index]];
    updateFields(fields);
  };
  const drop = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    if (!activePage) return;
    const sourceId = event.dataTransfer.getData("text/plain") || draggedId;
    const sourceIndex = activePage.fields.findIndex((field) => field.id === sourceId);
    const targetIndex = activePage.fields.findIndex((field) => field.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const fields = [...activePage.fields];
    const [source] = fields.splice(sourceIndex, 1);
    fields.splice(targetIndex, 0, source);
    updateFields(fields);
    setDraggedId(null);
  };
  const addField = (fieldType: FormBuilderField["field_type"]) => {
    if (!activePage) return;
    const choice = ["single_select", "multiple_select"].includes(fieldType);
    updateFields([...activePage.fields, { id: nextFieldId(form), title: "New question", field_type: fieldType, required: false, ...(choice ? { options: ["Option 1", "Option 2"] } : {}) }]);
  };
  const duplicateField = (field: FormBuilderField) => {
    if (!activePage) return;
    const index = activePage.fields.findIndex((candidate) => candidate.id === field.id);
    const copy = { ...structuredClone(field), id: nextFieldId(form), title: `${field.title} copy` };
    const fields = [...activePage.fields];
    fields.splice(index + 1, 0, copy);
    updateFields(fields);
  };
  const applyTemplate = (template: FormScaffoldTemplate) => {
    const next = structuredClone(template.form);
    onChange(next);
    setActivePageId(next.pages[0]?.id ?? "");
    setShowTemplates(false);
  };

  return (
    <section className="staff-form-builder staff-form-builder--multipage" aria-label="Student form builder">
      <div className="staff-form-builder__heading">
        <div><span className="staff-form-builder__heading-icon" aria-hidden="true">+</span><div><strong>Build the student form</strong><p>Scaffold from a template or compose pages and questions from scratch.</p></div></div>
        <div className="staff-form-builder__heading-actions">
          <span className="staff-form-builder__count">{form.pages.length} {form.pages.length === 1 ? "page" : "pages"} - {questionCount} {questionCount === 1 ? "question" : "questions"}</span>
          <button type="button" className="button button--secondary" aria-expanded={showTemplates} onClick={() => setShowTemplates((current) => !current)}>Browse templates</button>
        </div>
      </div>

      {showTemplates ? (
        <section className="staff-form-templates" aria-label="Form templates">
          <header><div><p className="eyebrow">Starter library</p><h4>Choose a form scaffold</h4><p>Using a template replaces the unsaved form in this editor. You can edit every page before publishing.</p></div><button type="button" aria-label="Close form templates" onClick={() => setShowTemplates(false)}>Close</button></header>
          <div>{formScaffoldTemplates.map((template) => {
            const fields = flattenFormDefinition(template.form).length;
            return <article key={template.id}><span>{template.form.pages.length}P</span><div><small>{template.bestFor}</small><h5>{template.name}</h5><p>{template.description}</p><footer><span>{template.form.pages.length} pages - {fields} questions</span><button type="button" onClick={() => applyTemplate(template)}>Use template</button></footer></div></article>;
          })}</div>
        </section>
      ) : null}

      <div className="staff-form-builder__multipage-workspace">
        <aside className="staff-form-pages" aria-label="Form pages">
          <header><div><span>Form outline</span><strong>Student pages</strong></div><button type="button" onClick={addPage}>+ Page</button></header>
          <ol>{form.pages.map((page, index) => <li key={page.id} className={page.id === activePage?.id ? "is-active" : undefined}><button type="button" onClick={() => setActivePageId(page.id)}><span>{String(index + 1).padStart(2, "0")}</span><span><strong>{page.title}</strong><small>{page.fields.length} questions</small></span></button><div><button type="button" aria-label={`Move ${page.title} up`} disabled={index === 0} onClick={() => movePage(page.id, -1)}>Up</button><button type="button" aria-label={`Move ${page.title} down`} disabled={index === form.pages.length - 1} onClick={() => movePage(page.id, 1)}>Down</button><button type="button" onClick={() => duplicatePage(page)}>Copy</button><button type="button" disabled={form.pages.length === 1} onClick={() => removePage(page.id)}>Delete</button></div></li>)}</ol>
          <button type="button" className="staff-form-pages__add" onClick={addPage}>+ Add another page</button>
        </aside>

        <div className="staff-form-page-editor">
          {activePage ? <>
            <header><div><p className="eyebrow">Page {activePageIndex + 1} of {form.pages.length}</p><h4>{activePage.title}</h4></div><code>{activePage.id}</code></header>
            <div className="staff-form-grid"><label>Page title<input value={activePage.title} maxLength={180} onChange={(event) => updatePage(activePage.id, { title: event.target.value })} /></label><label>Stable page key<input value={activePage.id} readOnly /></label></div>
            <label>Page introduction<textarea value={activePage.description ?? ""} maxLength={600} onChange={(event) => updatePage(activePage.id, { description: event.target.value })} /></label>
            <div className="staff-form-builder__palette" aria-label="Question field palette">{fieldTypeOptions.map((option) => <button key={option.value} type="button" onClick={() => addField(option.value)}><span aria-hidden="true">{option.symbol}</span><span><strong>{option.label}</strong><small>{option.description}</small></span></button>)}</div>
            <ol className="staff-form-builder__fields">{activePage.fields.map((field, index) => <li key={field.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", field.id); setDraggedId(field.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, field.id)} onDragEnd={() => setDraggedId(null)}>
              <div className="staff-form-builder__field-heading"><span className="staff-form-builder__handle" aria-hidden="true">::</span><span className="staff-form-builder__field-number">{String(index + 1).padStart(2, "0")}</span><span className="staff-form-builder__field-kind">{fieldTypeOptions.find((option) => option.value === field.field_type)?.label ?? field.field_type}</span><code title="Stable field key">{field.id}</code><div><button type="button" disabled={index === 0} onClick={() => moveField(field.id, -1)}>Up</button><button type="button" disabled={index === activePage.fields.length - 1} onClick={() => moveField(field.id, 1)}>Down</button><button type="button" onClick={() => duplicateField(field)}>Duplicate</button><button className="is-danger" type="button" onClick={() => updateFields(activePage.fields.filter((candidate) => candidate.id !== field.id))}>Delete</button></div></div>
              <div className="staff-form-grid"><label>Student-facing label<input value={field.title} maxLength={180} onChange={(event) => updateField(field.id, { title: event.target.value })} /></label><label>Input control<select value={field.field_type} onChange={(event) => { const fieldType = event.target.value as FormBuilderField["field_type"]; const choice = ["single_select", "multiple_select"].includes(fieldType); updateField(field.id, { field_type: fieldType, options: choice ? (field.options ?? ["Option 1", "Option 2"]) : undefined, maximum_selections: fieldType === "multiple_select" ? field.maximum_selections : undefined, minimum: fieldType === "number" ? field.minimum : undefined, maximum: fieldType === "number" ? field.maximum : undefined, step: fieldType === "number" ? field.step : undefined }); }}>{fieldTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
              {["single_select", "multiple_select"].includes(field.field_type) ? <label>Choices - one per line<textarea value={(field.options ?? []).join("\n")} onChange={(event) => updateField(field.id, { options: optionsFromText(event.target.value) })} /></label> : null}
              {field.field_type === "number" ? <div className="staff-form-grid staff-form-grid--numeric"><label>Minimum (optional)<input type="number" value={field.minimum ?? ""} onChange={(event) => updateField(field.id, { minimum: optionalNumber(event.target.value) })} /></label><label>Maximum (optional)<input type="number" value={field.maximum ?? ""} onChange={(event) => updateField(field.id, { maximum: optionalNumber(event.target.value) })} /></label><label>Step (optional)<input type="number" min="0" value={field.step ?? ""} onChange={(event) => updateField(field.id, { step: optionalNumber(event.target.value) })} /></label></div> : null}
              <label className="staff-checkbox"><input type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} />Required before the student can continue</label>
            </li>)}{activePage.fields.length === 0 ? <li className="staff-form-builder__empty">Add the first question for this page.</li> : null}</ol>
          </> : null}
        </div>

        <div className="staff-form-preview" aria-label="Student page preview">
          <div className="staff-form-preview__toolbar"><div><span className="staff-form-preview__status-dot" /><strong>Live student preview</strong></div><span>Desktop</span></div>
          <div className="staff-form-preview__device"><div className="staff-form-preview__student-bar"><span aria-hidden="true">A</span><strong>Student portal</strong><small>Preview</small></div><header><p>{screen.label}</p><h3>{screen.title || "Untitled student page"}</h3><span>{screen.description || "Add an introduction for students."}</span></header><div className="staff-form-preview__page-progress"><span>Step {activePageIndex + 1} of {form.pages.length}</span><div>{form.pages.map((page, index) => <i className={index <= activePageIndex ? "is-complete" : undefined} key={page.id} />)}</div></div><div className="staff-form-preview__card"><h4>{activePage?.title}</h4>{activePage?.description ? <p>{activePage.description}</p> : null}{activePage?.fields.map((field) => <FieldPreview key={field.id} field={field} />)}{activePage?.fields.length === 0 ? <p>No questions configured on this page yet.</p> : null}<div className="staff-form-preview__actions"><button type="button" disabled={activePageIndex === 0}>Back</button><button type="button">{activePageIndex === form.pages.length - 1 ? "Submit" : "Continue"}</button></div></div></div>
        </div>
      </div>
    </section>
  );
}
