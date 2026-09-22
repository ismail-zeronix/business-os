"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useState } from "react";
import { EmptyState } from "@/components/application/states";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldValue, inlineError, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Input } from "@/components/ui/input";
import { addAliasAction, removeAliasAction } from "../actions";

export type AliasRow = { id: string; alias: string; source: "MANUAL" | "REVIEW" };

function AddAlias({ productId, disabled }: { productId: string; disabled: boolean }) {
  const [state, formAction] = useActionState(addAliasAction, null);
  const [resetKey, setResetKey] = useState(0);
  useActionFeedback(state, () => setResetKey((k) => k + 1));
  const error = inlineError(state, "alias");

  return (
    <form action={formAction} key={resetKey} className="mb-3 flex items-start gap-2">
      <input type="hidden" name="productId" value={productId} />
      <div className="flex-1">
        <Input name="alias" placeholder="Add an alias, e.g. V15 G4" aria-label="New alias" defaultValue={fieldValue(state, "alias")} disabled={disabled} aria-invalid={Boolean(error)} className="font-mono" />
        {error ? (
          <p role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <SubmitButton size="sm" variant="outline" disabled={disabled} pendingLabel="Adding...">
        <Plus aria-hidden /> Add
      </SubmitButton>
    </form>
  );
}

function AliasItem({ row }: { row: AliasRow }) {
  const [state, formAction] = useActionState(removeAliasAction, null);
  useActionFeedback(state);
  return (
    <li className="flex items-center justify-between gap-2 border-b py-1.5 last:border-b-0">
      <div className="min-w-0">
        <span className="font-mono text-sm break-all">{row.alias}</span>
        {row.source === "REVIEW" ? <span className="ml-2 text-xs text-muted-foreground">from broadcast review</span> : null}
        {state && !state.ok ? <span role="alert" className="ml-2 text-xs text-danger">{state.message}</span> : null}
      </div>
      <form action={formAction}>
        <input type="hidden" name="id" value={row.id} />
        <SubmitButton variant="ghost" size="icon" aria-label={`Remove alias ${row.alias}`} title="Remove alias">
          <X aria-hidden />
        </SubmitButton>
      </form>
    </li>
  );
}

/**
 * Other names suppliers use for this product (V15 G4, V15G4, ...). Aliases feed product matching so a differently-worded broadcast line
 * still finds the same product instead of creating a duplicate. Removing one is audited.
 */
export function AliasPanel({ productId, aliases, archived }: { productId: string; aliases: AliasRow[]; archived: boolean }) {
  return (
    <div>
      <AddAlias productId={productId} disabled={archived} />
      {aliases.length === 0 ? (
        <EmptyState title="No aliases yet" description="Add the other ways suppliers write this product so broadcasts match it automatically." />
      ) : (
        <ul>
          {aliases.map((row) => (
            <AliasItem key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}
