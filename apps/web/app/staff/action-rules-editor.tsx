"use client";

import type {
  StaffActionRule,
  StaffActionRuleSignal,
  StaffActionType,
  StaffWorkItemPriority,
} from "@vv/contracts";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiClientError,
  createStaffActionRule,
  getStaffActionRules,
  updateStaffActionRule,
} from "../lib/api-client";

type JourneyKind = "enrollment" | "onboarding";

interface RuleDraft {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  signalType: StaffActionRuleSignal;
  flowKind: JourneyKind | "";
  requirementCode: string;
  lookaheadDays: string;
  inactivityDays: string;
  cadenceMinutes: string;
  component: string;
  priority: StaffWorkItemPriority;
  actionType: StaffActionType;
  titleTemplate: string;
  descriptionTemplate: string;
}

const actionTypes: Array<{ value: StaffActionType; label: string }> = [
  { value: "enrollment_follow_up", label: "Enrollment follow-up" },
  { value: "onboarding_assistance", label: "Onboarding assistance" },
  { value: "document_review", label: "Document review" },
  { value: "missing_information", label: "Missing information" },
  { value: "external_verification", label: "External verification" },
  { value: "deadline_risk", label: "Deadline risk" },
  { value: "staff_decision", label: "Staff decision" },
  { value: "communication_response", label: "Communication response" },
  { value: "blocked_dependency", label: "Blocked dependency" },
];

function emptyDraft(kind: JourneyKind): RuleDraft {
  return {
    code: "",
    name: "",
    description: "",
    enabled: true,
    signalType: "requirement_due",
    flowKind: kind,
    requirementCode: "",
    lookaheadDays: "3",
    inactivityDays: "",
    cadenceMinutes: "60",
    component: "Enrollment Services",
    priority: "high",
    actionType: kind === "enrollment" ? "enrollment_follow_up" : "onboarding_assistance",
    titleTemplate: "",
    descriptionTemplate: "",
  };
}

function draftFor(rule: StaffActionRule): RuleDraft {
  return {
    code: rule.code,
    name: rule.name,
    description: rule.description,
    enabled: rule.enabled,
    signalType: rule.signalType,
    flowKind: rule.flowKind ?? "",
    requirementCode: rule.requirementCode ?? "",
    lookaheadDays: rule.lookaheadDays?.toString() ?? "",
    inactivityDays: rule.inactivityDays?.toString() ?? "",
    cadenceMinutes: rule.cadenceMinutes.toString(),
    component: rule.component,
    priority: rule.priority,
    actionType: rule.actionType,
    titleTemplate: rule.titleTemplate,
    descriptionTemplate: rule.descriptionTemplate,
  };
}

function readable(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 409) {
      return "This rule changed in another staff session. The latest rules were reloaded.";
    }
    return error.message;
  }
  return "The action rule could not be saved. Your entered values remain in the form.";
}

function conditionFor(rule: StaffActionRule) {
  if (rule.signalType === "requirement_due") {
    const requirement = rule.requirementCode
      ? readable(rule.requirementCode)
      : "any incomplete requirement";
    return `${requirement} is due within ${rule.lookaheadDays ?? 0} day${rule.lookaheadDays === 1 ? "" : "s"}`;
  }
  return `the student has no activity for ${rule.inactivityDays ?? 1} day${rule.inactivityDays === 1 ? "" : "s"}`;
}

function RuleForm({
  rule,
  kind,
  busy,
  error,
  onCancel,
  onSave,
}: {
  rule: StaffActionRule | null;
  kind: JourneyKind;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (draft: RuleDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<RuleDraft>(() =>
    rule ? draftFor(rule) : emptyDraft(kind),
  );
  const set = <Key extends keyof RuleDraft>(key: Key, value: RuleDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave(draft);
  };

  return (
    <form className="staff-rule-form" onSubmit={submit}>
      <header>
        <div>
          <p className="eyebrow">{rule ? "Edit deterministic trigger" : "New deterministic trigger"}</p>
          <h3>{rule ? rule.name : "Create staff work automatically"}</h3>
        </div>
        <span>No LLM used for matching</span>
      </header>
      <div className="staff-rule-form__grid">
        <label>
          Stable code
          <input
            value={draft.code}
            onChange={(event) => set("code", event.target.value)}
            pattern="[a-z][a-z0-9-]*"
            maxLength={80}
            disabled={Boolean(rule)}
            required
          />
          <small>Used for deduplication and audit history; it cannot change after creation.</small>
        </label>
        <label>
          Rule name
          <input
            value={draft.name}
            onChange={(event) => set("name", event.target.value)}
            maxLength={160}
            required
          />
        </label>
        <label className="staff-rule-form__wide">
          Description
          <textarea
            value={draft.description}
            onChange={(event) => set("description", event.target.value)}
            maxLength={1000}
            required
          />
        </label>
        <label>
          Signal
          <select
            value={draft.signalType}
            disabled={Boolean(rule)}
            onChange={(event) => {
              const signal = event.target.value as StaffActionRuleSignal;
              setDraft((current) => ({
                ...current,
                signalType: signal,
                lookaheadDays: signal === "requirement_due" ? current.lookaheadDays || "3" : "",
                inactivityDays: signal === "student_inactive" ? current.inactivityDays || "7" : "",
                requirementCode: signal === "requirement_due" ? current.requirementCode : "",
              }));
            }}
          >
            <option value="requirement_due">Requirement due soon</option>
            <option value="student_inactive">Student inactivity</option>
          </select>
          <small>The signal type cannot change after creation; create a new rule instead.</small>
        </label>
        <label>
          Journey
          <select
            value={draft.flowKind}
            onChange={(event) => set("flowKind", event.target.value as JourneyKind | "")}
          >
            <option value="">Both journeys</option>
            <option value="onboarding">Onboarding</option>
            <option value="enrollment">Enrollment</option>
          </select>
        </label>
        {draft.signalType === "requirement_due" ? (
          <>
            <label>
              Requirement code
              <input
                value={draft.requirementCode}
                onChange={(event) => set("requirementCode", event.target.value)}
                pattern="[a-z][a-z0-9_]*"
                placeholder="official_transcript"
              />
              <small>Leave blank to evaluate every incomplete requirement.</small>
            </label>
            <label>
              Due within days
              <input
                type="number"
                min={0}
                max={365}
                value={draft.lookaheadDays}
                onChange={(event) => set("lookaheadDays", event.target.value)}
                required
              />
            </label>
          </>
        ) : (
          <label>
            Inactive for days
            <input
              type="number"
              min={1}
              max={365}
              value={draft.inactivityDays}
              onChange={(event) => set("inactivityDays", event.target.value)}
              required
            />
          </label>
        )}
        <label>
          Check cadence (minutes)
          <input
            type="number"
            min={5}
            max={1440}
            value={draft.cadenceMinutes}
            onChange={(event) => set("cadenceMinutes", event.target.value)}
            required
          />
        </label>
        <label>
          Responsible staff team
          <input
            value={draft.component}
            onChange={(event) => set("component", event.target.value)}
            maxLength={160}
            required
          />
        </label>
        <label>
          Priority
          <select
            value={draft.priority}
            onChange={(event) => set("priority", event.target.value as StaffWorkItemPriority)}
          >
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          Action type
          <select
            value={draft.actionType}
            onChange={(event) => set("actionType", event.target.value as StaffActionType)}
          >
            {actionTypes.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="staff-rule-form__wide">
          Created task title
          <input
            value={draft.titleTemplate}
            onChange={(event) => set("titleTemplate", event.target.value)}
            maxLength={240}
            required
          />
        </label>
        <label className="staff-rule-form__wide">
          Created task description
          <textarea
            value={draft.descriptionTemplate}
            onChange={(event) => set("descriptionTemplate", event.target.value)}
            maxLength={2000}
            required
          />
        </label>
        <label className="staff-rule-form__toggle staff-rule-form__wide">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => set("enabled", event.target.checked)}
          />
          Enable this rule as soon as it is saved
        </label>
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <footer>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? "Saving..." : rule ? "Save rule" : "Create rule"}
        </button>
      </footer>
    </form>
  );
}

export function ActionRulesEditor({ kind }: { kind: JourneyKind }) {
  const [rules, setRules] = useState<StaffActionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffActionRule | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const result = await getStaffActionRules(signal);
    setRules(result.items);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getStaffActionRules(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setRules(result.items);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const visibleRules = useMemo(
    () => rules.filter((rule) => rule.flowKind === null || rule.flowKind === kind),
    [kind, rules],
  );

  const replace = (updated: StaffActionRule) => {
    setRules((current) =>
      current.some((rule) => rule.id === updated.id)
        ? current.map((rule) => (rule.id === updated.id ? updated : rule))
        : [...current, updated],
    );
  };

  const toggle = async (rule: StaffActionRule) => {
    setBusyId(rule.id);
    setError(null);
    try {
      replace(
        await updateStaffActionRule(rule.id, {
          expectedVersion: rule.version,
          enabled: !rule.enabled,
        }),
      );
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiClientError && cause.status === 409) {
        await load().catch(() => undefined);
      }
    } finally {
      setBusyId(null);
    }
  };

  const save = async (draft: RuleDraft) => {
    const lookaheadDays = draft.signalType === "requirement_due"
      ? Number(draft.lookaheadDays)
      : null;
    const inactivityDays = draft.signalType === "student_inactive"
      ? Number(draft.inactivityDays)
      : null;
    const cadenceMinutes = Number(draft.cadenceMinutes);
    if (
      !Number.isInteger(cadenceMinutes) ||
      (lookaheadDays !== null && !Number.isInteger(lookaheadDays)) ||
      (inactivityDays !== null && !Number.isInteger(inactivityDays))
    ) {
      setError("Enter whole numbers for the schedule thresholds and cadence.");
      return;
    }
    const currentRule = editing === "new" ? null : editing;
    setBusyId(currentRule?.id ?? "new");
    setError(null);
    try {
      const common = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        enabled: draft.enabled,
        flowKind: draft.flowKind || null,
        requirementCode:
          draft.signalType === "requirement_due"
            ? draft.requirementCode.trim() || null
            : null,
        lookaheadDays,
        inactivityDays,
        cadenceMinutes,
        component: draft.component.trim(),
        priority: draft.priority,
        actionType: draft.actionType,
        titleTemplate: draft.titleTemplate.trim(),
        descriptionTemplate: draft.descriptionTemplate.trim(),
      };
      const saved = currentRule
        ? await updateStaffActionRule(currentRule.id, {
            expectedVersion: currentRule.version,
            ...common,
          })
        : await createStaffActionRule({
            code: draft.code.trim(),
            signalType: draft.signalType,
            ...common,
          });
      replace(saved);
      setEditing(null);
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiClientError && cause.status === 409) {
        await load().catch(() => undefined);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="staff-panel staff-action-rules">
      <header className="staff-action-rules__heading">
        <div>
          <p className="eyebrow">Scheduled action rules</p>
          <h2>Turn deadlines and inactivity into staff work</h2>
          <p>
            These deterministic checks run independently from AI. Each match is deduplicated,
            creates an auditable Action Center task, and keeps the underlying student evidence.
          </p>
        </div>
        <button
          type="button"
          className="button button--primary"
          disabled={Boolean(editing)}
          onClick={() => {
            setError(null);
            setEditing("new");
          }}
        >
          Add scheduled rule
        </button>
      </header>

      {error && !editing ? <p className="field-error" role="alert">{error}</p> : null}
      {editing ? (
        <RuleForm
          key={editing === "new" ? `new-${kind}` : `${editing.id}-${editing.version}`}
          rule={editing === "new" ? null : editing}
          kind={kind}
          busy={busyId !== null}
          error={error}
          onCancel={() => {
            setError(null);
            setEditing(null);
          }}
          onSave={save}
        />
      ) : loading ? (
        <p>Loading scheduled rules...</p>
      ) : visibleRules.length === 0 ? (
        <p>No rules currently apply to this journey.</p>
      ) : (
        <div className="staff-action-rules__list">
          {visibleRules.map((rule) => (
            <article key={rule.id} className={rule.enabled ? undefined : "is-disabled"}>
              <div className="staff-action-rule__state">
                <span>{rule.enabled ? "Active" : "Paused"}</span>
                <small>Every {rule.cadenceMinutes} minutes</small>
              </div>
              <div className="staff-action-rule__body">
                <header>
                  <div>
                    <h3>{rule.name}</h3>
                    <code>{rule.code}</code>
                  </div>
                  <span>{rule.priority} priority</span>
                </header>
                <p>{rule.description}</p>
                <dl>
                  <div><dt>When</dt><dd>{conditionFor(rule)}</dd></div>
                  <div><dt>Create</dt><dd>{rule.titleTemplate}</dd></div>
                  <div><dt>Assign team</dt><dd>{rule.component}</dd></div>
                  <div><dt>Last checked</dt><dd>{rule.lastEvaluatedAt ? new Date(rule.lastEvaluatedAt).toLocaleString() : "Not run yet"}</dd></div>
                </dl>
              </div>
              <div className="staff-action-rule__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={busyId === rule.id}
                  onClick={() => void toggle(rule)}
                >
                  {rule.enabled ? "Pause" : "Enable"}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={Boolean(busyId)}
                  onClick={() => {
                    setError(null);
                    setEditing(rule);
                  }}
                >
                  Edit
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
