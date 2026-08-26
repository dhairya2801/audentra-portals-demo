"use client";
import type {
  StudentOnboardingData,
  StudentOnboardingScreenConfiguration,
  StudentRequirementInputField,
} from "@vv/contracts";
import ChoiceList from "../../design-system/patterns/ChoiceList.jsx";
import FieldGroup from "../../design-system/patterns/FieldGroup.jsx";
import Field from "../../design-system/primitives/Field.jsx";
import Select from "../../design-system/primitives/Select.jsx";

/**
 * The fields a university adds to *About you* from the journey builder.
 *
 * Twelve field ids map onto the record's own columns and are drawn where
 * those columns are asked — the name fields on step 2, the address on step 3.
 * Everything else is a custom field, kept under `customFields[id]`, and is
 * drawn here: one group per authored page, with the page's title as the
 * group's label. A `when` condition hides a field until the field it names
 * holds the value it names.
 */
export const aboutYouInputNames: Record<string, keyof StudentOnboardingData> = {
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

const configuredChoiceValues: Record<string, Record<string, string>> = {
  citizenship_status: {
    "U.S. citizen": "us_citizen",
    "U.S. permanent resident": "permanent_resident",
    "Other eligible noncitizen / status": "eligible_noncitizen",
    "International student · F-1 or J-1": "international",
  },
  residency_verification_path: {
    "Review my permanent address": "home_address_review",
    "I will provide supporting documents": "document_upload",
    "I need an advisor review": "advisor_review",
  },
};

export function optionValue(field: StudentRequirementInputField, option: string) {
  return configuredChoiceValues[field.id]?.[option] ?? option;
}

export type ConfiguredPage = {
  id: string;
  title: string;
  description?: string;
  fields: StudentRequirementInputField[];
};

/** The authored pages, custom fields only, with the paged form canonical. */
export function customPagesOf(
  configuration: StudentOnboardingScreenConfiguration | undefined,
): ConfiguredPage[] {
  if (!configuration) return [];
  const pages: ConfiguredPage[] =
    configuration.form?.version === 1 && configuration.form.pages.length > 0
      ? configuration.form.pages
      : configuration.fields?.length
        ? [{ id: "student_details", title: "More about you", fields: configuration.fields }]
        : [];
  return pages
    .map((page) => ({
      ...page,
      fields: page.fields.filter((field) => !aboutYouInputNames[field.id]),
    }))
    .filter((page) => page.fields.length > 0);
}

/** The core fields the university configured, keyed by record column. */
export function coreFieldsOf(
  configuration: StudentOnboardingScreenConfiguration | undefined,
) {
  const map = new Map<keyof StudentOnboardingData, StudentRequirementInputField>();
  const fields =
    configuration?.form?.version === 1
      ? configuration.form.pages.flatMap((page) => page.fields)
      : configuration?.fields ?? [];
  for (const field of fields) {
    const column = aboutYouInputNames[field.id];
    if (column) map.set(column, field);
  }
  return map;
}

export type CustomValue = string | string[] | boolean;

function isVisible(
  field: StudentRequirementInputField,
  values: Record<string, CustomValue | undefined>,
  data: StudentOnboardingData,
) {
  if (!field.when) return true;
  const column = aboutYouInputNames[field.when.field];
  const current = column ? data[column] : values[field.when.field];
  return String(current ?? "") === field.when.equals;
}

export function customFieldProblem(
  field: StudentRequirementInputField,
  value: CustomValue | undefined,
) {
  if (!field.required) return null;
  if (Array.isArray(value)) return value.length ? null : "Choose at least one.";
  if (typeof value === "boolean") return value ? null : "This one has to be checked.";
  return String(value ?? "").trim() ? null : "This one is required.";
}

export function ConfiguredFields({
  pages,
  values,
  data,
  problems,
  onChange,
}: {
  pages: ConfiguredPage[];
  values: Record<string, CustomValue | undefined>;
  data: StudentOnboardingData;
  problems: Record<string, string | null>;
  onChange: (id: string, value: CustomValue) => void;
}) {
  return (
    <>
      {pages.map((page) => (
        <FieldGroup key={page.id} label={page.title} labelId={`configured-${page.id}`}>
          {page.description ? <p className="field-foot">{page.description}</p> : null}
          {page.fields.filter((field) => isVisible(field, values, data)).map((field) => {
            const current = values[field.id];
            const label = field.required ? field.title : `${field.title}, optional`;
            const error = problems[field.id] ?? undefined;

            if (field.field_type === "checkbox") {
              return (
                <ChoiceList
                  key={field.id}
                  multiple
                  name={`custom-${field.id}`}
                  options={[[field.id, field.title]]}
                  value={current === true ? [field.id] : []}
                  onChange={(next: string[]) => onChange(field.id, next.length > 0)}
                />
              );
            }
            if (field.field_type === "multiple_select") {
              return (
                <FieldGroup
                  key={field.id}
                  plain
                  label={label}
                  labelId={`custom-${field.id}-label`}
                  footnote={error}
                >
                  <ChoiceList
                    multiple
                    name={`custom-${field.id}`}
                    labelledBy={`custom-${field.id}-label`}
                    options={(field.options ?? []).map((option) => [optionValue(field, option), option])}
                    value={Array.isArray(current) ? current : []}
                    onChange={(next: string[]) =>
                      onChange(
                        field.id,
                        field.maximum_selections ? next.slice(0, field.maximum_selections) : next,
                      )
                    }
                  />
                </FieldGroup>
              );
            }
            if (field.field_type === "single_select") {
              return (
                <Select
                  key={field.id}
                  label={label}
                  hint={error}
                  value={typeof current === "string" ? current : ""}
                  options={[
                    { value: "", label: "Choose one" },
                    ...(field.options ?? []).map((option) => ({
                      value: optionValue(field, option),
                      label: option,
                    })),
                  ]}
                  onChange={(next: string) => onChange(field.id, next)}
                />
              );
            }
            const type =
              field.field_type === "phone"
                ? "tel"
                : field.field_type === "email" || field.field_type === "date" || field.field_type === "number"
                  ? field.field_type
                  : "text";
            return (
              <Field
                key={field.id}
                label={label}
                type={type}
                value={typeof current === "string" ? current : ""}
                error={error}
                min={field.minimum}
                max={field.maximum}
                step={field.step}
                onChange={(next: string) => onChange(field.id, next)}
              />
            );
          })}
        </FieldGroup>
      ))}
    </>
  );
}
