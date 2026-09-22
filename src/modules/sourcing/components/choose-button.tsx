"use client";

import { useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { chooseSupplierAction, clearChoiceAction } from "../actions";
import { useRequestAction } from "./use-request-action";

/**
 * Choose a supplier for a requirement. What is saved is exactly what the cell shows (the price and stock it was rendered with), so the
 * record says what the buyer saw, even if the supplier quotes something else a minute later.
 */
export function ChooseButton({
  enquiryItemId,
  supplierId,
  supplierName,
  priceObservationId,
  stockObservationId,
  replacing,
}: {
  enquiryItemId: string;
  supplierId: string;
  supplierName: string;
  priceObservationId: string | null;
  stockObservationId: string | null;
  /** True when another supplier is currently chosen for this requirement (choosing here replaces it). */
  replacing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useRequestAction(chooseSupplierAction, () => setOpen(false));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          {replacing ? "Choose instead" : "Choose"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <p className="text-xs text-muted-foreground">
          Choose <span className="font-medium text-foreground">{supplierName}</span> for this requirement. The price and stock shown here are saved with the choice.
          {replacing ? " This replaces the current choice." : ""}
        </p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="enquiryItemId" value={enquiryItemId} />
          <input type="hidden" name="supplierId" value={supplierId} />
          <input type="hidden" name="priceObservationId" value={priceObservationId ?? ""} />
          <input type="hidden" name="stockObservationId" value={stockObservationId ?? ""} />
          <Input name="note" placeholder="Note (optional): warranty, terms, quantity agreed" aria-label="Note" />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Saving...">
              Choose supplier
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Withdraws the choice. The record is kept as retracted and stays in the Activity timeline. */
export function ClearChoiceButton({ id }: { id: string }) {
  const [state, formAction] = useRequestAction(clearChoiceAction);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" size="xs" pendingLabel="Clearing...">
        Clear
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
