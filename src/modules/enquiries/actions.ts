"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/core/errors";
import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { zonedInputToUtc } from "@/lib/format";
import {
  addManualEnquiryItem,
  createProductForEnquiryItem,
  ignoreEnquiryItem,
  reopenEnquiryItem,
  saveAndConfirmEnquiryItem,
  setEnquiryItemProduct,
  updateEnquiryItem,
} from "./item.service";
import {
  customerFromRequesterSchema,
  enquiryArchiveSchema,
  enquiryCreateSchema,
  enquiryHeaderSchema,
  enquiryItemCreateProductSchema,
  enquiryItemLinkSchema,
  enquiryItemManualCreateSchema,
  enquiryItemReasonSchema,
  enquiryItemUpdateSchema,
  enquiryNoteSchema,
  enquiryStatusSchema,
  enquirySuggestionSchema,
} from "./schemas";
import { addEnquiryNote, applyHeaderSuggestion, createCustomerFromRequester, createEnquiry, setEnquiryArchived, setEnquiryStatus, updateEnquiryHeader } from "./service";

/** Thin server actions for the enquiry workflow: FormData -> zod -> service -> revalidate -> ActionResult. Rules live in the services. */
type IdResult = ActionResult<{ id: string }>;

/** Pages that show enquiry data. Status changes also affect the Overview and the customer pages, so they refresh the whole layout. */
function refreshEnquiry(enquiryId: string, everything = false) {
  revalidatePath("/enquiries");
  revalidatePath(`/enquiries/${enquiryId}`);
  if (everything) revalidatePath("/", "layout");
}

export async function createEnquiryAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = enquiryCreateSchema.parse(formDataToObject(formData));
      const observedAt = zonedInputToUtc(input.receivedAt);
      if (!observedAt) throw new ValidationError("Enter a valid date and time.", { receivedAt: "Not a valid date and time" });
      if (observedAt.getTime() > Date.now() + 5 * 60_000) throw new ValidationError("A request cannot have been received in the future.", { receivedAt: "In the future" });

      const { enquiry } = await createEnquiry(await getServiceContext(), {
        source: { kind: "new", channel: input.channel, observedAt, rawText: input.rawText },
        customerId: input.customerId,
        contactId: input.contactId,
        requesterName: input.requesterName,
        requesterEmail: input.requesterEmail,
        subject: input.subject,
        notes: input.notes,
      });
      revalidatePath("/enquiries");
      revalidatePath("/", "layout");
      return { id: enquiry.id };
    },
    { successMessage: "Enquiry saved. Review the requirements.", formData },
  );
}

// ───────────────────────────────────────── header ─────────────────────────────────────────

export async function updateEnquiryHeaderAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const enquiry = await updateEnquiryHeader(await getServiceContext(), enquiryHeaderSchema.parse(formDataToObject(formData)));
      refreshEnquiry(enquiry.id, true);
      return { id: enquiry.id };
    },
    { successMessage: "Enquiry saved", formData },
  );
}

export async function setEnquiryStatusAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const enquiry = await setEnquiryStatus(await getServiceContext(), enquiryStatusSchema.parse(formDataToObject(formData)));
      refreshEnquiry(enquiry.id, true);
      return { id: enquiry.id };
    },
    { successMessage: "Status updated", formData },
  );
}

export async function addEnquiryNoteAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = enquiryNoteSchema.parse(formDataToObject(formData));
      await addEnquiryNote(await getServiceContext(), input);
      refreshEnquiry(input.id, true);
      return { id: input.id };
    },
    { successMessage: "Note added", formData },
  );
}

export async function archiveEnquiryAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = enquiryArchiveSchema.parse(formDataToObject(formData));
      await setEnquiryArchived(await getServiceContext(), input);
      refreshEnquiry(input.id, true);
      return { id: input.id };
    },
    { successMessage: "Enquiry updated", formData },
  );
}

export async function applySuggestionAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = enquirySuggestionSchema.parse(formDataToObject(formData));
      await applyHeaderSuggestion(await getServiceContext(), input);
      refreshEnquiry(input.id, true);
      return { id: input.id };
    },
    { successMessage: "Suggestion applied", formData },
  );
}

export async function createCustomerFromRequesterAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = customerFromRequesterSchema.parse(formDataToObject(formData));
      await createCustomerFromRequester(await getServiceContext(), input);
      refreshEnquiry(input.enquiryId, true);
      revalidatePath("/customers");
      return { id: input.enquiryId };
    },
    { successMessage: "Customer created and linked", formData },
  );
}

// ───────────────────────────────────────── items ─────────────────────────────────────────

/** One form serves both buttons: `intent=save` saves the edits; `intent=confirm` saves and confirms in a single transaction. */
export async function saveEnquiryItemAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  const raw = formDataToObject(formData);
  const confirming = raw.intent === "confirm";
  return runAction(
    async () => {
      const input = enquiryItemUpdateSchema.parse(raw);
      const ctx = await getServiceContext();
      const item = confirming ? await saveAndConfirmEnquiryItem(ctx, input) : await updateEnquiryItem(ctx, input);
      refreshEnquiry(item.enquiryId, confirming);
      return { id: item.enquiryId };
    },
    { successMessage: confirming ? "Requirement confirmed" : "Requirement saved", formData },
  );
}

export async function ignoreEnquiryItemAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const item = await ignoreEnquiryItem(await getServiceContext(), enquiryItemReasonSchema.parse(formDataToObject(formData)));
      refreshEnquiry(item.enquiryId, true);
      return { id: item.enquiryId };
    },
    { successMessage: "Requirement ignored", formData },
  );
}

export async function reopenEnquiryItemAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const item = await reopenEnquiryItem(await getServiceContext(), enquiryItemReasonSchema.parse(formDataToObject(formData)));
      refreshEnquiry(item.enquiryId, true);
      return { id: item.enquiryId };
    },
    { successMessage: "Requirement reopened", formData },
  );
}

export async function linkEnquiryItemAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const item = await setEnquiryItemProduct(await getServiceContext(), enquiryItemLinkSchema.parse(formDataToObject(formData)));
      refreshEnquiry(item.enquiryId);
      return { id: item.enquiryId };
    },
    { successMessage: "Product link saved", formData },
  );
}

export async function createProductForEnquiryItemAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const { item } = await createProductForEnquiryItem(await getServiceContext(), enquiryItemCreateProductSchema.parse(formDataToObject(formData)));
      refreshEnquiry(item.enquiryId);
      revalidatePath("/products");
      return { id: item.enquiryId };
    },
    { successMessage: "Product created and linked", formData },
  );
}

export async function addManualEnquiryItemAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const item = await addManualEnquiryItem(await getServiceContext(), enquiryItemManualCreateSchema.parse(formDataToObject(formData)));
      refreshEnquiry(item.enquiryId, true);
      return { id: item.id };
    },
    { successMessage: "Requirement added", formData },
  );
}
