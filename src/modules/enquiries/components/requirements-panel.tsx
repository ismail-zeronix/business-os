"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, fieldValues, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { addRequirementAction, reextractRequirementsAction, replaceRequirementAction, retractRequirementAction } from "../actions";
import { IMPORTANCE_LABEL, requirementLabel, requirementValue } from "@/modules/specs/format";
import { ATTRIBUTES, getAttribute } from "@/modules/specs/registry";
import type { RequirementImportance, RequirementOperator, SpecConfidence } from "@/modules/specs/types";

/** A specification requirement as the page shows it (plain numbers, no database types). */
export type RequirementView = {
  id: string;
  attributeKey: string;
  operator: RequirementOperator;
  importance: RequirementImportance;
  rawValue: string;
  valueText: string | null;
  valueNum: number | null;
  valueNumMax: number | null;
  valueList: string[];
  unit: string | null;
  confidence: SpecConfidence;
  source: "PARSER" | "AI" | "HUMAN";
};

const OPERATOR_LABEL: Record<RequirementOperator, string> = {
  EQUALS: "Exactly",
  GREATER_THAN_OR_EQUAL: "At least",
  LESS_THAN_OR_EQUAL: "At most",
  BETWEEN: "Between",
  IN: "Includes all of",
  CONTAINS: "Contains",
};
const SOURCE_LABEL = { PARSER: "Read from the text", AI: "Suggested by AI", HUMAN: "Set by a person" } as const;
const CONFIDENCE_WORD = { HIGH: "clear", MEDIUM: "probable", LOW: "unsure" } as const;

/**
 * The structured specification requirements of one enquiry item, as chips. They are what the customer's wording was read as, with the
 * words as written on hover. A pending item lets a person change, add or remove them; the parser's original stays in the record and the
 * Activity tab. Reviewed items show them read-only.
 */
export function RequirementsPanel({ itemId, requirements, editable }: { itemId: string; requirements: RequirementView[]; editable: boolean }) {
  const [readState, readAction] = useActionState(reextractRequirementsAction, null);
  useActionFeedback(readState);

  if (!editable && requirements.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Specifications</span>
        {editable ? (
          <form action={readAction}>
            <input type="hidden" name="itemId" value={itemId} />
            <SubmitButton size="xs" variant="ghost" className="text-muted-foreground" pendingLabel="Reading...">
              Read again from text
            </SubmitButton>
          </form>
        ) : null}
      </div>
      {readState && !readState.ok ? <FormMessage state={readState} /> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {requirements.length === 0 ? <span className="text-xs text-muted-foreground">No specifications were found in the wording. Add them if the customer asked for any.</span> : null}
        {requirements.map((requirement) => (editable ? <EditableChip key={requirement.id} requirement={requirement} /> : <ChipBody key={requirement.id} requirement={requirement} />))}
        {editable ? <AddRequirement itemId={itemId} taken={new Set(requirements.map((r) => r.attributeKey))} /> : null}
      </div>
    </div>
  );
}

function ChipBody({ requirement }: { requirement: RequirementView }) {
  const uncertain = requirement.confidence !== "HIGH";
  return (
    <span
      title={`"${requirement.rawValue}" - ${SOURCE_LABEL[requirement.source]}, ${CONFIDENCE_WORD[requirement.confidence]} reading`}
      className={cn("inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs", uncertain ? "border-dashed border-amber-400 bg-amber-50 text-amber-950" : "bg-background")}
    >
      <span className="text-muted-foreground">{requirementLabel(requirement.attributeKey)}</span>
      <span className="font-medium">{requirementValue(requirement)}</span>
      {requirement.importance !== "MUST" ? <Badge variant="muted" className="h-4 px-1">{IMPORTANCE_LABEL[requirement.importance]}</Badge> : null}
      {requirement.source === "HUMAN" ? <Badge variant="info" className="h-4 px-1">You</Badge> : null}
    </span>
  );
}

function EditableChip({ requirement }: { requirement: RequirementView }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-full outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/60" aria-label={`Edit ${requirementLabel(requirement.attributeKey)}`}>
          <ChipBody requirement={requirement} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <EditForm requirement={requirement} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function EditForm({ requirement, onDone }: { requirement: RequirementView; onDone: () => void }) {
  const [state, formAction] = useActionState(replaceRequirementAction, null);
  const [removeState, removeAction] = useActionState(retractRequirementAction, null);
  useActionFeedback(state, onDone);
  useActionFeedback(removeState, onDone);
  const spec = getAttribute(requirement.attributeKey);
  if (!spec) return null;

  return (
    <>
      <div className="text-xs text-muted-foreground">
        <div className="font-medium text-foreground">{spec.label}</div>
        <div>
          Written as &ldquo;{requirement.rawValue}&rdquo;. {SOURCE_LABEL[requirement.source]}, {CONFIDENCE_WORD[requirement.confidence]} reading.
        </div>
      </div>
      <form action={formAction} className="space-y-3" noValidate>
        <input type="hidden" name="id" value={requirement.id} />
        <FormMessage state={state} />
        <RequirementFields idPrefix={`edit-${requirement.id}`} attributeKey={requirement.attributeKey} initial={requirement} state={state} />
        <div className="flex items-center justify-between gap-2">
          <SubmitButton size="sm" pendingLabel="Saving...">
            Save
          </SubmitButton>
        </div>
      </form>
      <form action={removeAction} className="flex items-center justify-between gap-2 border-t pt-2">
        <input type="hidden" name="id" value={requirement.id} />
        <span className="text-xs text-muted-foreground">Not needed? It stays in the record.</span>
        <SubmitButton size="sm" variant="outline" pendingLabel="Removing...">
          Remove
        </SubmitButton>
      </form>
      {removeState && !removeState.ok ? <FormMessage state={removeState} /> : null}
    </>
  );
}

function AddRequirement({ itemId, taken }: { itemId: string; taken: Set<string> }) {
  const [open, setOpen] = useState(false);
  const available = ATTRIBUTES.filter((a) => !taken.has(a.key));
  if (available.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="xs" className="rounded-full">
          <Plus aria-hidden /> Add
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <AddForm itemId={itemId} available={available.map((a) => ({ value: a.key, label: a.label }))} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function AddForm({ itemId, available, onDone }: { itemId: string; available: { value: string; label: string }[]; onDone: () => void }) {
  const [state, formAction] = useActionState(addRequirementAction, null);
  const [key, setKey] = useState(available[0]!.value);
  useActionFeedback(state, onDone);

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="itemId" value={itemId} />
      <FormMessage state={state} />
      <Field label="Specification" htmlFor={`add-${itemId}-key`} error={fieldError(state, "attributeKey")}>
        <SelectField name="attributeKey" id={`add-${itemId}-key`} allowNone={false} defaultValue={key} options={available} onChange={setKey} />
      </Field>
      {/* Re-mounted per attribute so the fields always match the chosen specification. */}
      <RequirementFields key={key} idPrefix={`add-${itemId}`} attributeKey={key} initial={null} state={state} />
      <SubmitButton size="sm" pendingLabel="Adding...">
        Add
      </SubmitButton>
    </form>
  );
}

/** Comparison, value(s) and importance for one attribute. The value control follows the attribute: a number, a list choice or ticked options. */
function RequirementFields({
  idPrefix,
  attributeKey,
  initial,
  state,
}: {
  idPrefix: string;
  attributeKey: string;
  initial: RequirementView | null;
  state: Parameters<typeof fieldValue>[0];
}) {
  const spec = getAttribute(attributeKey)!;
  const [operator, setOperator] = useState<RequirementOperator>(initial?.operator ?? spec.defaultOperator);
  const id = (name: string) => `${idPrefix}-${name}`;
  const initialText = initial ? (spec.kind === "NUMBER" ? (initial.valueNum === null ? "" : String(initial.valueNum)) : spec.key === "cpu" ? requirementValue(initial) : (initial.valueText ?? "")) : "";
  const showOperator = spec.operators.length > 1;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {showOperator ? (
          <Field label="Comparison" htmlFor={id("operator")} error={fieldError(state, "operator")}>
            <SelectField name="operator" id={id("operator")} allowNone={false} defaultValue={operator} options={spec.operators.map((op) => ({ value: op, label: OPERATOR_LABEL[op] }))} onChange={(value) => setOperator(value as RequirementOperator)} />
          </Field>
        ) : (
          <input type="hidden" name="operator" value={spec.defaultOperator} />
        )}
        <Field label="Importance" htmlFor={id("importance")} error={fieldError(state, "importance")} className={showOperator ? undefined : "col-span-2"}>
          <SelectField name="importance" id={id("importance")} allowNone={false} defaultValue={fieldValue(state, "importance", initial?.importance ?? spec.defaultImportance)} options={(["MUST", "SHOULD", "NICE"] as const).map((value) => ({ value, label: IMPORTANCE_LABEL[value] }))} />
        </Field>
      </div>

      {spec.kind === "NUMBER" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={operator === "BETWEEN" ? `From (${spec.unit})` : `Value (${spec.unit})`} htmlFor={id("value")} error={fieldError(state, "value")}>
            <Input id={id("value")} name="value" inputMode="decimal" defaultValue={fieldValue(state, "value", initialText)} className="num" />
          </Field>
          {operator === "BETWEEN" ? (
            <Field label={`To (${spec.unit})`} htmlFor={id("valueMax")} error={fieldError(state, "valueMax")}>
              <Input id={id("valueMax")} name="valueMax" inputMode="decimal" defaultValue={fieldValue(state, "valueMax", initial?.valueNumMax === null || initial?.valueNumMax === undefined ? "" : String(initial.valueNumMax))} className="num" />
            </Field>
          ) : null}
        </div>
      ) : null}

      {spec.kind === "TEXT" && spec.options ? (
        <Field label={spec.label} htmlFor={id("value")} error={fieldError(state, "value")}>
          <SelectField name="value" id={id("value")} allowNone={false} defaultValue={fieldValue(state, "value", initial?.valueText ?? spec.options[0]!.value)} options={[...spec.options]} />
        </Field>
      ) : null}

      {spec.kind === "TEXT" && !spec.options ? (
        <Field label={spec.label} htmlFor={id("value")} error={fieldError(state, "value")} hint="For example Core Ultra 7 256V, i7-1355U or Ryzen 7 7730U">
          <Input id={id("value")} name="value" defaultValue={fieldValue(state, "value", initialText)} />
        </Field>
      ) : null}

      {spec.kind === "LIST" ? (
        <Field label={spec.label} htmlFor={id("valueList")} error={fieldError(state, "valueList")}>
          <div className="flex flex-wrap gap-3">
            {spec.options?.map((option) => (
              <label key={option.value} className="flex items-center gap-1.5 text-sm">
                <Checkbox name="valueList" value={option.value} defaultChecked={fieldValues(state, "valueList", initial?.valueList ?? []).includes(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
        </Field>
      ) : null}
    </div>
  );
}
