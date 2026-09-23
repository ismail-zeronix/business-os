"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/core/errors";
import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { zonedInputToUtc } from "@/lib/format";
import { searchProductOptions, type ProductPickerRow } from "@/modules/products/queries";
import {
  broadcastArchiveSchema,
  broadcastCreateSchema,
  broadcastIdSchema,
  bulkApplyItemsSchema,
  itemCreateProductSchema,
  itemLinkSchema,
  itemManualCreateSchema,
  itemReasonSchema,
  itemUpdateSchema,
} from "./schemas";
import {
  addManualItem,
  bulkUpdateItems,
  confirmReadyItems,
  createBroadcast,
  createProductForItem,
  ignoreItem,
  reopenItem,
  saveAndConfirmItem,
  setBroadcastArchived,
  setItemProduct,
  updateItem,
  type ConfirmReadySummary,
} from "./service";

/** Thin server actions for the broadcast workflow: FormData -> zod -> service -> revalidate -> ActionResult. Rules live in service.ts. */
type IdResult = ActionResult<{ id: string }>;

/** Pages that show broadcast data. Confirm/reopen change observations, so they refresh everything (the app is small). */
function refreshBroadcast(broadcastId: string, everything = false) {
  revalidatePath("/broadcasts");
  revalidatePath(`/broadcasts/${broadcastId}`);
  if (everything) revalidatePath("/", "layout");
}

export async function createBroadcastAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = broadcastCreateSchema.parse(formDataToObject(formData));
      const observedAt = zonedInputToUtc(input.receivedAt);
      if (!observedAt) throw new ValidationError("Enter a valid date and time.", { receivedAt: "Not a valid date and time" });
      if (observedAt.getTime() > Date.now() + 5 * 60_000) throw new ValidationError("A message cannot have been received in the future.", { receivedAt: "In the future" });

      const { broadcast } = await createBroadcast(await getServiceContext(), {
        supplierId: input.supplierId,
        contactId: input.contactId,
        channel: input.channel,
        observedAt,
        rawText: input.rawText,
        notes: input.notes,
        allowDuplicate: input.allowDuplicate,
        supplierRequestId: input.supplierRequestId,
        categoryHintId: input.categoryId,
      });
      revalidatePath("/broadcasts");
      revalidatePath(`/suppliers/${input.supplierId}`);
      revalidatePath("/", "layout");
      return { id: broadcast.id };
    },
    { successMessage: "Broadcast saved. Review the extracted items.", formData },
  );
}

/** One form serves both buttons: `intent=save` saves the edits; `intent=confirm` saves and confirms in a single transaction. */
export async function saveItemAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  const raw = formDataToObject(formData);
  const confirming = raw.intent === "confirm";
  return runAction(
    async () => {
      const input = itemUpdateSchema.parse(raw);
      const ctx = await getServiceContext();
      const item = confirming ? await saveAndConfirmItem(ctx, input) : await updateItem(ctx, input);
      refreshBroadcast(item.broadcastId, confirming);
      return { id: item.broadcastId };
    },
    { successMessage: confirming ? "Item confirmed" : "Item saved", formData },
  );
}

export type BulkApplyResult = { id: string; updated: number };

/** "Apply all" on the bulk review table: zips the parallel column arrays back into one row per item and saves them all in one transaction. */
export async function bulkApplyItemsAction(_prev: ActionResult<BulkApplyResult> | null, formData: FormData): Promise<ActionResult<BulkApplyResult>> {
  return runAction(
    async () => {
      const input = bulkApplyItemsSchema.parse(formDataToObject(formData));
      const length = input.id.length;
      const mismatched = (Object.keys(input) as (keyof typeof input)[]).filter((key) => key !== "broadcastId" && Array.isArray(input[key]) && (input[key] as string[]).length !== length);
      if (mismatched.length > 0) throw new ValidationError("The review table did not submit correctly. Reload the page and try again.");

      const rows = input.id.map((id, i) => ({
        id,
        description: input.description[i] ?? "",
        brandText: input.brandText[i] ?? "",
        modelText: input.modelText[i] ?? "",
        categoryText: input.categoryText[i] ?? "",
        partNumber: input.partNumber[i] ?? "",
        specText: input.specText[i] ?? "",
        quantity: input.quantity[i] ?? "",
        priceAmount: input.priceAmount[i] ?? "",
        currencyCode: input.currencyCode[i] ?? "",
        vatState: input.vatState[i] ?? "",
        stockStatus: input.stockStatus[i] ?? "",
        warrantyMonths: input.warrantyMonths[i] ?? "",
        warrantyType: input.warrantyType[i] ?? "",
        notes: input.notes[i] ?? "",
      }));

      const { updated } = await bulkUpdateItems(await getServiceContext(), { broadcastId: input.broadcastId, rows });
      refreshBroadcast(input.broadcastId);
      return { id: input.broadcastId, updated };
    },
    { formData },
  );
}

export async function ignoreItemAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const item = await ignoreItem(await getServiceContext(), itemReasonSchema.parse(formDataToObject(formData)));
      refreshBroadcast(item.broadcastId);
      return { id: item.broadcastId };
    },
    { successMessage: "Item ignored", formData },
  );
}

export async function reopenItemAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const item = await reopenItem(await getServiceContext(), itemReasonSchema.parse(formDataToObject(formData)));
      refreshBroadcast(item.broadcastId, true);
      return { id: item.broadcastId };
    },
    { successMessage: "Item reopened", formData },
  );
}

export async function linkItemAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const item = await setItemProduct(await getServiceContext(), itemLinkSchema.parse(formDataToObject(formData)));
      refreshBroadcast(item.broadcastId);
      return { id: item.broadcastId };
    },
    { successMessage: "Product link saved", formData },
  );
}

export async function createProductForItemAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const { item } = await createProductForItem(await getServiceContext(), itemCreateProductSchema.parse(formDataToObject(formData)));
      refreshBroadcast(item.broadcastId);
      revalidatePath("/products");
      return { id: item.broadcastId };
    },
    { successMessage: "Product created and linked", formData },
  );
}

export async function addManualItemAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const item = await addManualItem(await getServiceContext(), itemManualCreateSchema.parse(formDataToObject(formData)));
      refreshBroadcast(item.broadcastId);
      return { id: item.id };
    },
    { successMessage: "Item added", formData },
  );
}

/** "Confirm N ready items": the toast text depends on the outcome (all confirmed vs. some left pending), so the popover composes it itself from `data` rather than a static successMessage. */
export async function confirmReadyItemsAction(_prev: ActionResult<ConfirmReadySummary> | null, formData: FormData): Promise<ActionResult<ConfirmReadySummary>> {
  return runAction(
    async () => {
      const input = broadcastIdSchema.parse(formDataToObject(formData));
      const summary = await confirmReadyItems(await getServiceContext(), input.id);
      refreshBroadcast(input.id, true); // observations were created, same as confirm/reopen
      return summary;
    },
    { formData },
  );
}

export async function archiveBroadcastAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = broadcastArchiveSchema.parse(formDataToObject(formData));
      await setBroadcastArchived(await getServiceContext(), input);
      refreshBroadcast(input.id, true);
      return { id: input.id };
    },
    { successMessage: "Broadcast updated", formData },
  );
}

/** Live product lookup for the link picker. Returns plain rows (not a form result); short queries return nothing. */
export async function searchProductsForLinkAction(query: string): Promise<ProductPickerRow[]> {
  const q = query.trim();
  return q.length < 2 ? [] : searchProductOptions(q);
}
