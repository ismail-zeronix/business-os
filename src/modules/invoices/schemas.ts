import { z } from "zod";
import { requiredText } from "../../core/validation/fields";

export const invoiceFromQuotationSchema = z.object({ quotationId: z.uuid() });
export const invoiceIdSchema = z.object({ id: z.uuid() });
export const invoiceCancelSchema = z.object({ id: z.uuid(), reason: requiredText("Reason", 300) });

export type InvoiceFromQuotationInput = z.output<typeof invoiceFromQuotationSchema>;
export type InvoiceIdInput = z.output<typeof invoiceIdSchema>;
export type InvoiceCancelInput = z.output<typeof invoiceCancelSchema>;
