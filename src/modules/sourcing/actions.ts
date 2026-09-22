"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/core/errors";
import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { zonedInputToUtc } from "@/lib/format";
import { composeSentText } from "./message";
import { chooseSupplier, clearChoice } from "./decision.service";
import { decisionChooseSchema, decisionClearSchema, requestAddSchema, requestIdSchema, requestOutcomeSchema, requestSentSchema } from "./schemas";
import { addSupplierRequest, markRequestSent, removeSupplierRequest, reopenRequest, setRequestOutcome } from "./service";

/** Thin server actions for the Sourcing tab: FormData -> zod -> service -> revalidate -> ActionResult. Rules live in service.ts. */
type IdResult = ActionResult<{ id: string }>;

function refresh(enquiryId: string) {
  revalidatePath(`/enquiries/${enquiryId}`);
  revalidatePath("/enquiries");
}

export async function addSupplierRequestAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const request = await addSupplierRequest(await getServiceContext(), requestAddSchema.parse(formDataToObject(formData)));
      refresh(request.enquiryId);
      return { id: request.id };
    },
    { successMessage: "Supplier added", formData },
  );
}

export async function removeSupplierRequestAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const removed = await removeSupplierRequest(await getServiceContext(), requestIdSchema.parse(formDataToObject(formData)));
      refresh(removed.enquiryId);
      return { id: removed.id };
    },
    { successMessage: "Supplier removed", formData },
  );
}

export async function markRequestSentAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = requestSentSchema.parse(formDataToObject(formData));
      const sentAt = zonedInputToUtc(input.sentAt);
      if (!sentAt) throw new ValidationError("Enter a valid date and time.", { sentAt: "Not a valid date and time" });
      const request = await markRequestSent(await getServiceContext(), {
        id: input.id,
        messageText: composeSentText(input.subject, input.body),
        channel: input.channel,
        sentAt,
      });
      refresh(request.enquiryId);
      return { id: request.id };
    },
    { successMessage: "Marked as sent", formData },
  );
}

export async function setRequestOutcomeAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const request = await setRequestOutcome(await getServiceContext(), requestOutcomeSchema.parse(formDataToObject(formData)));
      refresh(request.enquiryId);
      return { id: request.id };
    },
    { successMessage: "Request updated", formData },
  );
}

export async function chooseSupplierAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const choice = await chooseSupplier(await getServiceContext(), decisionChooseSchema.parse(formDataToObject(formData)));
      refresh(choice.enquiryId);
      return { id: choice.id };
    },
    { successMessage: "Supplier chosen", formData },
  );
}

export async function clearChoiceAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const choice = await clearChoice(await getServiceContext(), decisionClearSchema.parse(formDataToObject(formData)));
      refresh(choice.enquiryId);
      return { id: choice.id };
    },
    { successMessage: "Choice cleared", formData },
  );
}

export async function reopenRequestAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const request = await reopenRequest(await getServiceContext(), requestIdSchema.parse(formDataToObject(formData)));
      refresh(request.enquiryId);
      return { id: request.id };
    },
    { successMessage: "Request reopened", formData },
  );
}
