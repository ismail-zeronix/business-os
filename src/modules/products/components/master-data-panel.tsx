"use client";

import { Pencil, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { Panel } from "@/components/application/page-canvas";
import { EmptyState } from "@/components/application/states";
import { RecordStatusBadge } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { RecordStatusControl } from "@/components/forms/record-status-control";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldValue, inlineError, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/core/validation/action-result";
import type { MasterDataRow } from "../master-data.queries";

type IdAction = (prev: ActionResult<{ id: string }> | null, formData: FormData) => Promise<ActionResult<{ id: string }>>;

function AddForm({ noun, action }: { noun: string; action: IdAction }) {
  const [state, formAction] = useActionState(action, null);
  const [resetKey, setResetKey] = useState(0);
  useActionFeedback(state, () => setResetKey((k) => k + 1));
  const error = inlineError(state, "name");

  return (
    <form action={formAction} className="flex items-start gap-2 px-4 py-3" key={resetKey}>
      <div className="w-96">
        <Input name="name" placeholder={`New ${noun} name`} aria-label={`New ${noun} name`} aria-invalid={Boolean(error)} defaultValue={fieldValue(state, "name")} />
        {error ? (
          <p role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <SubmitButton size="sm" pendingLabel="Adding...">
        <Plus aria-hidden /> Add {noun}
      </SubmitButton>
    </form>
  );
}

function RenameControl({ row, noun, action }: { row: MasterDataRow; noun: string; action: IdAction }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, null);
  useActionFeedback(state, () => setOpen(false));
  const error = inlineError(state, "name");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Rename ${row.name}`} title="Rename">
          <Pencil aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={row.id} />
          <label htmlFor={`rename-${row.id}`} className="text-xs text-muted-foreground">
            Rename {noun}
          </label>
          <Input id={`rename-${row.id}`} name="name" defaultValue={fieldValue(state, "name", row.name)} autoFocus aria-invalid={Boolean(error)} />
          {error ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Saving...">
              Save
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Add, rename and archive the shared brand/category lists. Nothing is deleted; archived entries can be restored. */
export function MasterDataPanel({
  noun,
  rows,
  createAction,
  renameAction,
  statusAction,
}: {
  noun: "brand" | "category";
  rows: MasterDataRow[];
  createAction: IdAction;
  renameAction: IdAction;
  statusAction: IdAction;
}) {
  return (
    <Panel>
      <AddForm noun={noun} action={createAction} />
      <TableShell>
        {rows.length === 0 ? (
          <EmptyState title={`No ${noun === "brand" ? "brands" : "categories"} yet`} description={`Add one above. They can then be assigned to suppliers and products.`} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead className="w-28 text-right">Suppliers</TableHead>
                <TableHead className="w-28 text-right">Products</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className={row.status === "ARCHIVED" ? "text-muted-foreground" : undefined}>
                  <TableCell className="truncate font-medium">{row.name}</TableCell>
                  <TableCell className="num text-right">{row.supplierCount}</TableCell>
                  <TableCell className="num text-right">{row.productCount}</TableCell>
                  <TableCell>
                    <RecordStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <RenameControl row={row} noun={noun} action={renameAction} />
                      <RecordStatusControl id={row.id} status={row.status} action={statusAction} entityLabel={row.name} triggerLabel="Status" size="xs" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableShell>
    </Panel>
  );
}
