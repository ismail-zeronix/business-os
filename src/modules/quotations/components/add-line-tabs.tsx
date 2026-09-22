"use client";

import { useState } from "react";
import type { SelectOption } from "@/components/forms/multi-select";
import { Button } from "@/components/ui/button";
import { AddLineForm } from "./add-line-form";
import { ConfirmationLineForm } from "./confirmation-line-form";

type ContactOption = SelectOption & { supplierId: string };

/** The two ways to add a line: typed (delivery and the like), or from a supplier who has just confirmed a price. */
export function AddLineTabs({
  quotationId,
  currencyCode,
  defaultConfirmedAt,
  suppliers,
  contacts,
  brands,
}: {
  quotationId: string;
  currencyCode: string;
  defaultConfirmedAt: string;
  suppliers: SelectOption[];
  contacts: ContactOption[];
  brands: SelectOption[];
}) {
  const [tab, setTab] = useState<"confirmation" | "typed">("confirmation");
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5" role="tablist" aria-label="Kind of line">
        <Button type="button" role="tab" aria-selected={tab === "confirmation"} size="sm" variant={tab === "confirmation" ? "default" : "outline"} onClick={() => setTab("confirmation")}>
          From a supplier confirmation
        </Button>
        <Button type="button" role="tab" aria-selected={tab === "typed"} size="sm" variant={tab === "typed" ? "default" : "outline"} onClick={() => setTab("typed")}>
          Typed line
        </Button>
      </div>
      {tab === "confirmation" ? (
        <ConfirmationLineForm quotationId={quotationId} currencyCode={currencyCode} defaultConfirmedAt={defaultConfirmedAt} suppliers={suppliers} contacts={contacts} brands={brands} />
      ) : (
        <AddLineForm quotationId={quotationId} currencyCode={currencyCode} />
      )}
    </div>
  );
}
