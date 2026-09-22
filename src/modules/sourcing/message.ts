/**
 * The text a buyer sends a supplier. Pure and deterministic: no I/O, no customer data. The input type has no customer field on purpose,
 * so the customer's name, email and enquiry reference cannot reach the message. A requirement's own wording is copied from the customer's
 * request, so the buyer still reads the text before sending it (the message drawer says so).
 */

export type RequestLine = {
  description: string | null;
  brandText: string | null;
  modelText: string | null;
  partNumber: string | null;
  specText: string | null;
  quantity: number | null;
};

export type RequestMessage = { subject: string; body: string };

const includesText = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());

/** What is being asked for, as one label. Parts that are unknown are left out, never invented. */
export function lineTitle(line: RequestLine): string {
  return line.description?.trim() || [line.brandText, line.modelText].filter(Boolean).join(" ").trim() || line.partNumber?.trim() || "Item";
}

/** "Dell Latitude 5440 i7 16/512 - P/N 83A100SUAK - Qty: 50". Unknown quantity reads "to be confirmed". */
export function describeLine(line: RequestLine): string {
  const title = lineTitle(line);
  const extras = [
    line.modelText && !includesText(title, line.modelText) ? `Model ${line.modelText}` : null,
    line.partNumber && !includesText(title, line.partNumber) ? `P/N ${line.partNumber}` : null,
    line.specText && !includesText(title, line.specText) ? line.specText : null,
  ].filter((part): part is string => Boolean(part));
  const quantity = line.quantity != null ? `Qty: ${line.quantity.toLocaleString("en-US")}` : "Qty: to be confirmed";
  return [title, ...extras, quantity].join(" - ");
}

export function buildRequestMessage(input: { contactName: string | null; lines: readonly RequestLine[] }): RequestMessage {
  const [first, ...rest] = input.lines;
  const subject = first ? `Quotation request: ${lineTitle(first)}${rest.length ? ` +${rest.length} more` : ""}` : "Quotation request";
  const name = input.contactName?.trim();
  const body = [
    name ? `Hello ${name},` : "Hello,",
    "",
    "Could you please quote the following?",
    "",
    ...input.lines.map((line, index) => `${index + 1}. ${describeLine(line)}`),
    "",
    "Please reply with:",
    "- your price per unit, and whether VAT is included",
    "- the quantity you can supply, and whether it is ready stock",
    "- lead time, if it is not ready stock",
    "",
    "Thank you.",
  ].join("\n");
  return { subject, body };
}

/** What is stored when a request is marked sent: the subject line (if there is one), a blank line, then the body. */
export function composeSentText(subject: string | null, body: string): string {
  const trimmed = subject?.trim();
  return trimmed ? `Subject: ${trimmed}\n\n${body}` : body;
}
