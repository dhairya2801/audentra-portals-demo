import type {
  StudentRequirementInputField,
  StudentRequirementResponseValue,
} from "@vv/contracts";

export function visibleConfiguredFields(
  fields: StudentRequirementInputField[],
  values: Record<string, StudentRequirementResponseValue>,
) {
  const byId = new Map(fields.map((field) => [field.id, field]));
  const applies = (
    field: StudentRequirementInputField,
    visited: Set<string>,
  ): boolean => {
    if (!field.when) return true;
    if (visited.has(field.id)) return false;
    const controller = byId.get(field.when.field);
    if (!controller) return false;
    const nextVisited = new Set(visited).add(field.id);
    return (
      applies(controller, nextVisited) &&
      String(values[field.when.field] ?? "") === field.when.equals
    );
  };

  return fields.filter((field) => applies(field, new Set()));
}
