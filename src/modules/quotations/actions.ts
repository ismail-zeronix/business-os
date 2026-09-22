"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { ValidationError } from "@/core/errors";
import { formDataToObject } from "@/core/validation/form-data";
import { zonedInputToUtc } from "@/lib/format";
import { lineAddSchema, lineFromConfirmationSchema, lineIdSchema, lineUpdateSchema, manualQuotationSchema, quotationCreateSchema, quotationDetailsSchema, quotationIdSchema } from "./schemas";
import { quotationEmailSchema, sendQuotationEmail } from "./email.service";
import { addLine, addLineFromConfirmation, createManualQuotation, createQuotation, issueQuotation, refreshLineCost, removeLine, reviseQuotation, updateLine, updateQuotationDetails } from "./service";

/** Thin server actions for quotations: FormData -> zod -> service -> revalidate -> ActionResult. Rules live in service.ts. */
type IdResult = ActionResult<{ id: string }>;

/** A quotation changed: its own page, the list, and the enquiry it belongs to (its header shows the quotation). */
function refresh(quotationId: string, enquiryId?: string | null) {
  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/quotations");
  if (enquiryId) revalidatePath(`/enquiries/${enquiryId}`);
}

/** Creating and revising send the person to the new draft, so there is no toast: arriving on the page is the feedback. */
export async function createQuotationAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const created = await createQuotation(await getServiceContext(), quotationCreateSchema.parse(formDataToObject(formData)));
      refresh(created.id, created.enquiryId);
      redirect(`/quotations/${created.id}`);
    },
    { formData },
  );
}

export async function createManualQuotationAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const created = await createManualQuotation(await getServiceContext(), manualQuotationSchema.parse(formDataToObject(formData)));
      refresh(created.id);
      redirect(`/quotations/${created.id}`);
    },
    { formData },
  );
}

export async function reviseQuotationAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const revised = await reviseQuotation(await getServiceContext(), quotationIdSchema.parse(formDataToObject(formData)));
      refresh(revised.id, revised.enquiryId);
      redirect(`/quotations/${revised.id}`);
    },
    { formData },
  );
}

export async function updateQuotationDetailsAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const updated = await updateQuotationDetails(await getServiceContext(), quotationDetailsSchema.parse(formDataToObject(formData)));
      refresh(updated.id, updated.enquiryId);
      return { id: updated.id };
    },
    { successMessage: "Details saved", formData },
  );
}

export async function issueQuotationAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const issued = await issueQuotation(await getServiceContext(), quotationIdSchema.parse(formDataToObject(formData)));
      refresh(issued.id, issued.enquiryId);
      return { id: issued.id };
    },
    { successMessage: "Quotation issued", formData },
  );
}

export async function addLineAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const line = await addLine(await getServiceContext(), lineAddSchema.parse(formDataToObject(formData)));
      refresh(line.quotationId);
      return { id: line.id };
    },
    { successMessage: "Line added", formData },
  );
}

/** A supplier confirmed a price by phone or message: it is recorded as supplier evidence and the line costs from it. */
export async function addLineFromConfirmationAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = lineFromConfirmationSchema.parse(formDataToObject(formData));
      const confirmedAtDate = zonedInputToUtc(input.confirmedAt);
      if (!confirmedAtDate) throw new ValidationError("Enter a valid date and time.", { confirmedAt: "Not a valid date and time" });
      const line = await addLineFromConfirmation(await getServiceContext(), { ...input, confirmedAtDate });
      refresh(line.quotationId);
      // The new price and product now exist system-wide: their pages and Search show them.
      revalidatePath("/products");
      revalidatePath("/search");
      revalidatePath("/broadcasts");
      return { id: line.id };
    },
    { successMessage: "Line added, and the supplier's confirmation recorded", formData },
  );
}

export async function updateLineAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const line = await updateLine(await getServiceContext(), lineUpdateSchema.parse(formDataToObject(formData)));
      refresh(line.quotationId);
      return { id: line.id };
    },
    { successMessage: "Line saved", formData },
  );
}

export async function removeLineAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const line = await removeLine(await getServiceContext(), lineIdSchema.parse(formDataToObject(formData)));
      refresh(line.quotationId);
      return { id: line.id };
    },
    { successMessage: "Line removed", formData },
  );
}

export async function refreshLineCostAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const line = await refreshLineCost(await getServiceContext(), lineIdSchema.parse(formDataToObject(formData)));
      refresh(line.quotationId);
      return { id: line.id };
    },
    { successMessage: "Cost updated from the chosen supplier", formData },
  );
}

/** Emails an issued quotation with its PDF. Only ever runs from an explicit Send; failures come back as a plain message and nothing is marked sent. */
export async function sendQuotationEmailAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const sent = await sendQuotationEmail(await getServiceContext(), quotationEmailSchema.parse(formDataToObject(formData)));
      refresh(sent.quotationId);
      revalidatePath("/customers");
      return { id: sent.id };
    },
    { successMessage: "Email sent", formData },
  );
}
