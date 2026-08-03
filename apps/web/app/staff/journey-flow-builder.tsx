"use client";

import type {
  AboutYouConfigurableField,
  StaffJourneyBlueprintItem,
  StaffManagedConfiguration,
} from "@vv/contracts";
import { dump, load } from "js-yaml";
import {
  type DragEvent as ReactDragEvent,
  type FormEvent,
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
  type JourneyFlowKind,
  type JourneyTaskType,
  moveJourneyTask,
  submissionTypeForTask,
} from "./journey-flow-model";
import {
  aboutYouDefaultFields,
  type FormBuilderField,
  FormCanvasBuilder,
  onboardingScreenDefaults,
  responsibleOfficeOptions,
} from "./onboarding-form-builder";

type ManagedDocument = Record<string, unknown>;
type ManagedRecord = Record<string, unknown>;
type SignatureProvider = "built_in" | "docusign";

interface JourneyBuilderTask extends StaffJourneyBlueprintItem {
  active: boolean;
  selectionOptions: string[];
  maximumSelections: number | null;
  signatureProvider: SignatureProvider;
  signatureTemplateId: string | null;
  acceptedFileTypes: string[];
  documentCategories: string[];
  aboutYouRequiredFields: AboutYouConfigurableField[];
  identityQuickUpload: boolean;
  formFields: FormBuilderField[];
  screenLabel: string | null;
  screenTitle: string | null;
  screenDescription: string | null;
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

const taskTypeOptions: Array<{ value: JourneyTaskType; label: string }> = [
  { value: "approval", label: "Approval" },
  { value: "form", label: "Form" },
  { value: "single_select", label: "Single select" },
  { value: "multiple_select", label: "Multiple select" },
  { value: "upload_file", label: "File upload" },
  { value: "signature", label: "E-signature" },
  { value: "payment", label: "Payment" },
  { value: "information", label: "Information" },
  { value: "selection_flow", label: "Structured selection flow" },
  { value: "scheduling", label: "Scheduling" },
];

function editableDocument(configuration: StaffManagedConfiguration) {
  const document = load(configuration.yaml);
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("The journey configuration is not an editable document.");
  }
  return structuredClone(document as ManagedDocument);
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

function yamlFor(document: ManagedDocument) {
  return dump(document, {
    lineWidth: 100,
    // The FastAPI side uses PyYAML's YAML 1.1-compatible loader. Keep js-yaml's
    // compatibility quoting so string choices such as "yes" and "no" do not
    // arrive as booleans.
    noCompatMode: false,
    noRefs: true,
  });
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
        "checkbox",
        "single_select",
        "multiple_select",
      ].includes(fieldType)
    ) {
      return [];
    }
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
      },
    ];
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
        formFields: configuredFormFields(
          configuredType === "selection_flow"
            ? task.flow ?? input.flow
            : input.fields,
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
        studentStep:
          typeof task.student_step === "string" ? task.student_step : null,
        dependsOn: stringList(task.depends_on),
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

function JourneyTaskEditor({
  item,
  isNew,
  configuration,
  onConfigurationSaved,
  onClose,
}: {
  item: JourneyBuilderTask;
  isNew: boolean;
  configuration: StaffManagedConfiguration;
  onConfigurationSaved: (configuration: StaffManagedConfiguration) => void;
  onClose: () => void;
}) {
  const { tenant } = useTenant();
  const action = useApiAction(updateStaffManagedConfiguration);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [configuredTaskType, setConfiguredTaskType] = useState(item.taskType);
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
  const [formFields, setFormFields] = useState<FormBuilderField[]>(() => {
    if (item.formFields.length > 0) return structuredClone(item.formFields);
    if (item.studentStep === "about_you") {
      const required = new Set(item.aboutYouRequiredFields);
      return structuredClone(aboutYouDefaultFields).map((field) => ({
        ...field,
        required: aboutYouFieldBindings[field.id]
          ? required.has(aboutYouFieldBindings[field.id]!)
          : field.required,
      }));
    }
    return [];
  });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const builtInOnboardingScreen = item.kind === "onboarding" && Boolean(item.studentStep);

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
      const dependencies = formList(form.get("dependsOn")).filter(
        (dependency) => dependency !== item.id,
      );

      if (!title || !description) {
        throw new Error("Step name and student instructions are required.");
      }
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
        points: Number(form.get("points")),
        required: form.get("required") === "on",
        active: form.get("active") === "on",
        depends_on: dependencies,
      });

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
        validateFormFields(formFields);
        task.flow = structuredClone(formFields);
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
        validateFormFields(formFields);
        existingInput.fields = structuredClone(formFields);
      } else if (selectedType !== "form") {
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
        yaml: yamlFor(document),
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
        validateFormFields(formFields);
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
        yaml: yamlFor(document),
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
        }
      }
      const updatedConfiguration = await action.run("journeys", {
        expectedVersion: configuration.version,
        yaml: yamlFor(document),
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
        className="staff-editor-panel"
        aria-label="Edit built-in onboarding screen"
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
        <form onSubmit={saveBuiltInScreen}>
          <div className="staff-journey-task-id">
            <span>Stable screen key</span>
            <code>{item.studentStep}</code>
          </div>
          <label>
            Journey list label
            <input name="title" defaultValue={item.title} required maxLength={180} />
            <small>Used by staff and in the student&apos;s progress navigation.</small>
          </label>
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
          <div className="staff-form-grid">
            <ResponsibleOfficeSelect defaultValue={item.owner} />
            <label>
              Points
              <input name="points" type="number" min="0" max="10000" defaultValue={item.points} required />
            </label>
            <div className="staff-locked-setting" role="note">
              <span>Student action</span>
              <strong>{taskTypeLabel(item.taskType)}</strong>
              <small>This system screen uses the fields configured below.</small>
            </div>
          </div>
          {item.studentStep === "about_you" ? (
            <>
              <FormCanvasBuilder
                fields={formFields}
                onChange={setFormFields}
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
          ) : null}
          <div className="staff-student-impact-note">
            This preview and the student page read the same published configuration.
            The stable screen key and its route contract remain protected.
          </div>
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
      className="staff-editor-panel"
      aria-label={isNew ? "Add journey step" : "Edit journey step"}
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
      <form onSubmit={save}>
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
        </div>

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
            fields={formFields}
            onChange={setFormFields}
            screen={{
              label: item.kind === "onboarding" ? "Onboarding" : "Enrollment task",
              title: item.title || "New student step",
              description: item.description,
            }}
          />
        ) : null}

        {formFields.length > 0 &&
        !["form", "selection_flow"].includes(configuredTaskType) ? (
          <div className="staff-student-impact-note" role="alert">
            Changing this step to this action type will remove its configured form
            fields when you publish.
          </div>
        ) : null}
        <label>
          Depends on step IDs
          <input name="dependsOn" defaultValue={item.dependsOn.join(", ")} />
        </label>
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
  const [tasks, setTasks] = useState(parsed.tasks);
  const [selected, setSelected] = useState<{
    item: JourneyBuilderTask;
    isNew: boolean;
  } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const action = useApiAction(updateStaffManagedConfiguration);
  const busy = action.status === "loading";

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
      yaml: yamlFor(document),
      changeSummary,
    });
    acceptPublishedConfiguration(updatedConfiguration);
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
      setSelected({
        isNew: true,
        item: {
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
          formFields: [
            {
              id: "response",
              title: "Your response",
              field_type: "text",
              required: true,
            },
          ],
          screenLabel: null,
          screenTitle: null,
          screenDescription: null,
          points: 0,
          studentStep: null,
          dependsOn: [],
          flow: [],
          configurationVersion: workingConfigurationRef.current.version,
        },
      });
    } catch (error) {
      setOperationError(errorMessage(error, "A new journey step could not be started."));
    }
  };

  const instructionId = `journey-reorder-help-${kind}`;

  return (
    <>
      <header className="staff-panel__heading staff-panel__heading--padded staff-flow-builder__heading">
        <div>
          <p className="eyebrow">Published flow</p>
          <h2>{title}</h2>
        </div>
        <div>
          <span className="staff-status-pill staff-status-pill--success">Live</span>
          <button
            className="button button--primary"
            type="button"
            disabled={busy || Boolean(parsed.error)}
            onClick={addStep}
          >
            Add step
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
                <button type="button" disabled={busy} onClick={() => setSelected({ item, isNew: false })}>
                  Edit synced item
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ol className="staff-journey-list" aria-describedby={instructionId}>
        {tasks.map((item, index) => {
          const previous = tasks[index - 1];
          const next = tasks[index + 1];
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
                    onClick={() => setSelected({ item, isNew: false })}
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
            configuration={workingConfiguration}
            onConfigurationSaved={acceptPublishedConfiguration}
            onClose={() => setSelected(null)}
          />
        </div>
      ) : null}
    </>
  );
}
