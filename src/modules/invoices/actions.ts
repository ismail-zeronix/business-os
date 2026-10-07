"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { invoiceCancelSchema, invoiceFromQuotationSchema, invoiceIdSchema } from "./schemas";
import { cancelInvoice, createInvoiceFromQuotation, issueInvoice, markInvoicePaid } from "./service";

/** Thin server actions for invoices: FormData -> zod -> service -> revalidate -> ActionResult. Rules live in service.ts. */
type IdResult = ActionResult<{ id: string }>;

function refresh(invoiceId: string, quotationId?: string) {
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  if (quotationId) revalidatePath(`/quotations/${quotationId}`);
}

/** Creating sends the person to the new invoice, so there is no toast: arriving on the page is the feedback. */
export async function createInvoiceFromQuotationAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = invoiceFromQuotationSchema.parse(formDataToObject(formData));
      const created = await createInvoiceFromQuotation(await getServiceContext(), input);
      refresh(created.id, input.quotationId);
      redirect(`/invoices/${created.id}`);
    },
    { formData },
  );
}

export async function issueInvoiceAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const result = await issueInvoice(await getServiceContext(), invoiceIdSchema.parse(formDataToObject(formData)));
      refresh(result.id);
      return result;
    },
    { successMessage: "Invoice issued", formData },
  );
}

export async function markInvoicePaidAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const result = await markInvoicePaid(await getServiceContext(), invoiceIdSchema.parse(formDataToObject(formData)));
      refresh(result.id);
      return result;
    },
    { successMessage: "Invoice marked paid", formData },
  );
}

export async function cancelInvoiceAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const result = await cancelInvoice(await getServiceContext(), invoiceCancelSchema.parse(formDataToObject(formData)));
      refresh(result.id);
      return result;
    },
    { successMessage: "Invoice cancelled", formData },
  );
}
