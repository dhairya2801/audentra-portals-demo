"use client";

import type {
  AboutYouConfigurableField,
  JourneyRouteActivation,
  JourneyRouteOperator,
  JourneyRouteRule,
  StaffJourneyBlueprintItem,
  StaffManagedConfiguration,
} from "@vv/contracts";
import {
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useApiAction } from "../hooks/use-api-resource";
import { updateStaffManagedConfiguration } from "../lib/api-client";
import { useTenant } from "../components/tenant-provider";
import {
  createJourneyFlowId,
  createJourneyTaskId,
  dropJourneyTask,
  journeyGraphLevels,
  journeySuccessorIds,
  type JourneyFlowKind,
  type JourneyGraphPosition,
  type JourneyTaskType,
  moveJourneyTask,
  simplifyJourneyGraphLayout,
  submissionTypeForTask,
  validateJourneyDependencies,
} from "./journey-flow-model";
import {
  aboutYouDefaultForm,
  flattenFormDefinition,
  type FormBuilderDefinition,
  type FormBuilderField,
  FormCanvasBuilder,
  onePageForm,
  onboardingScreenDefaults,
  responsibleOfficeOptions,
} from "./onboarding-form-builder";
import {
  journeyScaffoldTemplates,
  type JourneyScaffoldTemplate,
} from "./journey-template-library";

type ManagedDocument = Record<string, unknown>;
type ManagedRecord = Record<string, unknown>;
type SignatureProvider = "built_in" | "docusign";

interface JourneyBuilderTask extends StaffJourneyBlueprintItem {
  activation: JourneyRouteActivation;
  active: boolean;
  selectionOptions: string[];
  maximumSelections: number | null;
  signatureProvider: SignatureProvider;
  signatureTemplateId: string | null;
  acceptedFileTypes: string[];
  documentCategories: string[];
  aboutYouRequiredFields: AboutYouConfigurableField[];
  identityQuickUpload: boolean;
  formDefinition: FormBuilderDefinition;
  screenLabel: string | null;
  screenTitle: string | null;
  screenDescription: string | null;
  priority: number;
  dueOffsetDays: number | null;
  canvasPosition: { x: number; y: number } | null;
}

const aboutYouFieldBindings: Partial<
  Record<FormBuilderField["id"], AboutYouConfigurableField>
> = {
  first_name: "firstName",
  last_name: "lastName",
  preferred_name: "preferredName",
  personal_email: "personalEmail",
  mobile_phone: "mobilePhone",
  citizenship_status: "citizenshipStatus",
  street_address: "streetAddress",
  city: "city",
  state_or_province: "stateOrProvince",
  postal_code: "postalCode",
  country: "country",
  residency_verification_path: "residencyVerificationPath",
};

const aboutYouFieldOptions: Array<{
  value: AboutYouConfigurableField;
  label: string;
}> = [
  { value: "firstName", label: "Legal first name" },
  { value: "lastName", label: "Legal last name" },
  { value: "preferredName", label: "Preferred name" },
  { value: "personalEmail", label: "Personal email" },
  { value: "mobilePhone", label: "Mobile number" },
  { value: "citizenshipStatus", label: "Citizenship / student status" },
  { value: "streetAddress", label: "Street address" },
  { value: "city", label: "City" },
  { value: "stateOrProvince", label: "State / province" },
  { value: "postalCode", label: "ZIP / postal code" },
  { value: "country", label: "Country" },
  { value: "residencyVerificationPath", label: "Residency verification choice" },
];

const defaultAboutYouRequiredFields: AboutYouConfigurableField[] = [
  "firstName",
  "lastName",
  "preferredName",
  "personalEmail",
  "mobilePhone",
  "citizenshipStatus",
];

const taskTypeOptions: Array<{
  value: JourneyTaskType;
  label: string;
  symbol: string;
  description: string;
}> = [
  { value: "approval", label: "Approval", symbol: "OK", description: "Confirm a decision or acknowledgement" },
  { value: "form", label: "Form", symbol: "FRM", description: "Collect structured student information" },
  { value: "single_select", label: "Single select", symbol: "1", description: "Choose one option" },
  { value: "multiple_select", label: "Multiple select", symbol: "N", description: "Choose several options" },
  { value: "upload_file", label: "File upload", symbol: "UP", description: "Request one or more documents" },
  { value: "signature", label: "E-signature", symbol: "SIG", description: "Review and sign a document" },
  { value: "payment", label: "Payment", symbol: "$", description: "Complete the enrollment deposit" },
  { value: "information", label: "Information", symbol: "i", description: "Show guidance with no submission" },
  { value: "selection_flow", label: "Guided choices", symbol: "FLOW", description: "Collect choices over several prompts" },
  { value: "scheduling", label: "Scheduling", symbol: "CAL", description: "Book an available appointment" },
];

function editableDocument(configuration: StaffManagedConfiguration) {
  const document = configuration.document;
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("The journey configuration is not an editable document.");
  }
  return structuredClone(document);
}

function flowRecords(document: ManagedDocument) {
  if (!Array.isArray(document.flows)) {
    throw new Error("The journey configuration has no flows collection.");
  }
  return document.flows as ManagedRecord[];
}

function taskRecords(flow: ManagedRecord) {
  if (!Array.isArray(flow.tasks)) flow.tasks = [];
  return flow.tasks as ManagedRecord[];
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function managedRecord(value: unknown): ManagedRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ManagedRecord)
    : null;
}

function configuredFormFields(value: unknown): FormBuilderField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const field = managedRecord(candidate);
    const id = String(field?.id ?? "").trim();
    const title = String(field?.title ?? "").trim();
    const fieldType = String(field?.field_type ?? "");
    if (
      !id ||
      !title ||
      ![
        "text",
        "email",
        "phone",
        "date",
        "number",
        "checkbox",
        "single_select",
        "multiple_select",
      ].includes(fieldType)
    ) {
      return [];
    }
    const when = managedRecord(field?.when);
    return [
      {
        id,
        title,
        field_type: fieldType as FormBuilderField["field_type"],
        required: field?.required === true,
        ...(Array.isArray(field?.options)
          ? { options: stringList(field.options) }
          : {}),
        ...(Number.isInteger(Number(field?.maximum_selections))
          ? { maximum_selections: Number(field?.maximum_selections) }
          : {}),
        ...(Number.isFinite(Number(field?.minimum))
          ? { minimum: Number(field?.minimum) }
          : {}),
        ...(Number.isFinite(Number(field?.maximum))
          ? { maximum: Number(field?.maximum) }
          : {}),
        ...(Number.isFinite(Number(field?.step)) && Number(field?.step) > 0
          ? { step: Number(field?.step) }
          : {}),
        ...(typeof when?.field === "string" && typeof when.equals === "string"
          ? { when: { field: when.field, equals: when.equals } }
          : {}),
      },
    ];
  });
}

function routeActivation(value: unknown): JourneyRouteActivation {
  const activation = managedRecord(value);
  const rules = Array.isArray(activation?.rules)
    ? activation.rules.flatMap((candidate) => {
        const rule = managedRecord(candidate);
        const sourceTaskId = String(
          rule?.sourceTaskId ?? rule?.source_task ?? "",
        ).trim();
        const fieldId = String(rule?.fieldId ?? rule?.field ?? "").trim();
        const operator = String(rule?.operator ?? "equals");
        const value = rule?.value;
        if (
          !sourceTaskId ||
          !fieldId ||
          ![
            "equals",
            "not_equals",
            "one_of",
            "none_of",
            "contains",
            "not_contains",
            "greater_than",
            "greater_than_or_equal",
            "less_than",
            "less_than_or_equal",
          ].includes(operator) ||
          !(
            typeof value === "string" ||
            typeof value === "boolean" ||
            (typeof value === "number" && Number.isFinite(value)) ||
            (Array.isArray(value) && value.every((item) => typeof item === "string"))
          )
        ) {
          return [];
        }
        return [
          {
            sourceTaskId,
            fieldId,
            operator: operator as JourneyRouteOperator,
            value,
          },
        ];
      })
    : [];
  return {
    match: activation?.match === "any" ? "any" : "all",
    rules,
  };
}

interface JourneyRouteAnswerField {
  id: string;
  label: string;
  fieldType: "checkbox" | "single_select" | "multiple_select" | "number";
  options: Array<string | boolean>;
  minimum?: number;
  maximum?: number;
}

function routeFieldsForTask(task: JourneyBuilderTask): JourneyRouteAnswerField[] {
  if (task.taskType === "single_select" || task.taskType === "multiple_select") {
    return [
      {
        id: "$answer",
        label: "Selected answer",
        fieldType: task.taskType,
        options: task.selectionOptions,
      },
    ];
  }
  if (task.taskType !== "form" && task.taskType !== "selection_flow") {
    return [];
  }
  return flattenFormDefinition(task.formDefinition).flatMap((field) => {
    if (
      field.field_type !== "checkbox" &&
      field.field_type !== "single_select" &&
      field.field_type !== "multiple_select" &&
      field.field_type !== "number"
    ) {
      return [];
    }
    if (field.field_type !== "checkbox" && !field.required) return [];
    return [
      {
        id: field.id,
        label: field.title,
        fieldType: field.field_type,
        options:
          field.field_type === "checkbox"
            ? [true, false]
            : field.field_type === "number"
              ? []
              : [...(field.options ?? [])],
        ...(field.minimum !== undefined ? { minimum: field.minimum } : {}),
        ...(field.maximum !== undefined ? { maximum: field.maximum } : {}),
      },
    ];
  });
}

function operatorForRouteField(
  field: JourneyRouteAnswerField,
): JourneyRouteOperator {
  if (field.fieldType === "multiple_select") return "contains";
  if (field.fieldType === "number") return "greater_than_or_equal";
  return "equals";
}

function operatorsForRouteField(field: JourneyRouteAnswerField) {
  if (field.fieldType === "multiple_select") {
    return [
      { value: "contains", label: "includes" },
      { value: "not_contains", label: "does not include" },
    ] satisfies Array<{ value: JourneyRouteOperator; label: string }>;
  }
  if (field.fieldType === "single_select") {
    return [
      { value: "equals", label: "case is" },
      { value: "one_of", label: "case is one of" },
      { value: "none_of", label: "default (none of)" },
      { value: "not_equals", label: "is not" },
    ] satisfies Array<{ value: JourneyRouteOperator; label: string }>;
  }
  if (field.fieldType === "number") {
    return [
      { value: "greater_than_or_equal", label: "is at least" },
      { value: "greater_than", label: "is greater than" },
      { value: "less_than_or_equal", label: "is at most" },
      { value: "less_than", label: "is less than" },
      { value: "equals", label: "equals" },
      { value: "not_equals", label: "does not equal" },
    ] satisfies Array<{ value: JourneyRouteOperator; label: string }>;
  }
  return [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
  ] satisfies Array<{ value: JourneyRouteOperator; label: string }>;
}

function defaultRouteValue(
  field: JourneyRouteAnswerField,
  operator: JourneyRouteOperator = operatorForRouteField(field),
): JourneyRouteRule["value"] {
  if (field.fieldType === "number") return field.minimum ?? 0;
  const first = field.options[0] ?? "";
  return operator === "one_of" || operator === "none_of" ? [String(first)] : first;
}

function routeRuleLabel(
  source: JourneyBuilderTask | undefined,
  rule: JourneyRouteRule,
) {
  const field = source
    ? routeFieldsForTask(source).find((candidate) => candidate.id === rule.fieldId)
    : undefined;
  const rawLabel = field?.label ?? rule.fieldId;
  const fieldLabel = rawLabel.length > 24 ? `${rawLabel.slice(0, 22)}…` : rawLabel;
  if (rule.operator === "none_of") {
    return "Default: other answers";
  }
  const operator = {
    not_equals: "is not",
    one_of: "is one of",
    contains: "includes",
    not_contains: "excludes",
    greater_than: ">",
    greater_than_or_equal: "≥",
    less_than: "<",
    less_than_or_equal: "≤",
    equals: "is",
  }[rule.operator];
  const value =
    typeof rule.value === "boolean"
      ? rule.value
        ? "Yes"
        : "No"
      : Array.isArray(rule.value)
        ? rule.value.join(" / ")
        : rule.value;
  return rule.operator === "one_of"
    ? `Cases: ${value}`
    : `${fieldLabel} ${operator} ${value}`;
}

function configuredFormDefinition(
  value: unknown,
  fallbackFields: FormBuilderField[],
  fallbackTitle: string,
): FormBuilderDefinition {
  const record = managedRecord(value);
  const rawPages = Array.isArray(record?.pages) ? record.pages : [];
  const pages = rawPages.flatMap((candidate) => {
    const page = managedRecord(candidate);
    const id = String(page?.id ?? "").trim();
    const title = String(page?.title ?? "").trim();
    if (!id || !title) return [];
    return [{
      id,
      title,
      ...(typeof page?.description === "string"
        ? { description: page.description }
        : {}),
      fields: configuredFormFields(page?.fields),
    }];
  });
  if (pages.length > 0) return { version: 1, pages };
  return onePageForm(fallbackFields, {
    id: "student_details",
    title: fallbackTitle || "Student details",
    description: "Complete the questions below.",
  });
}

function validateFormFields(fields: readonly FormBuilderField[]) {
  if (fields.length === 0) {
    throw new Error("Add at least one form question before publishing.");
  }
  const ids = new Set<string>();
  for (const field of fields) {
    if (!/^[a-z][a-z0-9_]{1,79}$/.test(field.id) || ids.has(field.id)) {
      throw new Error("Every form question needs a unique stable field key.");
    }
    ids.add(field.id);
    if (!field.title.trim()) {
      throw new Error("Every form question needs a student-facing label.");
    }
    if (["single_select", "multiple_select"].includes(field.field_type)) {
      const options = field.options ?? [];
      if (options.length < 2 || new Set(options).size !== options.length) {
        throw new Error(`${field.title} needs at least two unique choices.`);
      }
    }
  }
}

function validateFormDefinition(form: FormBuilderDefinition) {
  if (form.pages.length === 0 || form.pages.length > 20) {
    throw new Error("A form must contain between 1 and 20 pages.");
  }
  const pageIds = new Set<string>();
  const fieldIds = new Set<string>();
  for (const page of form.pages) {
    if (!/^[a-z][a-z0-9_]{1,79}$/.test(page.id) || pageIds.has(page.id)) {
      throw new Error("Every form page needs a unique stable page key.");
    }
    pageIds.add(page.id);
    if (!page.title.trim()) {
      throw new Error("Every form page needs a student-facing title.");
    }
    validateFormFields(page.fields);
    for (const field of page.fields) {
      if (fieldIds.has(field.id)) {
        throw new Error(`Question key ${field.id} is duplicated across form pages.`);
      }
      fieldIds.add(field.id);
    }
  }
}

function ResponsibleOfficeSelect({
  name = "owner",
  defaultValue,
}: {
  name?: string;
  defaultValue: string;
}) {
  const options = responsibleOfficeOptions.includes(
    defaultValue as (typeof responsibleOfficeOptions)[number],
  )
    ? responsibleOfficeOptions
    : [defaultValue, ...responsibleOfficeOptions];
  return (
    <label>
      Responsible office
      <select name={name} defaultValue={defaultValue} required>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      <small>Shown to students as the university team responsible for this step.</small>
    </label>
  );
}

function formList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function taskType(value: unknown): JourneyTaskType {
  return (
    taskTypeOptions.find((option) => option.value === value)?.value ??
    "information"
  );
}

function taskTypeLabel(value: JourneyTaskType) {
  return taskTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function taskTypeVisual(value: JourneyTaskType) {
  return (
    taskTypeOptions.find((option) => option.value === value) ??
    taskTypeOptions.find((option) => option.value === "information")!
  );
}

function studentInputPreview(task: JourneyBuilderTask) {
  if (task.taskType === "single_select" || task.taskType === "multiple_select") {
    const choices = task.selectionOptions.slice(0, 3);
    return {
      label: task.taskType === "single_select" ? "Choices" : "Multi-select choices",
      value: choices.length ? choices.join(" · ") : "No choices configured",
      remaining: Math.max(0, task.selectionOptions.length - choices.length),
    };
  }
  if (task.taskType === "form" || task.taskType === "selection_flow") {
    const fields = flattenFormDefinition(task.formDefinition);
    const labels = fields.slice(0, 2).map((field) => field.title);
    return {
      label: task.taskType === "form" ? "Student form" : "Guided questions",
      value: labels.length ? labels.join(" · ") : "No questions configured",
      remaining: Math.max(0, fields.length - labels.length),
    };
  }
  if (task.taskType === "upload_file") {
    return {
      label: "Files accepted",
      value: task.documentCategories.length
        ? task.documentCategories.slice(0, 3).join(" · ")
        : "Configure document categories",
      remaining: Math.max(0, task.documentCategories.length - 3),
    };
  }
  if (task.taskType === "signature") {
    return { label: "Student action", value: "Review and sign", remaining: 0 };
  }
  if (task.taskType === "payment") {
    return { label: "Student action", value: "Review payment details", remaining: 0 };
  }
  if (task.taskType === "scheduling") {
    return { label: "Student action", value: "Choose an available time", remaining: 0 };
  }
  return {
    label: "Student action",
    value: task.taskType === "approval" ? "Review and confirm" : "Read guidance",
    remaining: 0,
  };
}

function parsedTasks(
  configuration: StaffManagedConfiguration,
  kind: JourneyFlowKind,
) {
  const document = editableDocument(configuration);
  const result: JourneyBuilderTask[] = [];

  for (const flow of flowRecords(document)) {
    if (flow.kind !== kind || flow.status !== "published") continue;
    const flowId = String(flow.id ?? `${kind}_flow`);
    const flowTitle = String(flow.title ?? "Student journey");
    for (const [index, task] of taskRecords(flow).entries()) {
      const input = managedRecord(task.input) ?? {};
      const configuredType = taskType(task.task_type);
      const provider: SignatureProvider =
        (input.signatureProvider ??
          input.signature_provider ??
          task.signature_provider) === "docusign"
          ? "docusign"
          : "built_in";
      const maximumSelections = Number(
        input.maximumSelections ??
          input.maximum_selections ??
          task.maximum_selections,
      );
      result.push({
        id: String(task.id ?? `task_${index + 1}`),
        kind,
        flowId,
        flowTitle,
        title: String(task.title ?? "Untitled step"),
        description: String(task.description ?? ""),
        owner: String(task.owner ?? "Enrollment Services"),
        required: Boolean(task.required),
        published: flow.status === "published",
        active: task.active !== false,
        order: index + 1,
        taskType: configuredType,
        submissionType: submissionTypeForTask(configuredType),
        selectionOptions: stringList(input.options ?? task.options),
        maximumSelections:
          Number.isInteger(maximumSelections) && maximumSelections > 0
            ? maximumSelections
            : null,
        signatureProvider: provider,
        signatureTemplateId:
          typeof input.docusignTemplateId === "string"
            ? input.docusignTemplateId
            : typeof input.docusign_template_id === "string"
              ? input.docusign_template_id
              : typeof input.signatureTemplateId === "string"
                ? input.signatureTemplateId
                : typeof input.signature_template_id === "string"
                  ? input.signature_template_id
                  : typeof task.docusign_template_id === "string"
            ? task.docusign_template_id
            : typeof task.signature_template_id === "string"
              ? task.signature_template_id
              : null,
        acceptedFileTypes: stringList(
          input.acceptedMimeTypes ??
            input.accepted_mime_types ??
            input.acceptedFileTypes ??
            input.accepted_file_types ??
            task.accepted_mime_types ??
            task.accepted_file_types,
        ),
        documentCategories: stringList(
          input.documentCategories ??
            input.document_categories ??
            task.document_categories,
        ),
        aboutYouRequiredFields: (() => {
          const configured = stringList(
            input.required_fields ?? input.requiredFields,
          ).filter((field): field is AboutYouConfigurableField =>
            aboutYouFieldOptions.some((option) => option.value === field),
          );
          return configured.length > 0 || "required_fields" in input || "requiredFields" in input
            ? configured
            : defaultAboutYouRequiredFields;
        })(),
        identityQuickUpload:
          (input.identity_quick_upload ?? input.identityQuickUpload) !== false,
        formDefinition: configuredFormDefinition(
          input.form,
          configuredFormFields(
            configuredType === "selection_flow"
              ? task.flow ?? input.flow
              : input.fields,
          ),
          String(task.title ?? "Student details"),
        ),
        screenLabel:
          typeof input.screen_label === "string" ? input.screen_label : null,
        screenTitle:
          typeof input.screen_title === "string" ? input.screen_title : null,
        screenDescription:
          typeof input.screen_description === "string"
            ? input.screen_description
            : null,
        points: Number.isFinite(Number(task.points)) ? Number(task.points) : 0,
        priority: Number.isInteger(Number(task.priority))
          ? Math.min(100, Math.max(0, Number(task.priority)))
          : 0,
        dueOffsetDays: Number.isInteger(Number(task.due_days_after_acceptance))
          ? Number(task.due_days_after_acceptance)
          : null,
        canvasPosition: (() => {
          const position = managedRecord(task.editor_position);
          const x = Number(position?.x);
          const y = Number(position?.y);
          return Number.isFinite(x) && Number.isFinite(y)
            ? { x: Math.max(0, x), y: Math.max(0, y) }
            : null;
        })(),
        studentStep:
          typeof task.student_step === "string" ? task.student_step : null,
        dependsOn: stringList(task.depends_on),
        activation: routeActivation(task.activation),
        flow: Array.isArray(task.flow ?? input.flow)
          ? (structuredClone(task.flow ?? input.flow) as JourneyBuilderTask["flow"])
          : [],
        configurationVersion: configuration.version,
      });
    }
  }

  return result;
}

function findFlow(document: ManagedDocument, flowId: string) {
  return flowRecords(document).find((flow) => flow.id === flowId);
}

function findTask(document: ManagedDocument, item: JourneyBuilderTask) {
  const flow = findFlow(document, item.flowId);
  const task = flow
    ? taskRecords(flow).find((candidate) => candidate.id === item.id)
    : undefined;
  return { flow, task };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function JourneyTemplateGallery({
  kind,
  tasks,
  busy,
  onApply,
  onClose,
}: {
  kind: JourneyFlowKind;
  tasks: JourneyBuilderTask[];
  busy: boolean;
  onApply: (template: JourneyScaffoldTemplate, startAfterId: string | null) => void;
  onClose: () => void;
}) {
  const templates = journeyScaffoldTemplates.filter((template) => template.kind === kind);
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [startAfterId, setStartAfterId] = useState("");
  const selectedTemplate = templates.find((template) => template.id === selectedId) ?? templates[0];
  const attachableTasks = tasks.filter((task) => task.active && !task.studentStep);

  return (
    <div className="staff-template-backdrop">
      <section className="staff-journey-templates" role="dialog" aria-modal="true" aria-labelledby="journey-template-title">
        <header>
          <div><p className="eyebrow">Journey template library</p><h2 id="journey-template-title">Start from a proven scaffold</h2><p>Templates add editable steps to the current journey in one published version. Existing steps and completed student work stay untouched.</p></div>
          <button type="button" aria-label="Close journey templates" onClick={onClose}>Close</button>
        </header>
        <div className="staff-journey-templates__body">
          <nav aria-label="Journey templates">
            {templates.map((template) => (
              <button className={template.id === selectedTemplate?.id ? "is-active" : undefined} type="button" key={template.id} onClick={() => setSelectedId(template.id)}>
                <span>{String(template.tasks.length).padStart(2, "0")}</span>
                <span><small>{template.bestFor}</small><strong>{template.name}</strong><p>{template.description}</p></span>
              </button>
            ))}
          </nav>
          {selectedTemplate ? (
            <article className="staff-journey-template-preview">
              <header><div><span>Template preview</span><h3>{selectedTemplate.name}</h3><p>{selectedTemplate.outcome}</p></div><span>{selectedTemplate.tasks.length} steps</span></header>
              <ol>
                {selectedTemplate.tasks.map((task, index) => {
                  const routeLabels = task.activation?.rules.map((rule) => {
                    const source = selectedTemplate.tasks.find(
                      (candidate) => candidate.key === rule.sourceKey,
                    );
                    const valueLabel =
                      typeof rule.value === "boolean"
                        ? rule.value
                          ? "Yes"
                          : "No"
                        : Array.isArray(rule.value)
                          ? rule.value.join(" / ")
                          : rule.value;
                    if (rule.operator === "none_of") {
                      return `${source?.title ?? rule.sourceKey}: default (any other answer)`;
                    }
                    const operatorLabel = {
                      equals: "is",
                      not_equals: "is not",
                      one_of: "is one of",
                      contains: "includes",
                      not_contains: "does not include",
                      greater_than: ">",
                      greater_than_or_equal: "≥",
                      less_than: "<",
                      less_than_or_equal: "≤",
                    }[rule.operator];
                    return `${source?.title ?? rule.sourceKey} ${operatorLabel} ${valueLabel}`;
                  });
                  return (
                    <li key={task.key}>
                      <span>{taskTypeVisual(task.taskType).symbol}</span>
                      <div><small>{index + 1}. {taskTypeLabel(task.taskType)} - {task.owner}</small><strong>{task.title}</strong><p>{task.description}</p><span>{task.dependsOn.length === 0 ? "Entry step" : `After ${task.dependsOn.join(", ")}`}</span>{routeLabels?.length ? <span className="staff-journey-template-preview__route">Only when {routeLabels.join(task.activation?.match === "any" ? " or " : " and ")}</span> : null}</div>
                    </li>
                  );
                })}
              </ol>
              <label>
                Connect template entry steps after
                <select value={startAfterId} onChange={(event) => setStartAfterId(event.target.value)}>
                  <option value="">Start as an independent branch</option>
                  {attachableTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                </select>
                <small>Internal template dependencies are connected automatically and validated for cycles.</small>
              </label>
              <footer><button className="button button--secondary" type="button" onClick={onClose}>Cancel</button><button className="button button--primary" type="button" disabled={busy} onClick={() => onApply(selectedTemplate, startAfterId || null)}>{busy ? "Publishing scaffold..." : "Add template to journey"}</button></footer>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function JourneyStageMap({
  tasks,
  currentKind,
  onSelect,
  onAdd,
  busy,
}: {
  tasks: JourneyBuilderTask[];
  currentKind: JourneyFlowKind;
  onSelect: (item: JourneyBuilderTask) => void;
  onAdd: () => void;
  busy: boolean;
}) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const levels = journeyGraphLevels(tasks);
  const graphError = validateJourneyDependencies(tasks);
  const activeCount = tasks.filter((task) => task.active).length;
  const branchCount = tasks.filter(
    (task) => journeySuccessorIds(tasks, task.id).length > 1,
  ).length;

  return (
    <section className="staff-journey-map staff-journey-canvas" aria-labelledby="journey-map-title">
      <header className="staff-journey-map__heading">
        <div>
          <p className="eyebrow">Visual workflow</p>
          <h3 id="journey-map-title">How the student journey unfolds</h3>
          <p>
            Read left to right. Each lane is an unlock stage; select any card to
            edit its student experience, rules, or prerequisites.
          </p>
        </div>
        <div className="staff-journey-map__summary" aria-label="Workflow summary">
          <span><strong>{tasks.length}</strong> steps</span>
          <span><strong>{activeCount}</strong> live</span>
          <span><strong>{branchCount}</strong> branches</span>
        </div>
      </header>
      {graphError ? (
        <p className="field-error staff-journey-map__error" role="alert">
          {graphError}
        </p>
      ) : null}
      <div className="staff-journey-map__legend" aria-label="Workflow legend">
        <span><i className="is-live" /> Live step</span>
        <span><i className="is-system" /> Protected system screen</span>
        <span><i className="is-external" /> Cross-journey prerequisite</span>
        <span><i className="is-inactive" /> Inactive</span>
      </div>
      <div className="staff-journey-map__viewport">
        <div className="staff-journey-map__levels">
          {levels.map((taskIds, levelIndex) => (
            <section className="staff-journey-map__level" key={taskIds.join(":")}>
              <header className="staff-journey-map__stage">
                <span>{String(levelIndex + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{levelIndex === 0 ? "Entry" : `Stage ${levelIndex + 1}`}</strong>
                  <small>{taskIds.length} {taskIds.length === 1 ? "step" : "parallel steps"}</small>
                </div>
              </header>
              <div className="staff-journey-map__nodes">
                {taskIds.map((taskId) => {
                  const task = taskById.get(taskId);
                  if (!task) return null;
                  const successorIds = journeySuccessorIds(tasks, task.id);
                  const visual = taskTypeVisual(task.taskType);
                  const external = task.kind !== currentKind;
                  return (
                    <button
                      className={[
                        "staff-journey-map__node",
                        task.active ? "" : "is-inactive",
                        task.studentStep ? "is-system" : "",
                        external ? "is-external" : "",
                      ].filter(Boolean).join(" ")}
                      type="button"
                      onClick={() => onSelect(task)}
                      key={task.id}
                    >
                      <span className="staff-journey-map__node-topline">
                        <span className="staff-journey-map__type" aria-hidden="true">{visual.symbol}</span>
                        <span>{visual.label}</span>
                        <i aria-label={task.active ? "Live" : "Inactive"} />
                      </span>
                      <strong>{task.title}</strong>
                      <span className="staff-journey-map__owner">{task.owner}</span>
                      <span className="staff-journey-map__node-meta">
                        <small>{task.required ? "Required" : "Optional"}</small>
                        <small>{task.points} pts</small>
                        {external ? <small>{task.kind}</small> : null}
                      </span>
                      <span className="staff-journey-map__relationship">
                        {task.dependsOn.length === 0
                          ? "Starts independently"
                          : `Waits for ${task.dependsOn.length}`}
                        <span aria-hidden="true">→</span>
                        {successorIds.length === 0
                          ? "Journey end"
                          : `Unlocks ${successorIds.length}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <section className="staff-journey-map__level staff-journey-map__level--add">
            <header className="staff-journey-map__stage">
              <span>+</span>
              <div><strong>Extend flow</strong><small>Add another student step</small></div>
            </header>
            <button type="button" className="staff-journey-map__add-node" onClick={onAdd} disabled={busy}>
              <span aria-hidden="true">+</span>
              <strong>Add a step</strong>
              <small>Choose an action, build its form, then connect it to the flow.</small>
            </button>
          </section>
        </div>
      </div>
    </section>
  );
}

interface JourneyGraphEdgeRoute {
  key: string;
  sourceId: string;
  targetId: string;
  path: string;
  labelX: number;
  labelY: number;
}

const graphNodeWidth = 282;
const graphNodePortY = 78;

function centeredAttachment(index: number, count: number) {
  return (index - (count - 1) / 2) * 14;
}

/** Route every connector through an empty inter-rank channel or a dedicated
 * express lane below the graph. Fan-in/fan-out offsets keep arrow segments
 * distinct all the way to node boundaries. */
function journeyGraphEdgeRoutes(
  tasks: JourneyBuilderTask[],
  positions: Record<string, JourneyGraphPosition>,
  nodeBottom: number,
): JourneyGraphEdgeRoute[] {
  const edges = tasks.flatMap((target) =>
    target.dependsOn.map((sourceId) => ({
      key: `${sourceId}:${target.id}`,
      sourceId,
      targetId: target.id,
    })),
  );
  const outgoing = new Map<string, typeof edges>();
  const incoming = new Map<string, typeof edges>();
  for (const edge of edges) {
    outgoing.set(edge.sourceId, [...(outgoing.get(edge.sourceId) ?? []), edge]);
    incoming.set(edge.targetId, [...(incoming.get(edge.targetId) ?? []), edge]);
  }
  for (const group of outgoing.values()) {
    group.sort(
      (left, right) =>
        (positions[left.targetId]?.y ?? 0) - (positions[right.targetId]?.y ?? 0),
    );
  }
  for (const group of incoming.values()) {
    group.sort(
      (left, right) =>
        (positions[left.sourceId]?.y ?? 0) - (positions[right.sourceId]?.y ?? 0),
    );
  }
  const longEdges = edges.filter((edge) => {
    const source = positions[edge.sourceId];
    const target = positions[edge.targetId];
    return source && target && target.x - (source.x + graphNodeWidth) > 300;
  });
  const adjacentGroups = new Map<string, typeof edges>();
  for (const edge of edges) {
    const source = positions[edge.sourceId];
    const target = positions[edge.targetId];
    if (!source || !target) continue;
    const key = `${source.x}:${target.x}`;
    adjacentGroups.set(key, [...(adjacentGroups.get(key) ?? []), edge]);
  }

  return edges.flatMap((edge) => {
    const source = positions[edge.sourceId];
    const target = positions[edge.targetId];
    if (!source || !target) return [];
    const outgoingGroup = outgoing.get(edge.sourceId) ?? [edge];
    const incomingGroup = incoming.get(edge.targetId) ?? [edge];
    const startX = source.x + graphNodeWidth;
    const startY =
      source.y +
      graphNodePortY +
      centeredAttachment(outgoingGroup.findIndex((item) => item.key === edge.key), outgoingGroup.length);
    const endX = target.x;
    const endY =
      target.y +
      graphNodePortY +
      centeredAttachment(incomingGroup.findIndex((item) => item.key === edge.key), incomingGroup.length);
    const longIndex = longEdges.findIndex((item) => item.key === edge.key);
    if (longIndex >= 0 || endX <= startX + 50) {
      const laneIndex = longIndex >= 0 ? longIndex : longEdges.length + edges.indexOf(edge);
      const laneY = nodeBottom + 46 + laneIndex * 24;
      const sourceChannel = startX + 34;
      const targetChannel = endX - 34;
      return [{
        ...edge,
        path: `M ${startX} ${startY} H ${sourceChannel} V ${laneY} H ${targetChannel} V ${endY} H ${endX}`,
        labelX: (sourceChannel + targetChannel) / 2,
        labelY: laneY - 7,
      }];
    }
    const gapKey = `${source.x}:${target.x}`;
    const gapGroup = adjacentGroups.get(gapKey) ?? [edge];
    const gapIndex = gapGroup.findIndex((item) => item.key === edge.key);
    const channelX =
      (startX + endX) / 2 + centeredAttachment(gapIndex, gapGroup.length) * 0.75;
    return [{
      ...edge,
      path: `M ${startX} ${startY} H ${channelX} V ${endY} H ${endX}`,
      labelX: channelX,
      labelY: (startY + endY) / 2 - 8,
    }];
  });
}

function JourneyDependencyMap({
  tasks,
  currentKind,
  onSelect,
  onAdd,
  onConnect,
  onSaveLayout,
  busy,
}: {
  tasks: JourneyBuilderTask[];
  currentKind: JourneyFlowKind;
  onSelect: (item: JourneyBuilderTask) => void;
  onAdd: () => void;
  onConnect: (sourceId: string, targetId: string) => Promise<void>;
  onSaveLayout: (positions: Record<string, { x: number; y: number }>) => Promise<void>;
  busy: boolean;
}) {
  const automatic = useMemo(() => simplifyJourneyGraphLayout(tasks), [tasks]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    () => Object.fromEntries(tasks.map((task) => [task.id, task.canvasPosition ?? automatic[task.id]])),
  );
  const [zoom, setZoom] = useState(1);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [canvasMode, setCanvasMode] = useState<"select" | "pan">("select");
  const viewportRef = useRef<HTMLDivElement>(null);
  const [panning, setPanning] = useState<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const graphError = validateJourneyDependencies(tasks);
  const activeCount = tasks.filter((task) => task.active).length;
  const branchCount = tasks.filter((task) => journeySuccessorIds(tasks, task.id).length > 1).length;
  const conditionalPathCount = tasks.reduce(
    (count, task) => count + routeActivation(task.activation).rules.length,
    0,
  );

  const canvasWidth = Math.max(1000, ...Object.values(positions).map((position) => position.x + 380));
  const nodeBottom = Math.max(360, ...Object.values(positions).map((position) => position.y + 208));
  const routedEdges = journeyGraphEdgeRoutes(tasks, positions, nodeBottom);
  const canvasHeight = Math.max(
    620,
    nodeBottom + 100,
    ...routedEdges.map((edge) => edge.labelY + 80),
  );
  const resetLayout = () => {
    setPositions(automatic);
    setLayoutDirty(true);
  };
  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const middleMouse = event.button === 1;
    if (canvasMode !== "pan" && !middleMouse) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a, [data-journey-node]")) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    if (middleMouse) setCanvasMode("pan");
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    });
  };
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panning || panning.pointerId !== event.pointerId) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    viewport.scrollLeft = panning.scrollLeft - (event.clientX - panning.startX);
    viewport.scrollTop = panning.scrollTop - (event.clientY - panning.startY);
  };
  const stopPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panning || panning.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPanning(null);
  };
  const zoomWithWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (canvasMode !== "pan") return;
    event.preventDefault();
    const adjustment = event.deltaY < 0 ? 0.1 : -0.1;
    setZoom((current) => Math.max(0.6, Math.min(1.6, Math.round((current + adjustment) * 100) / 100)));
  };

  return (
    <section className="staff-journey-map staff-journey-canvas staff-journey-graph" aria-labelledby="journey-map-title">
      <header className="staff-journey-map__heading">
        <div><p className="eyebrow">Visual workflow editor</p><h3 id="journey-map-title">Build the journey as a connected graph</h3><p>Connect prerequisites, then open a target step to turn an edge into an answer-driven path such as Yes or No.</p></div>
        <div className="staff-journey-map__summary" aria-label="Workflow summary"><span><strong>{tasks.length}</strong> steps</span><span><strong>{activeCount}</strong> live</span><span><strong>{branchCount}</strong> branches</span><span><strong>{conditionalPathCount}</strong> conditional</span></div>
      </header>
      {graphError ? <p className="field-error staff-journey-map__error" role="alert">{graphError}</p> : null}
      <div className="staff-journey-graph__toolbar">
        <div className="staff-journey-map__legend" aria-label="Workflow legend"><span><i className="is-live" /> Live</span><span><i className="is-conditional" /> Answer path</span><span><i className="is-system" /> Protected</span><span><i className="is-external" /> Other journey</span><span><i className="is-inactive" /> Inactive</span></div>
        <div className="staff-journey-graph__canvas-tools" role="group" aria-label="Canvas controls">
          <span className="staff-journey-graph__tool-label">Canvas</span>
          <button type="button" className={canvasMode === "select" ? "is-active" : undefined} aria-pressed={canvasMode === "select"} onClick={() => setCanvasMode("select")} title="Pointer: click a step to edit it; use its Drag control to reposition it">⌖ Pointer</button>
          <button type="button" className={canvasMode === "pan" ? "is-active" : undefined} aria-pressed={canvasMode === "pan"} onClick={() => setCanvasMode("pan")} title="Hand: drag empty space to move around the graph, then use your mouse wheel to zoom">✋ Hand</button>
          <span className="staff-journey-graph__tool-help">{canvasMode === "pan" ? "Drag empty space · wheel zooms" : "Click a step to configure it · middle mouse switches to Hand"}</span>
        </div>
        <div><button type="button" onClick={() => setZoom((current) => Math.max(.6, current - .1))} aria-label="Zoom out">-</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((current) => Math.min(1.6, current + .1))} aria-label="Zoom in">+</button><button type="button" onClick={resetLayout} title="Re-rank steps, reduce crossings, and route connectors through clear lanes">Simplify layout</button><button type="button" disabled={!layoutDirty || busy} onClick={() => void onSaveLayout(positions).then(() => setLayoutDirty(false)).catch(() => undefined)}>{busy ? "Saving..." : "Save layout"}</button></div>
      </div>
      {connectionSource ? <div className="staff-journey-graph__connection-mode" role="status"><span>Connecting from <strong>{taskById.get(connectionSource)?.title}</strong>. Choose an input port.</span><button type="button" onClick={() => setConnectionSource(null)}>Cancel connection</button></div> : null}
      <div
        className={`staff-journey-map__viewport staff-journey-graph__viewport ${canvasMode === "pan" ? "is-pan-ready" : ""} ${panning ? "is-panning" : ""}`}
        ref={viewportRef}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
        onWheel={zoomWithWheel}
        aria-label="Journey graph canvas"
      >
        <div className="staff-journey-graph__scaled" style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}>
          <div className="staff-journey-graph__surface" style={{ width: canvasWidth, height: canvasHeight, transform: `scale(${zoom})` }}>
            <svg className="staff-journey-graph__edges" width={canvasWidth} height={canvasHeight} aria-hidden="true">
              <defs>
                <marker id={`journey-arrow-${currentKind}`} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" /></marker>
                <marker className="is-conditional" id={`journey-conditional-arrow-${currentKind}`} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" /></marker>
              </defs>
              {routedEdges.map((edge) => {
                const task = taskById.get(edge.targetId);
                if (!task) return null;
                const dependency = edge.sourceId;
                const activation = routeActivation(task.activation);
                const routeRules = activation.rules.filter(
                  (rule) => rule.sourceTaskId === dependency,
                );
                const edgeLabel = routeRules
                  .map((rule) => routeRuleLabel(taskById.get(dependency), rule))
                  .join(activation.match === "any" ? " OR " : " AND ");
                return (
                  <g
                    className={routeRules.length > 0 ? "is-conditional" : undefined}
                    key={edge.key}
                  >
                    <path
                      d={edge.path}
                      markerEnd={`url(#${routeRules.length > 0 ? "journey-conditional-arrow" : "journey-arrow"}-${currentKind})`}
                    />
                    {edgeLabel ? (
                      <text
                        x={edge.labelX}
                        y={edge.labelY}
                        textAnchor="middle"
                      >
                        {edgeLabel}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
            {tasks.map((task) => {
              const position = positions[task.id] ?? automatic[task.id];
              const successorIds = journeySuccessorIds(tasks, task.id);
              const visual = taskTypeVisual(task.taskType);
              const external = task.kind !== currentKind;
              const decisionOutputs = tasks.reduce(
                (count, target) =>
                  count + routeActivation(target.activation).rules.filter(
                    (rule) => rule.sourceTaskId === task.id,
                  ).length,
                0,
              );
              const targetConnectable = !external && !task.studentStep && connectionSource !== task.id;
              const inputPreview = studentInputPreview(task);
              return (
                <article data-journey-node className={["staff-journey-graph__node", task.active ? "" : "is-inactive", task.studentStep ? "is-system" : "", external ? "is-external" : "", connectionSource === task.id ? "is-connecting" : ""].filter(Boolean).join(" ")} style={{ transform: `translate(${position.x}px, ${position.y}px)` }} key={task.id}>
                  <button className="staff-journey-graph__port staff-journey-graph__port--input" type="button" aria-label={`Connect prerequisite into ${task.title}`} disabled={!connectionSource || !targetConnectable || busy} onClick={() => { if (!connectionSource) return; const source = connectionSource; setConnectionSource(null); void onConnect(source, task.id).catch(() => undefined); }} />
                  <button className="staff-journey-graph__drag" type="button" aria-label={`Drag ${task.title}`} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setDragging({ id: task.id, startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y }); }} onPointerMove={(event) => { event.stopPropagation(); if (dragging?.id !== task.id) return; setPositions((current) => ({ ...current, [task.id]: { x: Math.max(20, dragging.originX + (event.clientX - dragging.startX) / zoom), y: Math.max(20, dragging.originY + (event.clientY - dragging.startY) / zoom) } })); }} onPointerUp={(event) => { event.stopPropagation(); if (dragging?.id !== task.id) return; event.currentTarget.releasePointerCapture(event.pointerId); setDragging(null); setLayoutDirty(true); }}>Drag</button>
                  <button className="staff-journey-graph__node-body" type="button" onClick={() => onSelect(task)}><span className="staff-journey-map__node-topline"><span className="staff-journey-map__type" aria-hidden="true">{visual.symbol}</span><span>{visual.label}</span><i aria-label={task.active ? "Live" : "Inactive"} /></span><strong>{task.title}</strong><span className="staff-journey-map__owner">{task.owner}</span><span className="staff-journey-graph__node-input"><small>{inputPreview.label}</small><span>{inputPreview.value}{inputPreview.remaining > 0 ? ` +${inputPreview.remaining}` : ""}</span></span><span className="staff-journey-map__node-meta"><small>{task.required ? "Required" : "Optional"}</small><small>{task.points} pts</small>{decisionOutputs > 0 ? <small className="is-decision">Decision</small> : null}{external ? <small>{task.kind}</small> : null}</span><span className="staff-journey-map__relationship">{task.dependsOn.length === 0 ? "Entry" : `${task.dependsOn.length} inputs`}<span aria-hidden="true">-&gt;</span>{successorIds.length === 0 ? "End" : `${successorIds.length} outputs`}</span></button>
                  <button className="staff-journey-graph__port staff-journey-graph__port--output" type="button" aria-label={`Start a connection from ${task.title}`} disabled={!task.active || busy} onClick={() => setConnectionSource((current) => current === task.id ? null : task.id)} />
                </article>
              );
            })}
            <button type="button" className="staff-journey-graph__add" style={{ transform: `translate(${canvasWidth - 260}px, ${canvasHeight - 130}px)` }} onClick={onAdd} disabled={busy}><span>+</span><strong>Add step</strong><small>Configure a new node</small></button>
          </div>
        </div>
      </div>
      <p className="staff-journey-graph__hint">Canvas positions publish only when you choose Save layout. Connections publish immediately as versioned journey changes.</p>
      <details className="staff-journey-graph__stage-summary"><summary>View stage-by-stage summary</summary><JourneyStageMap tasks={tasks} currentKind={currentKind} onSelect={onSelect} onAdd={onAdd} busy={busy} /></details>
    </section>
  );
}

function JourneyTaskEditor({
  item,
  isNew,
  dependencyTasks,
  configuration,
  onConfigurationSaved,
  onClose,
}: {
  item: JourneyBuilderTask;
  isNew: boolean;
  dependencyTasks: JourneyBuilderTask[];
  configuration: StaffManagedConfiguration;
  onConfigurationSaved: (configuration: StaffManagedConfiguration) => void;
  onClose: () => void;
}) {
  type EditorSection = "details" | "experience" | "dependencies" | "publishing";
  const { tenant } = useTenant();
  const action = useApiAction(updateStaffManagedConfiguration);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [configuredTaskType, setConfiguredTaskType] = useState(item.taskType);
  const [activeEditorSection, setActiveEditorSection] = useState<EditorSection>(() => {
    // System onboarding screens use the same compact editing rhythm as a
    // newly-added step. Their protected behavior remains obvious, without
    // dropping staff into a long, unrelated form.
    if (isNew || (item.kind === "onboarding" && item.studentStep)) {
      return "details";
    }
    return ["form", "selection_flow", "single_select", "multiple_select", "upload_file", "signature"].includes(item.taskType)
      ? "experience"
      : "details";
  });
  const [signatureProvider, setSignatureProvider] =
    useState<SignatureProvider>(item.signatureProvider);
  const screenDefaults = item.studentStep
    ? onboardingScreenDefaults[item.studentStep]
    : undefined;
  const [screenLabel, setScreenLabel] = useState(
    item.screenLabel ?? screenDefaults?.label ?? item.title,
  );
  const [screenTitle, setScreenTitle] = useState(
    item.screenTitle ??
      screenDefaults?.title.replaceAll("Aster", tenant.shortName) ??
      item.title,
  );
  const [screenDescription, setScreenDescription] = useState(
    item.screenDescription ??
      screenDefaults?.description.replaceAll("Aster", tenant.shortName) ??
      item.description,
  );
  const [formDefinition, setFormDefinition] = useState<FormBuilderDefinition>(() => {
    if (flattenFormDefinition(item.formDefinition).length > 0) {
      return structuredClone(item.formDefinition);
    }
    if (item.studentStep === "about_you") {
      const required = new Set(item.aboutYouRequiredFields);
      return {
        ...structuredClone(aboutYouDefaultForm),
        pages: structuredClone(aboutYouDefaultForm.pages).map((page) => ({
          ...page,
          fields: page.fields.map((field) => ({
            ...field,
            required: aboutYouFieldBindings[field.id]
              ? required.has(aboutYouFieldBindings[field.id]!)
              : field.required,
          })),
        })),
      };
    }
    return onePageForm([]);
  });
  const [selectedDependencies, setSelectedDependencies] = useState(
    () => new Set(item.dependsOn),
  );
  const [routeMatch, setRouteMatch] = useState<"all" | "any">(
    routeActivation(item.activation).match,
  );
  const [routeRules, setRouteRules] = useState<JourneyRouteRule[]>(() =>
    structuredClone(routeActivation(item.activation).rules),
  );
  const panelRef = useRef<HTMLElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const builtInOnboardingScreen = item.kind === "onboarding" && Boolean(item.studentStep);
  const dependencyCandidates = dependencyTasks.filter(
    (candidate) => candidate.id !== item.id && !candidate.studentStep,
  );
  const unavailableDependencies = [...selectedDependencies].filter(
    (dependency) => !dependencyTasks.some((candidate) => candidate.id === dependency),
  );
  const successorTasks = dependencyTasks.filter((candidate) =>
    candidate.dependsOn.includes(item.id),
  );
  const routeSourceTasks = dependencyTasks.filter(
    (candidate) =>
      selectedDependencies.has(candidate.id) &&
      routeFieldsForTask(candidate).length > 0,
  );
  const inputPreview = studentInputPreview({ ...item, taskType: configuredTaskType });

  const updateRouteRule = (
    index: number,
    update: (current: JourneyRouteRule) => JourneyRouteRule,
  ) => {
    setRouteRules((current) =>
      current.map((rule, ruleIndex) =>
        ruleIndex === index ? update(rule) : rule,
      ),
    );
  };

  const addRouteRule = () => {
    const source = routeSourceTasks[0];
    const field = source ? routeFieldsForTask(source)[0] : undefined;
    if (!source || !field) return;
    setRouteRules((current) => [
      ...current,
      {
        sourceTaskId: source.id,
        fieldId: field.id,
        operator: operatorForRouteField(field),
        value: defaultRouteValue(field),
      },
    ]);
  };

  useEffect(() => {
    const panel = panelRef.current;
    const focusFrame = window.requestAnimationFrame(() => panel?.focus());
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (
        event.shiftKey &&
        (activeElement === first || !panel.contains(activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyboard);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyboard);
    };
  }, [onClose]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditorError(null);
    const form = new FormData(event.currentTarget);

    try {
      const document = editableDocument(configuration);
      let { flow, task } = findTask(document, item);
      if (!flow && isNew) {
        flow = {
          id: item.flowId,
          title: item.flowTitle,
          kind: item.kind,
          status: "published",
          tasks: [],
        };
        flowRecords(document).push(flow);
      }
      if (!flow) throw new Error("This journey flow is no longer available.");
      if (!task && isNew) {
        task = { id: item.id };
        taskRecords(flow).push(task);
      }
      if (!task) throw new Error("This journey step is no longer available.");

      const title = String(form.get("title") ?? "").trim();
      const description = String(form.get("description") ?? "").trim();
      const selectedType = taskType(form.get("taskType"));
      const options = formList(form.get("options"));
      const dependencies = [...selectedDependencies].filter(
        (dependency) => dependency !== item.id,
      );
      const points = Number(form.get("points"));
      const priority = Number(form.get("priority"));
      const dueOffsetValue = String(form.get("dueOffsetDays") ?? "").trim();
      const dueOffsetDays = dueOffsetValue === "" ? null : Number(dueOffsetValue);

      if (!title || !description) {
        throw new Error("Step name and student instructions are required.");
      }
      if (!Number.isInteger(points) || points < 0 || points > 10_000) {
        throw new Error("Points must be a whole number between 0 and 10,000.");
      }
      if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
        throw new Error("Priority must be a whole number between 0 and 100.");
      }
      if (
        dueOffsetDays !== null &&
        (!Number.isInteger(dueOffsetDays) || dueOffsetDays < 0 || dueOffsetDays > 3_650)
      ) {
        throw new Error(
          "Due date offset must be blank or a whole number between 0 and 3,650.",
        );
      }
      const dependencyById = new Map(
        dependencyTasks.map((candidate) => [candidate.id, candidate]),
      );
      const unavailableDependency = dependencies.find(
        (dependency) => !dependencyById.has(dependency),
      );
      if (unavailableDependency) {
        throw new Error(
          `Dependency ${unavailableDependency} is no longer available. Clear it and try again.`,
        );
      }
      if (form.get("active") === "on") {
        const inactiveDependency = dependencies.find(
          (dependency) => dependencyById.get(dependency)?.active === false,
        );
        if (inactiveDependency) {
          throw new Error(
            `Activate ${dependencyById.get(inactiveDependency)?.title ?? inactiveDependency} before using it as a prerequisite.`,
          );
        }
      }
      for (const rule of routeRules) {
        if (!dependencies.includes(rule.sourceTaskId)) {
          throw new Error(
            "Every answer condition must use a selected prerequisite.",
          );
        }
        const source = dependencyById.get(rule.sourceTaskId);
        const field = source
          ? routeFieldsForTask(source).find(
              (candidate) => candidate.id === rule.fieldId,
            )
          : undefined;
        if (!source || !field) {
          throw new Error(
            "An answer condition references a question that is no longer available.",
          );
        }
        const operators = operatorsForRouteField(field).map(
          (operator) => operator.value,
        );
        if (!operators.includes(rule.operator)) {
          throw new Error(
            `Choose a valid comparison for ${source.title}: ${field.label}.`,
          );
        }
        if (field.fieldType === "number") {
          if (typeof rule.value !== "number" || !Number.isFinite(rule.value)) {
            throw new Error(
              `Enter a numeric threshold for ${source.title}: ${field.label}.`,
            );
          }
          if (
            (field.minimum !== undefined && rule.value < field.minimum) ||
            (field.maximum !== undefined && rule.value > field.maximum)
          ) {
            throw new Error(
              `Keep the threshold inside the published range for ${source.title}: ${field.label}.`,
            );
          }
        }
        const caseValues = Array.isArray(rule.value) ? rule.value : [rule.value];
        if (
          field.fieldType !== "number" &&
          (caseValues.length === 0 ||
            !caseValues.every((value) =>
              field.options.some((option) => option === value),
            ))
        ) {
          throw new Error(
            `Choose a published answer for ${source.title}: ${field.label}.`,
          );
        }
      }
      const candidateGraph = dependencyTasks
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => ({
          id: candidate.id,
          dependsOn: candidate.dependsOn,
        }));
      candidateGraph.push({ id: item.id, dependsOn: dependencies });
      const dependencyError = validateJourneyDependencies(candidateGraph);
      if (dependencyError) throw new Error(dependencyError);
      if (selectedType === "payment" && item.id !== "enrollment_deposit") {
        throw new Error(
          "Payment actions are only available for the built-in enrollment deposit step.",
        );
      }

      Object.assign(task, {
        id: item.id,
        title,
        description,
        owner: String(form.get("owner") ?? "").trim(),
        task_type: selectedType,
        submission_type: submissionTypeForTask(selectedType),
        points,
        priority,
        required: form.get("required") === "on",
        active: form.get("active") === "on",
        depends_on: dependencies,
      });
      if (routeRules.length > 0) {
        task.activation = {
          match: routeMatch,
          rules: routeRules.map((rule) => ({
            source_task: rule.sourceTaskId,
            field: rule.fieldId,
            operator: rule.operator,
            value: rule.value,
          })),
        };
      } else {
        delete task.activation;
      }
      if (dueOffsetDays === null) {
        delete task.due_days_after_acceptance;
      } else {
        task.due_days_after_acceptance = dueOffsetDays;
      }

      const existingInput = managedRecord(task.input) ?? {};
      task.input = existingInput;

      if (selectedType === "single_select" || selectedType === "multiple_select") {
        if (options.length < 2) {
          throw new Error("Selection steps need at least two options.");
        }
        if (new Set(options).size !== options.length) {
          throw new Error("Selection step options must be unique.");
        }
        task.options = options;
        if (selectedType === "multiple_select") {
          const maximum = Number(form.get("maximumSelections"));
          if (!Number.isInteger(maximum) || maximum < 1 || maximum > options.length) {
            throw new Error(
              "Maximum selections must be between 1 and the number of options.",
            );
          }
          task.maximum_selections = maximum;
        } else {
          delete task.maximum_selections;
        }
      } else {
        delete task.options;
        delete task.maximum_selections;
      }

      if (selectedType === "signature") {
        const provider = String(form.get("signatureProvider"));
        task.signature_provider = provider;
        const templateId = String(form.get("signatureTemplateId") ?? "").trim();
        if (provider === "docusign" && templateId) {
          task.docusign_template_id = templateId;
        } else {
          delete task.docusign_template_id;
        }
        delete task.signature_template_id;
      } else {
        delete task.signature_provider;
        delete task.docusign_template_id;
        delete task.signature_template_id;
      }

      if (selectedType === "upload_file") {
        const acceptedMimeTypes = formList(form.get("acceptedFileTypes"));
        if (acceptedMimeTypes.some((mimeType) => !mimeType.includes("/"))) {
          throw new Error(
            "Accepted file types must use MIME values such as application/pdf.",
          );
        }
        task.accepted_mime_types = acceptedMimeTypes;
        task.document_categories = formList(form.get("documentCategories"));
        delete task.accepted_file_types;
      } else {
        delete task.accepted_mime_types;
        delete task.accepted_file_types;
        delete task.document_categories;
      }

      if (selectedType === "selection_flow") {
        validateFormDefinition(formDefinition);
        task.flow = structuredClone(flattenFormDefinition(formDefinition));
      } else {
        delete task.flow;
      }

      const specializedForm = ["profile_verification", "housing_preference"].includes(
        item.id,
      );
      if (
        selectedType === "form" &&
        !specializedForm
      ) {
        validateFormDefinition(formDefinition);
        existingInput.form = structuredClone(formDefinition);
        existingInput.fields = structuredClone(flattenFormDefinition(formDefinition));
      } else if (selectedType === "selection_flow") {
        existingInput.form = structuredClone(formDefinition);
      } else if (selectedType !== "form") {
        delete existingInput.form;
        delete existingInput.fields;
      }

      for (const key of [
        "options",
        "maximum_selections",
        "maximumSelections",
        "flow",
        "signature_provider",
        "signatureProvider",
        "docusign_template_id",
        "signature_template_id",
        "docusignTemplateId",
        "signatureTemplateId",
        "accepted_mime_types",
        "accepted_file_types",
        "acceptedMimeTypes",
        "acceptedFileTypes",
        "document_categories",
        "documentCategories",
      ]) {
        delete existingInput[key];
      }
      if (Object.keys(existingInput).length === 0) {
        delete task.input;
      }

      const updatedConfiguration = await action.run("journeys", {
        expectedVersion: configuration.version,
        document,
        changeSummary: isNew
          ? `Added journey step ${title}.`
          : `Updated journey step ${item.title}.`,
      });
      onConfigurationSaved(updatedConfiguration);
      onClose();
    } catch (error) {
      setEditorError(errorMessage(error, "The journey step could not be saved."));
    }
  };

  const saveBuiltInScreen = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditorError(null);
    const form = new FormData(event.currentTarget);
    try {
      const document = editableDocument(configuration);
      const { task } = findTask(document, item);
      if (!task) throw new Error("This onboarding screen is no longer available.");
      const title = String(form.get("title") ?? "").trim();
      const owner = String(form.get("owner") ?? "").trim();
      if (
        !title ||
        !screenLabel.trim() ||
        !screenTitle.trim() ||
        !screenDescription.trim() ||
        !owner
      ) {
        throw new Error("The journey label, student page content, and responsible office are required.");
      }
      Object.assign(task, {
        title,
        description: screenDescription.trim(),
        owner,
        points: Number(form.get("points")),
      });
      const input = managedRecord(task.input) ?? {};
      input.screen_label = screenLabel.trim();
      input.screen_title = screenTitle.trim();
      input.screen_description = screenDescription.trim();
      if (item.studentStep === "about_you") {
        validateFormDefinition(formDefinition);
        const formFields = flattenFormDefinition(formDefinition);
        input.form = structuredClone(formDefinition);
        input.fields = structuredClone(formFields);
        input.required_fields = formFields.flatMap((field) => {
          const binding = aboutYouFieldBindings[field.id];
          return binding && field.required ? [binding] : [];
        });
        input.identity_quick_upload = form.get("identityQuickUpload") === "on";
        delete input.requiredFields;
        delete input.identityQuickUpload;
      }
      task.input = input;
      const updatedConfiguration = await action.run("journeys", {
        expectedVersion: configuration.version,
        document,
        changeSummary: `Updated onboarding screen ${item.title}.`,
      });
      onConfigurationSaved(updatedConfiguration);
      onClose();
    } catch (error) {
      setEditorError(
        errorMessage(error, "The onboarding screen could not be saved."),
      );
    }
  };

  const remove = async () => {
    setEditorError(null);
    try {
      const document = editableDocument(configuration);
      const { flow, task } = findTask(document, item);
      if (!flow || !task) {
        throw new Error("This journey step is no longer available.");
      }
      flow.tasks = taskRecords(flow).filter((candidate) => candidate.id !== item.id);
      for (const candidateFlow of flowRecords(document)) {
        for (const candidate of taskRecords(candidateFlow)) {
          if (Array.isArray(candidate.depends_on)) {
            candidate.depends_on = candidate.depends_on.filter(
              (dependency) => dependency !== item.id,
            );
          }
          const activation = managedRecord(candidate.activation);
          const activationRules = activation?.rules;
          if (activation && Array.isArray(activationRules)) {
            const remainingRules = activationRules.filter((rawRule) => {
              const rule = managedRecord(rawRule);
              return (
                String(rule?.source_task ?? rule?.sourceTaskId ?? "") !==
                item.id
              );
            });
            if (remainingRules.length === 0) delete candidate.activation;
            else activation.rules = remainingRules;
          }
        }
      }
      const updatedConfiguration = await action.run("journeys", {
        expectedVersion: configuration.version,
        document,
        changeSummary: `Deleted journey step ${item.title}.`,
      });
      onConfigurationSaved(updatedConfiguration);
      onClose();
    } catch (error) {
      setEditorError(errorMessage(error, "The journey step could not be deleted."));
    }
  };

  if (builtInOnboardingScreen) {
    return (
      <aside
        className="staff-editor-panel staff-journey-editor staff-journey-editor--built-in"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit built-in onboarding screen"
        tabIndex={-1}
      >
        <header>
          <div>
            <p className="eyebrow">Student onboarding screen</p>
            <h2>Edit {item.title}</h2>
          </div>
          <button type="button" aria-label="Close editor" onClick={onClose}>
            ×
          </button>
      </header>
      <form noValidate onSubmit={saveBuiltInScreen}>
          <div className="staff-journey-editor__hero">
            <span aria-hidden="true">{taskTypeVisual(item.taskType).symbol}</span>
            <div>
              <small>Protected onboarding screen</small>
              <strong>{item.title}</strong>
              <p>Edit the student-facing content without breaking its stable route contract.</p>
            </div>
            <button
              className="staff-journey-editor__input-preview"
              type="button"
              onClick={() =>
                setActiveEditorSection(
                  item.studentStep === "about_you" ? "dependencies" : "experience",
                )
              }
              title="Open the student-facing configuration"
            >
              <small>{item.studentStep === "about_you" ? "Student form" : "Student action"}</small>
              <strong>{inputPreview.value}{inputPreview.remaining > 0 ? ` +${inputPreview.remaining}` : ""}</strong>
              <span>{item.studentStep === "about_you" ? "Configure form →" : "View student page →"}</span>
            </button>
            <span className="is-system">System</span>
          </div>
          <nav className="staff-journey-editor__nav" aria-label="System step editor sections">
            <button type="button" className={activeEditorSection === "details" ? "is-active" : undefined} aria-pressed={activeEditorSection === "details"} onClick={() => setActiveEditorSection("details")}>01 Basics</button>
            <button type="button" className={activeEditorSection === "experience" ? "is-active" : undefined} aria-pressed={activeEditorSection === "experience"} onClick={() => setActiveEditorSection("experience")}>02 Student page</button>
            <button type="button" className={activeEditorSection === "dependencies" ? "is-active" : undefined} aria-pressed={activeEditorSection === "dependencies"} onClick={() => setActiveEditorSection("dependencies")}>{item.studentStep === "about_you" ? "03 Student form" : "03 System action"}</button>
            <button type="button" className={activeEditorSection === "publishing" ? "is-active" : undefined} aria-pressed={activeEditorSection === "publishing"} onClick={() => setActiveEditorSection("publishing")}>04 Publish</button>
          </nav>
          <section className="staff-journey-editor__section" hidden={activeEditorSection !== "details"}>
            <header>
              <span>01</span>
              <div><h3>System screen basics</h3><p>Keep the protected route stable while setting its staff label, owner, and reward.</p></div>
            </header>
          <div className="staff-journey-task-id">
            <span>Stable screen key</span>
            <code>{item.studentStep}</code>
          </div>
          <label>
            Journey list label
            <input name="title" defaultValue={item.title} required maxLength={180} />
            <small>Used by staff and in the student&apos;s progress navigation.</small>
          </label>
          <div className="staff-form-grid">
            <ResponsibleOfficeSelect defaultValue={item.owner} />
            <label>
              Points
              <input name="points" type="number" min="0" max="10000" defaultValue={item.points} required />
            </label>
          </div>
          </section>
          <section className="staff-journey-editor__section" hidden={activeEditorSection !== "experience"}>
            <header>
              <span>02</span>
              <div><h3>Student page</h3><p>Shape the exact heading and guidance the student sees on this stable screen.</p></div>
            </header>
            <label>
              Student page section label
              <input
                value={screenLabel}
                onChange={(event) => setScreenLabel(event.target.value)}
                required
                maxLength={80}
              />
            </label>
            <label>
              Student page heading
              <input
                value={screenTitle}
                onChange={(event) => setScreenTitle(event.target.value)}
                required
                maxLength={180}
              />
            </label>
            <label>
              Student page introduction
              <textarea
                className="staff-editor-panel__body"
                value={screenDescription}
                onChange={(event) => setScreenDescription(event.target.value)}
                required
                maxLength={1200}
              />
            </label>
          </section>
          <section className="staff-journey-editor__section" hidden={activeEditorSection !== "dependencies"}>
            {item.studentStep === "about_you" ? (
              <>
              <header>
                <span>03</span>
                <div><h3>Student form</h3><p>Arrange profile questions and preview the published page.</p></div>
              </header>
              <FormCanvasBuilder
                form={formDefinition}
                onChange={setFormDefinition}
                screen={{
                  label: screenLabel,
                  title: screenTitle,
                  description: screenDescription,
                }}
              />
              <section className="staff-type-configuration">
              <label className="staff-checkbox">
                <input
                  name="identityQuickUpload"
                  type="checkbox"
                  defaultChecked={item.identityQuickUpload}
                />
                Let students upload an ID to prefill available identity details
                  </label>
              </section>
              </>
            ) : (
              <>
                <header>
                  <span>03</span>
                  <div><h3>System action</h3><p>Make the student outcome clear without exposing the protected route implementation.</p></div>
                </header>
                <div className="staff-locked-setting" role="note">
                  <span>Student action</span>
                  <strong>{taskTypeLabel(item.taskType)}</strong>
                  <small>This route is system-managed. The student-facing page above is editable; payment, signing, and verification behavior remains protected.</small>
                </div>
              </>
            )}
          </section>
          <section className="staff-journey-editor__section" hidden={activeEditorSection !== "publishing"}>
            <header>
              <span>04</span>
              <div><h3>Ready to publish</h3><p>Review the scope of this change before it becomes available to students.</p></div>
            </header>
            <div className="staff-student-impact-note">
              This preview and the student page read the same published configuration.
              The stable screen key and its route contract remain protected.
            </div>
          </section>
          {editorError || action.message ? (
            <p className="field-error" role="alert">{editorError ?? action.message}</p>
          ) : null}
          <footer>
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit" disabled={action.status === "loading"}>
              {action.status === "loading" ? "Publishing..." : "Save and publish"}
            </button>
          </footer>
        </form>
      </aside>
    );
  }

  return (
    <aside
      className="staff-editor-panel staff-journey-editor"
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "Add journey step" : "Edit journey step"}
      tabIndex={-1}
    >
      <header>
        <div>
          <p className="eyebrow">Student journey</p>
          <h2>{isNew ? "Add a step" : `Edit ${item.title}`}</h2>
        </div>
        <button type="button" aria-label="Close editor" onClick={onClose}>
          ×
        </button>
      </header>
      <form noValidate onSubmit={save}>
        <div className="staff-journey-editor__hero">
          <span aria-hidden="true">{taskTypeVisual(configuredTaskType).symbol}</span>
          <div>
            <small>{item.kind === "onboarding" ? "Offer onboarding" : "Enrollment checklist"}</small>
            <strong>{item.title || "New journey step"}</strong>
            <p>{taskTypeVisual(configuredTaskType).description}</p>
          </div>
          <button
            className="staff-journey-editor__input-preview"
            type="button"
            onClick={() => setActiveEditorSection("experience")}
            title="Open the student input configuration"
          >
            <small>{inputPreview.label}</small>
            <strong>{inputPreview.value}{inputPreview.remaining > 0 ? ` +${inputPreview.remaining}` : ""}</strong>
            <span>Configure input →</span>
          </button>
          <span className={item.active ? "is-live" : "is-inactive"}>{item.active ? "Live" : "Inactive"}</span>
        </div>
        <nav className="staff-journey-editor__nav" aria-label="Step editor sections">
          <button type="button" className={activeEditorSection === "details" ? "is-active" : undefined} aria-pressed={activeEditorSection === "details"} onClick={() => setActiveEditorSection("details")}>01 Basics</button>
          <button type="button" className={activeEditorSection === "experience" ? "is-active" : undefined} aria-pressed={activeEditorSection === "experience"} onClick={() => setActiveEditorSection("experience")}>02 Student input</button>
          <button type="button" className={activeEditorSection === "dependencies" ? "is-active" : undefined} aria-pressed={activeEditorSection === "dependencies"} onClick={() => setActiveEditorSection("dependencies")}>03 Journey logic</button>
          <button type="button" className={activeEditorSection === "publishing" ? "is-active" : undefined} aria-pressed={activeEditorSection === "publishing"} onClick={() => setActiveEditorSection("publishing")}>04 Publish</button>
        </nav>
        <section
          className="staff-journey-editor__section"
          hidden={activeEditorSection !== "details"}
          id="journey-step-details"
        >
          <header>
            <span>01</span>
            <div><h3>Step details</h3><p>Name the step and define how it should be prioritized and owned.</p></div>
          </header>
        <div className="staff-journey-task-id">
          <span>Stable step ID</span>
          <code>{item.id}</code>
        </div>
        <label>
          Step name
          <input name="title" defaultValue={item.title} required maxLength={160} />
        </label>
        <label>
          Student instructions
          <textarea
            className="staff-editor-panel__body"
            name="description"
            defaultValue={item.description}
            required
            maxLength={1200}
          />
        </label>
        <div className="staff-form-grid">
          <label>
            Input / action type
            <select
              name="taskType"
              value={configuredTaskType}
              onChange={(event) => setConfiguredTaskType(taskType(event.target.value))}
            >
              {taskTypeOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={
                    option.value === "payment" && item.id !== "enrollment_deposit"
                  }
                >
                  {option.value === "payment"
                    ? "Payment (built-in enrollment deposit only)"
                    : option.label}
                </option>
              ))}
            </select>
            <small>
              Submission maps automatically to {submissionTypeForTask(configuredTaskType)}.
            </small>
          </label>
          <ResponsibleOfficeSelect defaultValue={item.owner} />
          <label>
            Points
            <input
              name="points"
              type="number"
              min="0"
              max="10000"
              defaultValue={item.points}
              required
            />
          </label>
          <label>
            Priority
            <input
              name="priority"
              type="number"
              min="0"
              max="100"
              defaultValue={item.priority}
              required
            />
            <small>Higher-priority steps appear first for students.</small>
          </label>
          <label>
            Due after acceptance (days)
            <input
              name="dueOffsetDays"
              type="number"
              min="0"
              max="3650"
              defaultValue={item.dueOffsetDays ?? ""}
              placeholder="No relative due date"
            />
          </label>
        </div>
        </section>

        <section
          className="staff-journey-editor__section"
          hidden={activeEditorSection !== "experience"}
          id="journey-step-experience"
        >
          <header>
            <span>02</span>
            <div><h3>Student experience</h3><p>Choose the action and configure exactly what the student will see and submit.</p></div>
          </header>

        {configuredTaskType === "single_select" ||
        configuredTaskType === "multiple_select" ? (
          <div className="staff-type-configuration">
            <label>
              Option values
              <textarea
                name="options"
                defaultValue={item.selectionOptions.join("\n")}
                placeholder={"on_campus\noff_campus\nundecided"}
                required
              />
              <small>Enter one student-facing value per line.</small>
            </label>
            {configuredTaskType === "multiple_select" ? (
              <label>
                Maximum selections
                <input
                  name="maximumSelections"
                  type="number"
                  min="1"
                  defaultValue={item.maximumSelections ?? 1}
                  required
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {configuredTaskType === "signature" ? (
          <div className="staff-type-configuration">
            <div className="staff-form-grid">
              <label>
                E-signature provider
                <select
                  name="signatureProvider"
                  value={signatureProvider}
                  onChange={(event) =>
                    setSignatureProvider(event.target.value as SignatureProvider)
                  }
                >
                  <option value="built_in">Built-in e-signature</option>
                  <option value="docusign">DocuSign (configuration only)</option>
                </select>
              </label>
              {signatureProvider === "docusign" ? (
                <label>
                  DocuSign template ID (optional)
                  <input
                    name="signatureTemplateId"
                    defaultValue={item.signatureTemplateId ?? ""}
                    maxLength={200}
                  />
                </label>
              ) : null}
            </div>
            <p>
              Provider and template settings are saved to the journey configuration.
              A live DocuSign connection must be configured separately.
            </p>
          </div>
        ) : null}

        {configuredTaskType === "upload_file" ? (
          <div className="staff-type-configuration">
            <label>
              Document categories
              <input
                name="documentCategories"
                defaultValue={item.documentCategories.join(", ")}
                placeholder="transcript, identity, immunization"
              />
            </label>
            <label>
              Accepted MIME types
              <input
                name="acceptedFileTypes"
                defaultValue={item.acceptedFileTypes.join(", ")}
                placeholder="application/pdf, image/jpeg, image/png"
              />
            </label>
          </div>
        ) : null}

        {(configuredTaskType === "form" &&
          !["profile_verification", "housing_preference"].includes(item.id)) ||
        configuredTaskType === "selection_flow" ? (
          <FormCanvasBuilder
            form={formDefinition}
            onChange={setFormDefinition}
            screen={{
              label: item.kind === "onboarding" ? "Onboarding" : "Enrollment task",
              title: item.title || "New student step",
              description: item.description,
            }}
          />
        ) : null}

        {flattenFormDefinition(formDefinition).length > 0 &&
        !["form", "selection_flow"].includes(configuredTaskType) ? (
          <div className="staff-student-impact-note" role="alert">
            Changing this step to this action type will remove its configured form
            fields when you publish.
          </div>
        ) : null}
        </section>

        <section
          className="staff-journey-editor__section"
          hidden={activeEditorSection !== "dependencies"}
          id="journey-step-dependencies"
        >
          <header>
            <span>03</span>
            <div><h3>Dependencies and branching</h3><p>Control when this step unlocks and see what it unlocks next.</p></div>
          </header>
        <fieldset className="staff-dependency-picker">
          <legend>Prerequisites</legend>
          <p>
            Select every step that must be completed first. The dependency map
            updates after publishing and cycles are rejected before anything is saved.
          </p>
          {dependencyCandidates.length > 0 || unavailableDependencies.length > 0 ? (
            <div className="staff-dependency-picker__options">
              {unavailableDependencies.map((dependency) => (
                <label className="is-unavailable" key={dependency}>
                  <input
                    name="dependsOn"
                    type="checkbox"
                    value={dependency}
                    checked
                    onChange={() => {
                      setSelectedDependencies((current) => {
                        const next = new Set(current);
                        next.delete(dependency);
                        return next;
                      });
                      setRouteRules((current) =>
                        current.filter(
                          (rule) => rule.sourceTaskId !== dependency,
                        ),
                      );
                    }}
                  />
                  <span>
                    <strong>Unavailable prerequisite</strong>
                    <small>{dependency} · Clear this stale reference before publishing</small>
                  </span>
                </label>
              ))}
              {dependencyCandidates.map((candidate) => (
                <label key={`${candidate.flowId}:${candidate.id}`}>
                  <input
                    name="dependsOn"
                    type="checkbox"
                    value={candidate.id}
                    checked={selectedDependencies.has(candidate.id)}
                    onChange={(event) => {
                      setSelectedDependencies((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(candidate.id);
                        else next.delete(candidate.id);
                        return next;
                      });
                      if (!event.target.checked) {
                        setRouteRules((current) =>
                          current.filter(
                            (rule) => rule.sourceTaskId !== candidate.id,
                          ),
                        );
                      }
                    }}
                  />
                  <span>
                    <strong>{candidate.title}</strong>
                    <small>
                      {candidate.kind === "onboarding" ? "Onboarding" : "Enrollment"}
                      {candidate.active ? "" : " · Inactive"} · {candidate.id}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="staff-dependency-picker__empty">
              Add another configurable step before creating a prerequisite.
            </p>
          )}
        </fieldset>
        <section className="staff-route-builder" aria-labelledby="route-builder-title">
          <header>
            <div>
              <span>IF / ELSE</span>
              <div>
                <strong id="route-builder-title">Answer-driven path</strong>
                <p>
                  Make this step part of the journey only when a prerequisite
                  answer matches. A non-matching branch becomes Not applicable.
                </p>
              </div>
            </div>
            <button
              className="button button--secondary"
              type="button"
              disabled={routeSourceTasks.length === 0}
              onClick={addRouteRule}
            >
              + Add answer condition
            </button>
          </header>
          {routeRules.length > 1 ? (
            <label className="staff-route-builder__match">
              Apply this path when
              <select
                value={routeMatch}
                onChange={(event) =>
                  setRouteMatch(event.target.value === "any" ? "any" : "all")
                }
              >
                <option value="all">All conditions match</option>
                <option value="any">Any condition matches</option>
              </select>
            </label>
          ) : null}
          {routeRules.length > 0 ? (
            <div className="staff-route-builder__rules">
              {routeRules.map((rule, index) => {
                const source = dependencyTasks.find(
                  (candidate) => candidate.id === rule.sourceTaskId,
                );
                const fields = source ? routeFieldsForTask(source) : [];
                const field =
                  fields.find((candidate) => candidate.id === rule.fieldId) ??
                  fields[0];
                const operators = field ? operatorsForRouteField(field) : [];
                return (
                  <article key={`${rule.sourceTaskId}:${rule.fieldId}:${index}`}>
                    <span aria-hidden="true">{index + 1}</span>
                    <label>
                      Prerequisite
                      <select
                        value={rule.sourceTaskId}
                        onChange={(event) => {
                          const nextSource = dependencyTasks.find(
                            (candidate) => candidate.id === event.target.value,
                          );
                          const nextField = nextSource
                            ? routeFieldsForTask(nextSource)[0]
                            : undefined;
                          if (!nextSource || !nextField) return;
                          updateRouteRule(index, () => ({
                            sourceTaskId: nextSource.id,
                            fieldId: nextField.id,
                            operator: operatorForRouteField(nextField),
                            value: defaultRouteValue(nextField),
                          }));
                        }}
                      >
                        {routeSourceTasks.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Answer field
                      <select
                        value={rule.fieldId}
                        onChange={(event) => {
                          const nextField = fields.find(
                            (candidate) => candidate.id === event.target.value,
                          );
                          if (!nextField) return;
                          updateRouteRule(index, (current) => ({
                            ...current,
                            fieldId: nextField.id,
                            operator: operatorForRouteField(nextField),
                            value: defaultRouteValue(nextField),
                          }));
                        }}
                      >
                        {fields.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Comparison
                      <select
                        value={rule.operator}
                        onChange={(event) => {
                          const operator = event.target.value as JourneyRouteOperator;
                          updateRouteRule(index, (current) => ({
                            ...current,
                            operator,
                            value: field
                              ? defaultRouteValue(field, operator)
                              : current.value,
                          }));
                        }}
                      >
                        {operators.map((operator) => (
                          <option key={operator.value} value={operator.value}>
                            {operator.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {rule.operator === "none_of" ? "Handled cases" : field?.fieldType === "number" ? "Threshold" : "Expected answer"}
                      {field?.fieldType === "number" ? (
                        <input
                          type="number"
                          min={field.minimum}
                          max={field.maximum}
                          value={typeof rule.value === "number" ? rule.value : ""}
                          onChange={(event) =>
                            updateRouteRule(index, (current) => ({
                              ...current,
                              value: Number(event.target.value),
                            }))
                          }
                        />
                      ) : rule.operator === "one_of" || rule.operator === "none_of" ? (
                        <select
                          multiple
                          value={Array.isArray(rule.value) ? rule.value : [String(rule.value)]}
                          onChange={(event) =>
                            updateRouteRule(index, (current) => ({
                              ...current,
                              value: Array.from(event.target.selectedOptions, (option) => option.value),
                            }))
                          }
                        >
                          {(field?.options ?? []).map((option) => (
                            <option key={String(option)} value={String(option)}>{String(option)}</option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={String(rule.value)}
                          onChange={(event) =>
                            updateRouteRule(index, (current) => ({
                              ...current,
                              value:
                                field?.fieldType === "checkbox"
                                  ? event.target.value === "true"
                                  : event.target.value,
                            }))
                          }
                        >
                          {(field?.options ?? []).map((option) => (
                            <option key={`${typeof option}:${String(option)}`} value={String(option)}>
                              {typeof option === "boolean" ? (option ? "Yes" : "No") : option}
                            </option>
                          ))}
                        </select>
                      )}
                      {rule.operator === "none_of" ? <small>Students whose answer is not in this list take this default path.</small> : null}
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove condition ${index + 1}`}
                      onClick={() =>
                        setRouteRules((current) =>
                          current.filter((_, ruleIndex) => ruleIndex !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="staff-route-builder__empty">
              <strong>This path currently follows prerequisites for everyone.</strong>
              <p>
                Select a prerequisite with a Yes/No, single-choice, or
                multiple-choice answer to create a conditional branch.
              </p>
            </div>
          )}
          <footer>
            <strong>Safe convergence</strong>
            <span>
              Unselected paths are skipped, while a later step can depend on all
              branch ends and continue after the selected path is complete.
            </span>
          </footer>
        </section>
        <div className="staff-dependency-successors" role="note">
          <strong>Steps currently unlocked by this one</strong>
          <p>
            {successorTasks.length > 0
              ? successorTasks.map((candidate) => candidate.title).join(", ")
            : "No existing step currently uses this as a prerequisite."}
          </p>
        </div>
        </section>

        <section
          className="staff-journey-editor__section"
          hidden={activeEditorSection !== "publishing"}
          id="journey-step-publishing"
        >
          <header>
            <span>04</span>
            <div><h3>Availability and publishing</h3><p>Set the student visibility and review the version impact before publishing.</p></div>
          </header>
        <div className="staff-form-grid">
          <label className="staff-checkbox">
            <input name="required" type="checkbox" defaultChecked={item.required} />
            Required for students
          </label>
          <label className="staff-checkbox">
            <input name="active" type="checkbox" defaultChecked={item.active} />
            Active for students
          </label>
        </div>
        <div className="staff-student-impact-note">
          Publishing creates a new configuration version. Completed student work is
          not rewritten.
        </div>

        {!isNew ? (
          <section className="staff-delete-confirmation">
            {confirmingDelete ? (
              <div role="alert">
                <strong>Delete {item.title}?</strong>
                <p>
                  The step will be removed from the next published journey version.
                  References to its ID will also be removed.
                </p>
                <div>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Keep step
                  </button>
                  <button
                    className="button staff-button--danger"
                    type="button"
                    disabled={action.status === "loading"}
                    onClick={() => void remove()}
                  >
                    Confirm delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="button staff-button--danger-outline"
                type="button"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete step
              </button>
            )}
          </section>
        ) : null}
        </section>

        {editorError || action.message ? (
          <p className="field-error" role="alert">
            {editorError ?? action.message}
          </p>
        ) : null}
        <footer>
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={action.status === "loading"}
          >
            {action.status === "loading" ? "Publishing..." : "Save and publish"}
          </button>
        </footer>
      </form>
    </aside>
  );
}

export function JourneyFlowBuilder({
  kind,
  title,
  configuration,
  onSaved,
}: {
  kind: JourneyFlowKind;
  title: string;
  configuration: StaffManagedConfiguration;
  onSaved: () => void;
}) {
  const [workingConfiguration, setWorkingConfiguration] =
    useState(configuration);
  const workingConfigurationRef = useRef(configuration);
  const parsed = useMemo(() => {
    try {
      return { tasks: parsedTasks(workingConfiguration, kind), error: null };
    } catch (error) {
      return {
        tasks: [] as JourneyBuilderTask[],
        error: errorMessage(error, "The journey flow could not be opened."),
      };
    }
  }, [workingConfiguration, kind]);
  const syncedOnboardingTasks = useMemo(() => {
    if (kind !== "enrollment") return [];
    try {
      return parsedTasks(workingConfiguration, "onboarding").filter(
        (task) => !task.studentStep && task.active,
      );
    } catch {
      return [];
    }
  }, [workingConfiguration, kind]);
  const dependencyTasks = useMemo(() => {
    try {
      const candidates = [
        ...parsedTasks(workingConfiguration, "onboarding"),
        ...parsedTasks(workingConfiguration, "enrollment"),
      ];
      return [...new Map(candidates.map((task) => [task.id, task])).values()];
    } catch {
      return parsed.tasks;
    }
  }, [parsed.tasks, workingConfiguration]);
  const [tasks, setTasks] = useState(parsed.tasks);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const focusedGraphTasks = useMemo(() => {
    const taskById = new Map(
      dependencyTasks.map((task) => [task.id, task]),
    );
    for (const task of tasks) taskById.set(task.id, task);
    const visible = new Set(tasks.map((task) => task.id));
    const addPrerequisites = (taskId: string) => {
      const task = taskById.get(taskId);
      for (const dependency of task?.dependsOn ?? []) {
        if (visible.has(dependency)) continue;
        visible.add(dependency);
        addPrerequisites(dependency);
      }
    };
    for (const task of tasks) addPrerequisites(task.id);
    return [...taskById.values()].filter((task) => visible.has(task.id));
  }, [dependencyTasks, tasks]);
  const [selected, setSelected] = useState<{
    item: JourneyBuilderTask;
    isNew: boolean;
  } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const action = useApiAction(updateStaffManagedConfiguration);
  const busy = action.status === "loading";
  const editorTriggerRef = useRef<HTMLElement | null>(null);

  const openEditor = (item: JourneyBuilderTask, isNew: boolean) => {
    editorTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSelected({ item, isNew });
  };

  const closeEditor = () => {
    setSelected(null);
    window.requestAnimationFrame(() => editorTriggerRef.current?.focus());
  };

  const acceptPublishedConfiguration = (
    updatedConfiguration: StaffManagedConfiguration,
  ) => {
    workingConfigurationRef.current = updatedConfiguration;
    setWorkingConfiguration(updatedConfiguration);
    try {
      setTasks(parsedTasks(updatedConfiguration, kind));
      setOperationError(null);
    } catch (error) {
      setOperationError(
        errorMessage(error, "The published journey flow could not be reopened."),
      );
    }
    onSaved();
  };

  const publish = async (document: ManagedDocument, changeSummary: string) => {
    const updatedConfiguration = await action.run("journeys", {
      expectedVersion: workingConfigurationRef.current.version,
      document,
      changeSummary,
    });
    acceptPublishedConfiguration(updatedConfiguration);
  };

  const applyTemplate = async (
    template: JourneyScaffoldTemplate,
    startAfterId: string | null,
  ) => {
    setOperationError(null);
    try {
      const document = editableDocument(workingConfigurationRef.current);
      const flows = flowRecords(document);
      let flow = flows.find(
        (candidate) => candidate.kind === kind && candidate.status === "published",
      );
      if (!flow) {
        flow = {
          id: createJourneyFlowId(
            kind,
            new Set(flows.map((candidate) => String(candidate.id))),
          ),
          title: kind === "onboarding" ? "Offer onboarding" : "Enrollment checklist",
          kind,
          status: "published",
          tasks: [],
        };
        flows.push(flow);
      }
      const existingIds = new Set(
        flows.flatMap((candidate) => taskRecords(candidate).map((task) => String(task.id))),
      );
      if (startAfterId && !existingIds.has(startAfterId)) {
        throw new Error("The selected starting step changed. Reopen the template and try again.");
      }
      const idByKey = new Map<string, string>();
      for (const templateTask of template.tasks) {
        const base = `tpl_${template.id}_${templateTask.key}`
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 88);
        let candidate = base;
        let suffix = 2;
        while (existingIds.has(candidate)) {
          candidate = `${base.slice(0, 84)}_${suffix}`;
          suffix += 1;
        }
        existingIds.add(candidate);
        idByKey.set(templateTask.key, candidate);
      }
      for (const templateTask of template.tasks) {
        const internalDependencies = templateTask.dependsOn.map((dependency) => {
          const mapped = idByKey.get(dependency);
          if (!mapped) throw new Error(`Template dependency ${dependency} is invalid.`);
          return mapped;
        });
        const dependencies =
          internalDependencies.length === 0 && startAfterId
            ? [startAfterId]
            : internalDependencies;
        const record: ManagedRecord = {
          id: idByKey.get(templateTask.key),
          title: templateTask.title,
          description: templateTask.description,
          owner: templateTask.owner,
          task_type: templateTask.taskType,
          submission_type: submissionTypeForTask(templateTask.taskType),
          required: templateTask.required,
          active: true,
          points: templateTask.points,
          priority: templateTask.priority,
          depends_on: dependencies,
        };
        if (templateTask.activation) {
          record.activation = {
            match: templateTask.activation.match,
            rules: templateTask.activation.rules.map((rule) => {
              const sourceTaskId = idByKey.get(rule.sourceKey);
              if (!sourceTaskId) {
                throw new Error(
                  `Template route source ${rule.sourceKey} is invalid.`,
                );
              }
              return {
                source_task: sourceTaskId,
                field: rule.fieldId,
                operator: rule.operator,
                value: rule.value,
              };
            }),
          };
        }
        if (templateTask.dueOffsetDays !== null) {
          record.due_days_after_acceptance = templateTask.dueOffsetDays;
        }
        if (templateTask.form) {
          record.input = {
            form: structuredClone(templateTask.form),
            fields: structuredClone(flattenFormDefinition(templateTask.form)),
          };
        }
        if (templateTask.options) {
          record.options = structuredClone(templateTask.options);
        }
        if (templateTask.maximumSelections) {
          record.maximum_selections = templateTask.maximumSelections;
        }
        if (templateTask.acceptedMimeTypes) {
          record.accepted_mime_types = structuredClone(templateTask.acceptedMimeTypes);
        }
        if (templateTask.documentCategories) {
          record.document_categories = structuredClone(templateTask.documentCategories);
        }
        if (templateTask.taskType === "signature") {
          record.signature_provider = "built_in";
        }
        taskRecords(flow).push(record);
      }
      await publish(document, `Added ${template.name} journey template.`);
      setShowTemplates(false);
      setViewMode("map");
    } catch (error) {
      setOperationError(errorMessage(error, "The journey template could not be published."));
    }
  };

  const connectNodes = async (sourceId: string, targetId: string) => {
    setOperationError(null);
    try {
      const source = dependencyTasks.find((task) => task.id === sourceId);
      const target = dependencyTasks.find((task) => task.id === targetId);
      if (!source || !target || target.kind !== kind || target.studentStep) {
        throw new Error("Those nodes can no longer be connected.");
      }
      if (!source.active && target.active) {
        throw new Error("Activate the source step before connecting it to a live step.");
      }
      if (target.dependsOn.includes(sourceId)) return;
      const candidate = dependencyTasks.map((task) => ({
        id: task.id,
        dependsOn: task.id === targetId ? [...task.dependsOn, sourceId] : task.dependsOn,
      }));
      const dependencyError = validateJourneyDependencies(candidate);
      if (dependencyError) throw new Error(dependencyError);
      const document = editableDocument(workingConfigurationRef.current);
      const { task } = findTask(document, target);
      if (!task) throw new Error("The target step is no longer available.");
      task.depends_on = [...new Set([...stringList(task.depends_on), sourceId])];
      await publish(document, `Connected ${source.title} to ${target.title}.`);
    } catch (error) {
      setOperationError(errorMessage(error, "The journey nodes could not be connected."));
      throw error;
    }
  };

  const saveCanvasLayout = async (
    positions: Record<string, { x: number; y: number }>,
  ) => {
    setOperationError(null);
    try {
      const document = editableDocument(workingConfigurationRef.current);
      for (const item of tasks) {
        const { task } = findTask(document, item);
        const position = positions[item.id];
        if (!task || !position) continue;
        task.editor_position = {
          x: Math.max(0, Math.round(position.x)),
          y: Math.max(0, Math.round(position.y)),
        };
      }
      await publish(document, `Updated ${kind} journey canvas layout.`);
    } catch (error) {
      setOperationError(errorMessage(error, "The canvas layout could not be saved."));
      throw error;
    }
  };

  const persistOrder = async (nextTasks: JourneyBuilderTask[]) => {
    const document = editableDocument(workingConfigurationRef.current);
    for (const flow of flowRecords(document)) {
      if (flow.kind !== kind || flow.status !== "published") continue;
      const records = taskRecords(flow);
      const recordById = new Map(records.map((task) => [String(task.id), task]));
      const orderedIds = nextTasks
        .filter((task) => task.flowId === flow.id)
        .map((task) => task.id);
      const knownIds = new Set(orderedIds);
      flow.tasks = [
        ...orderedIds
          .map((taskId) => recordById.get(taskId))
          .filter((task): task is ManagedRecord => Boolean(task)),
        ...records.filter((task) => !knownIds.has(String(task.id))),
      ];
    }
    await publish(
      document,
      `Reordered ${kind === "onboarding" ? "offer onboarding" : "enrollment checklist"} steps.`,
    );
  };

  const reorder = async (nextIds: string[]) => {
    const previous = tasks;
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const nextTasks = nextIds
      .map((taskId) => byId.get(taskId))
      .filter((task): task is JourneyBuilderTask => Boolean(task));
    if (nextTasks.length !== tasks.length) return;
    setOperationError(null);
    setTasks(nextTasks);
    try {
      await persistOrder(nextTasks);
    } catch (error) {
      setTasks(previous);
      setOperationError(errorMessage(error, "The new step order could not be published."));
    }
  };

  const move = (item: JourneyBuilderTask, direction: "up" | "down") => {
    const index = tasks.findIndex((task) => task.id === item.id);
    const neighbor = tasks[direction === "up" ? index - 1 : index + 1];
    if (
      item.studentStep ||
      !neighbor ||
      neighbor.studentStep ||
      neighbor.flowId !== item.flowId
    ) {
      return;
    }
    void reorder(moveJourneyTask(tasks.map((task) => task.id), item.id, direction));
  };

  const drop = (dragged: JourneyBuilderTask, target: JourneyBuilderTask) => {
    if (dragged.studentStep || target.studentStep || dragged.flowId !== target.flowId) {
      return;
    }
    void reorder(
      dropJourneyTask(
        tasks.map((task) => task.id),
        dragged.id,
        target.id,
      ),
    );
  };

  const toggleActive = async (item: JourneyBuilderTask) => {
    if (item.studentStep) return;
    const previous = tasks;
    const nextActive = !item.active;
    setOperationError(null);
    setTasks((current) =>
      current.map((task) =>
        task.id === item.id ? { ...task, active: nextActive } : task,
      ),
    );
    try {
      const document = editableDocument(workingConfigurationRef.current);
      const { task } = findTask(document, item);
      if (!task) throw new Error("This journey step is no longer available.");
      task.active = nextActive;
      await publish(
        document,
        `${nextActive ? "Activated" : "Deactivated"} journey step ${item.title}.`,
      );
    } catch (error) {
      setTasks(previous);
      setOperationError(
        errorMessage(error, "The step activation could not be published."),
      );
    }
  };

  const addStep = () => {
    try {
      const document = editableDocument(workingConfigurationRef.current);
      const flows = flowRecords(document);
      const flow = flows.find(
        (candidate) => candidate.kind === kind && candidate.status === "published",
      );
      const ids = new Set(
        flows.flatMap((candidate) =>
          taskRecords(candidate).map((task) => String(task.id)),
        ),
      );
      const id = createJourneyTaskId(kind, ids);
      const flowId = flow
        ? String(flow.id)
        : createJourneyFlowId(
            kind,
            new Set(flows.map((candidate) => String(candidate.id))),
          );
      openEditor(
        {
          id,
          kind,
          flowId,
          flowTitle: String(
            flow?.title ??
              (kind === "onboarding" ? "Offer onboarding" : "Enrollment checklist"),
          ),
          title: "",
          description: "",
          owner: "Enrollment Services",
          required: true,
          published: flow?.status === "published",
          active: true,
          order: tasks.length + 1,
          taskType: "form",
          submissionType: "form",
          selectionOptions: [],
          maximumSelections: null,
          signatureProvider: "built_in",
          signatureTemplateId: null,
          acceptedFileTypes: [],
          documentCategories: [],
          aboutYouRequiredFields: defaultAboutYouRequiredFields,
          identityQuickUpload: true,
          formDefinition: onePageForm([
            {
              id: "response",
              title: "Your response",
              field_type: "text",
              required: true,
            },
          ]),
          screenLabel: null,
          screenTitle: null,
          screenDescription: null,
          points: 0,
          priority: 0,
          dueOffsetDays: null,
          canvasPosition: null,
          studentStep: null,
          dependsOn: [],
          activation: { match: "all", rules: [] },
          flow: [],
          configurationVersion: workingConfigurationRef.current.version,
        },
        true,
      );
    } catch (error) {
      setOperationError(errorMessage(error, "A new journey step could not be started."));
    }
  };

  const instructionId = `journey-reorder-help-${kind}`;

  return (
    <>
      <header className="staff-journey-commandbar">
        <div className="staff-journey-commandbar__title">
          <span className="staff-journey-commandbar__mark" aria-hidden="true">FLOW</span>
          <div>
            <p className="eyebrow">Published student journey</p>
            <h2>{title}</h2>
            <p>Design the sequence, branch logic, and student experience from one workspace.</p>
          </div>
        </div>
        <div className="staff-journey-commandbar__actions">
          <div className="staff-journey-view-switch" role="group" aria-label="Journey view">
            <button
              className={viewMode === "map" ? "is-active" : undefined}
              type="button"
              aria-pressed={viewMode === "map"}
              onClick={() => setViewMode("map")}
            >
              <span aria-hidden="true">◇</span> Flow map
            </button>
            <button
              className={viewMode === "list" ? "is-active" : undefined}
              type="button"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              <span aria-hidden="true">≡</span> Step list
            </button>
          </div>
          <span className="staff-journey-version">Live · v{workingConfiguration.version}</span>
          <button
            className="button button--secondary"
            type="button"
            disabled={busy || Boolean(parsed.error)}
            onClick={() => setShowTemplates(true)}
          >
            Use template
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={busy || Boolean(parsed.error)}
            onClick={addStep}
          >
            + Add step
          </button>
        </div>
      </header>
      <p id={instructionId} className="staff-visually-hidden">
        Drag steps to reorder them, or use each step&apos;s Move up and Move down
        buttons. Every change publishes a new configuration version.
      </p>
      {parsed.error || operationError || action.message ? (
        <p className="field-error staff-flow-builder__error" role="alert">
          {parsed.error ?? operationError ?? action.message}
        </p>
      ) : null}
      {busy ? (
        <p className="staff-flow-builder__status" role="status">
          Publishing journey changes...
        </p>
      ) : null}
      {kind === "enrollment" && syncedOnboardingTasks.length > 0 ? (
        <section className="staff-synced-journey-items" aria-label="Onboarding items synchronized to enrollment">
          <div>
            <p className="eyebrow">Synced to the student checklist</p>
            <h3>Onboarding follow-ups</h3>
            <p>
              These steps are requested during onboarding and also appear in the
              student Enrollment Center until completed.
            </p>
          </div>
          <ul>
            {syncedOnboardingTasks.map((item) => (
              <li key={`${item.flowId}:${item.id}`}>
                <div>
                  <strong>{item.title}</strong>
                  <small>{taskTypeLabel(item.taskType)} · {item.required ? "Required" : "Optional"}</small>
                </div>
                <button type="button" disabled={busy} onClick={() => openEditor(item, false)}>
                  Edit synced item
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {viewMode === "map" && focusedGraphTasks.length > 0 ? (
        <JourneyDependencyMap
          key={`${kind}:${workingConfiguration.version}`}
          tasks={focusedGraphTasks}
          currentKind={kind}
          onSelect={(item) => openEditor(item, false)}
          onAdd={addStep}
          onConnect={connectNodes}
          onSaveLayout={saveCanvasLayout}
          busy={busy}
        />
      ) : null}
      {viewMode === "list" ? (
      <ol className="staff-journey-list" aria-describedby={instructionId}>
        {tasks.map((item, index) => {
          const previous = tasks[index - 1];
          const next = tasks[index + 1];
          const successorIds = journeySuccessorIds(dependencyTasks, item.id);
          return (
            <li
              key={`${item.flowId}:${item.id}`}
              className={[
                item.studentStep ? "is-built-in" : "",
                item.active ? "" : "is-inactive",
                draggedId === item.id ? "is-dragging" : "",
                dropTargetId === item.id ? "is-drop-target" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              draggable={!busy && !item.studentStep}
              onDragStart={(event: ReactDragEvent<HTMLLIElement>) => {
                if (item.studentStep) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.id);
                setDraggedId(item.id);
              }}
              onDragOver={(event) => {
                if (!draggedId || draggedId === item.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetId(item.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId =
                  event.dataTransfer.getData("text/plain") || draggedId;
                const source = tasks.find((task) => task.id === sourceId);
                if (source) drop(source, item);
                setDraggedId(null);
                setDropTargetId(null);
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDropTargetId(null);
              }}
            >
              <div className="staff-journey-order" aria-hidden="true">
                <span className="staff-journey-drag-handle">⋮⋮</span>
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className="staff-journey-task">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <small>
                    Owner: {item.owner} · {item.required ? "Required" : "Optional"}
                  </small>
                  <small>
                    Priority {item.priority}
                    {item.dueOffsetDays === null
                      ? " · No relative due date"
                      : ` · Due ${item.dueOffsetDays} days after acceptance`}
                  </small>
                  <small>
                    {item.dependsOn.length > 0
                      ? `Prerequisites: ${item.dependsOn.join(", ")}`
                      : "No prerequisites"}
                    {successorIds.length > 0
                      ? ` · Unlocks: ${successorIds.join(", ")}`
                      : " · No successors"}
                  </small>
                </div>
                <div className="staff-journey-task__status">
                  {item.studentStep ? (
                    <span className="staff-status-pill staff-status-pill--preview">
                      Built-in onboarding screen
                    </span>
                  ) : null}
                  {!item.active ? (
                    <span className="staff-status-pill">Inactive</span>
                  ) : null}
                  <span className="staff-status-pill staff-status-pill--success">
                    {taskTypeLabel(item.taskType)} · {item.points} points
                  </span>
                </div>
                <div className="staff-journey-task__actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openEditor(item, false)}
                  >
                    {item.studentStep ? "Edit screen" : "Edit step"}
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.active}
                    aria-label={`${item.active ? "Deactivate" : "Activate"} ${item.title}`}
                    title={item.studentStep ? "Required system screens cannot be deactivated." : undefined}
                    disabled={busy || Boolean(item.studentStep)}
                    onClick={() => void toggleActive(item)}
                  >
                    {item.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item.title} up`}
                    title={item.studentStep ? "System screen order follows the student route contract." : undefined}
                    disabled={
                      busy ||
                      Boolean(item.studentStep) ||
                      !previous ||
                      Boolean(previous.studentStep) ||
                      previous.flowId !== item.flowId
                    }
                    onClick={() => move(item, "up")}
                  >
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item.title} down`}
                    title={item.studentStep ? "System screen order follows the student route contract." : undefined}
                    disabled={
                      busy ||
                      Boolean(item.studentStep) ||
                      !next ||
                      Boolean(next.studentStep) ||
                      next.flowId !== item.flowId
                    }
                    onClick={() => move(item, "down")}
                  >
                    ↓ Down
                  </button>
                  {item.studentStep ? (
                    <div className="staff-protected-actions" role="note">
                      <strong>Required system screen</strong>
                      <small>
                        Activation and order are locked because the student route
                        depends on this screen. Its content and form remain editable.
                      </small>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      ) : null}
      {tasks.length === 0 && !parsed.error ? (
        <div className="staff-flow-builder__empty">
          <strong>No steps yet</strong>
          <p>Add the first step to this student flow.</p>
        </div>
      ) : null}
      {selected ? (
        <div className="staff-editor-backdrop">
          <JourneyTaskEditor
            key={`${selected.item.id}:${selected.isNew ? "new" : "edit"}`}
            item={selected.item}
            isNew={selected.isNew}
            dependencyTasks={dependencyTasks}
            configuration={workingConfiguration}
            onConfigurationSaved={acceptPublishedConfiguration}
            onClose={closeEditor}
          />
        </div>
      ) : null}
      {showTemplates ? (
        <JourneyTemplateGallery
          kind={kind}
          tasks={tasks}
          busy={busy}
          onApply={(template, startAfterId) => void applyTemplate(template, startAfterId)}
          onClose={() => setShowTemplates(false)}
        />
      ) : null}
    </>
  );
}
