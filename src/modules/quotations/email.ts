import { COMPANY } from "../../config/company";
import { QUOTATION_EMAIL } from "../../config/quotation-email";
import { formatDate, formatMoney } from "../../lib/format";

/**
 * The words of a quotation email, written for the person to read and edit before sending. Pure: no I/O. The message is plain text so it
 * reads the same in every mail program. Nothing here is a promise the quotation itself does not make: the currency, VAT, validity, payment
 * and delivery terms are the quotation's own, and only the standard lines in config/quotation-email.ts are general.
 */

export type EmailTemplateInput = {
  /** "QUO-20260921-0001", with " rev 2" from the second revision. */
  reference: string;
  /** Who it is addressed to (the quotation's Attention). Null greets "Sir or Madam". */
  contactName: string | null;
  currency: string;
  vatPercent: number;
  /** The total including VAT, "8507.10". */
  total: string;
  validUntil: Date | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  notes: string | null;
};

export const quotationEmailSubject = (reference: string): string => `Quotation ${reference} from ${COMPANY.name}`;

export function buildQuotationEmailBody(input: EmailTemplateInput): string {
  const terms = [
    `All prices are in ${input.currency} and exclude VAT; ${input.vatPercent}% VAT is added in the total.`,
    input.paymentTerms ? `Payment terms: ${input.paymentTerms}` : null,
    input.deliveryTerms ? `Delivery: ${input.deliveryTerms}` : null,
    input.validUntil ? `This quotation is valid until ${formatDate(input.validUntil)}.` : null,
    ...QUOTATION_EMAIL.standardTerms,
  ].filter((line): line is string => Boolean(line));

  return [
    `Dear ${input.contactName?.trim() || "Sir or Madam"},`,
    "",
    `Thank you for your enquiry. Please find attached our quotation ${input.reference} for ${formatMoney(input.total, input.currency)} including VAT.`,
    "",
    "Terms in brief",
    ...terms.map((line) => `- ${line}`),
    ...(input.notes?.trim() ? ["", `Note: ${input.notes.trim()}`] : []),
    "",
    "Please let us know if you would like to proceed, or if you need any changes.",
  ].join("\n");
}

/** What a person with no saved signature starts with: their name and the company's own details. */
export function defaultSignature(name: string): string {
  return ["Best regards,", name, COMPANY.name, [COMPANY.phones[0], COMPANY.emails[0]].filter(Boolean).join(" | ")].filter(Boolean).join("\n");
}

/** The message and the signature as one text, a blank line apart. */
export const composeEmailText = (body: string, signature: string | null): string => (signature?.trim() ? `${body.trimEnd()}\n\n${signature.trim()}` : body.trimEnd());
