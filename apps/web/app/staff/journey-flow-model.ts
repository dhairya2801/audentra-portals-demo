import type { StaffJourneyBlueprintItem } from "@vv/contracts";

export type JourneyFlowKind = StaffJourneyBlueprintItem["kind"];
export type JourneyTaskType = StaffJourneyBlueprintItem["taskType"];
export type JourneySubmissionType = StaffJourneyBlueprintItem["submissionType"];

export interface JourneyDependencyNode {
  id: string;
  dependsOn: readonly string[];
}

const submissionTypes: Record<JourneyTaskType, JourneySubmissionType> = {
  information: "none",
  form: "form",
  upload_file: "document",
  approval: "form",
  single_select: "form",
  multiple_select: "form",
  selection_flow: "form",
  signature: "form",
  payment: "payment",
  scheduling: "appointment",
};

export function submissionTypeForTask(
  taskType: JourneyTaskType,
): JourneySubmissionType {
  return submissionTypes[taskType];
}

export function createJourneyTaskId(
  kind: JourneyFlowKind,
  existingIds: ReadonlySet<string>,
  randomUuid: () => string = () => crypto.randomUUID(),
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = randomUuid()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 12);
    const candidate = `new_${kind}_step_${suffix || `item${attempt + 1}`}`;
    if (!existingIds.has(candidate)) return candidate;
  }

  throw new Error("A unique journey step ID could not be generated.");
}

export function createJourneyFlowId(
  kind: JourneyFlowKind,
  existingIds: ReadonlySet<string>,
) {
  const base = `${kind}_flow`;
  if (!existingIds.has(base)) return base;
  for (let suffix = 2; suffix <= 1000; suffix += 1) {
    const candidate = `${base}_${suffix}`;
    if (!existingIds.has(candidate)) return candidate;
  }
  throw new Error("A unique published journey flow ID could not be generated.");
}

export function moveJourneyTask(
  taskIds: readonly string[],
  taskId: string,
  direction: "up" | "down",
) {
  const from = taskIds.indexOf(taskId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= taskIds.length) return [...taskIds];

  const reordered = [...taskIds];
  [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
  return reordered;
}

export function dropJourneyTask(
  taskIds: readonly string[],
  draggedId: string,
  targetId: string,
) {
  const from = taskIds.indexOf(draggedId);
  const target = taskIds.indexOf(targetId);
  if (from < 0 || target < 0 || from === target) return [...taskIds];

  const reordered = taskIds.filter((id) => id !== draggedId);
  const targetWithoutDragged = reordered.indexOf(targetId);
  const insertionIndex = from < target ? targetWithoutDragged + 1 : targetWithoutDragged;
  reordered.splice(insertionIndex, 0, draggedId);
  return reordered;
}

export function journeySuccessorIds(
  tasks: readonly JourneyDependencyNode[],
  taskId: string,
) {
  return tasks
    .filter((task) => task.dependsOn.includes(taskId))
    .map((task) => task.id);
}

export function journeyDependencyCycle(
  tasks: readonly JourneyDependencyNode[],
): string[] | null {
  const nodes = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  const visit = (taskId: string): string[] | null => {
    if (visiting.has(taskId)) {
      const cycleStart = path.indexOf(taskId);
      return [...path.slice(cycleStart), taskId];
    }
    if (visited.has(taskId)) return null;

    visiting.add(taskId);
    path.push(taskId);
    const task = nodes.get(taskId);
    for (const dependency of task?.dependsOn ?? []) {
      if (!nodes.has(dependency)) continue;
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(taskId);
    visited.add(taskId);
    return null;
  };

  for (const taskId of nodes.keys()) {
    const cycle = visit(taskId);
    if (cycle) return cycle;
  }
  return null;
}

export function validateJourneyDependencies(
  tasks: readonly JourneyDependencyNode[],
) {
  const ids = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    if (task.dependsOn.includes(task.id)) {
      return `${task.id} cannot depend on itself.`;
    }
    const unknown = task.dependsOn.find((dependency) => !ids.has(dependency));
    if (unknown) {
      return `${task.id} depends on unknown step ${unknown}.`;
    }
  }
  const cycle = journeyDependencyCycle(tasks);
  return cycle ? `Dependency cycle: ${cycle.join(" → ")}.` : null;
}

export function journeyGraphLevels(tasks: readonly JourneyDependencyNode[]) {
  const remaining = new Map(
    tasks.map((task) => [task.id, new Set(task.dependsOn)]),
  );
  const levels: string[][] = [];
  const placed = new Set<string>();

  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, dependencies]) =>
        [...dependencies].every((dependency) => placed.has(dependency)),
      )
      .map(([taskId]) => taskId);
    if (ready.length === 0) {
      levels.push([...remaining.keys()]);
      break;
    }
    levels.push(ready);
    for (const taskId of ready) {
      placed.add(taskId);
      remaining.delete(taskId);
    }
  }

  return levels;
}
