"use client";

import { MoreHorizontal, Pencil, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormDrawer } from "@/components/forms/form-drawer";
import { QuotationDetailsForm, type QuotationDetailsInitial } from "./details-form";

/**
 * The secondary draft actions ("•••" in the totals panel footer): Edit details and Preview customer copy.
 *
 * Edit details opens the same drawer as before, but it can't be a `DropdownMenuItem`'s `asChild` trigger: Radix closes the
 * dropdown (and returns focus) on select, which races with a nested `Sheet` trying to open at the same time. Instead the item's
 * `onSelect` just flips local state, and a separately-rendered, controlled `FormDrawer` reacts to it once the menu has settled.
 */
export function QuotationFooterMenu({
  label,
  details,
  canEdit,
  previewHref,
}: {
  label: string;
  details: QuotationDetailsInitial;
  canEdit: boolean;
  previewHref: string;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More actions" title="More actions">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            disabled={!canEdit}
            title={!canEdit ? "Restore the enquiry to edit this quotation" : undefined}
            onSelect={() => setEditOpen(true)}
          >
            <Pencil aria-hidden /> Edit details
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={previewHref} target="_blank" prefetch={false} className="flex w-full items-center gap-1.5">
              <Printer aria-hidden /> Preview customer copy
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FormDrawer open={editOpen} onOpenChange={setEditOpen} title={`Edit ${label}`} description="What the customer's copy shows.">
        <QuotationDetailsForm quotation={details} />
      </FormDrawer>
    </>
  );
}
