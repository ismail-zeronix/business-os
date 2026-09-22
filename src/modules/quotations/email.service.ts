import { createHash } from "node:crypto";
import { z } from "zod";
import { InvariantError, NotFoundError } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { decryptSecret, isSecretKeyConfigured } from "../../core/security/secret-box";
import { optionalText, requiredText } from "../../core/validation/fields";
import { writeAudit } from "../audit/service";
import { sendSmtpMail } from "../email/smtp";
import { composeEmailText } from "./email";
import { pdfFileName, renderQuotationPdf } from "./pdf";
import { quotationLabel, quotationScope } from "./shared";

/**
 * Emailing an issued quotation. SECURITY-SENSITIVE and outward-facing: it sends real mail to real people, so it only ever runs from an
 * explicit Send by a signed-in person, for an ISSUED quotation, from the one active outgoing account, to the addresses that person
 * typed. The exact PDF that was attached is stored with the record (a database trigger keeps it unchangeable), a failed attempt is
 * recorded with a plain reason, and both are audited. The account's password is decrypted only here, for the call.
 */

const addressList = (max = 10) =>
  z
    .preprocess((value) => (value == null || value === "" ? [] : Array.isArray(value) ? value : [value]), z.array(z.email("Enter valid email addresses").max(254)).max(max, `At most ${max} addresses`))
    .transform((list) => [...new Set(list.map((address) => address.toLowerCase()))]);

export const quotationEmailSchema = z.object({
  quotationId: z.uuid(),
  to: addressList().refine((list) => list.length >= 1, "Add at least one recipient"),
  cc: addressList(),
  bcc: addressList(),
  subject: requiredText("Subject", 300).refine((value) => !/[\r\n]/.test(value), "The subject must be a single line"),
  body: z
    .string({ error: "Write a message" })
    .refine((value) => value.trim().length > 0, "Write a message")
    .refine((value) => value.length <= 20_000, "The message is too long"),
  signature: optionalText(2000),
});
export type QuotationEmailInput = z.output<typeof quotationEmailSchema>;

export async function sendQuotationEmail(ctx: ServiceContext, input: QuotationEmailInput) {
  if (!isSecretKeyConfigured()) throw new InvariantError("APP_SECRET_KEY is not set, so the outgoing password cannot be read. Add it to .env and restart.");

  const quotation = await ctx.db.quotation.findUnique({ where: { id: input.quotationId }, select: { id: true, quoteDate: true, quoteSeq: true, revision: true, status: true, customerId: true } });
  if (!quotation) throw new NotFoundError("Quotation");
  if (quotation.status !== "ISSUED") {
    throw new InvariantError(quotation.status === "DRAFT" ? "Issue the quotation before emailing it." : "This revision was replaced by a newer one. Email the current revision instead.");
  }
  const account = await ctx.db.smtpAccount.findFirst({ where: { status: "ACTIVE" } });
  if (!account) throw new InvariantError("No outgoing email account is set up. An admin can add one in Settings > Email accounts > Outgoing.");

  const label = quotationLabel(quotation);
  const attachmentName = pdfFileName(label);
  const pdf = await renderQuotationPdf(quotation.id);
  const text = composeEmailText(input.body, input.signature);

  const result = await sendSmtpMail(
    { host: account.host, port: account.port, security: account.security, username: account.username, password: decryptSecret(account.passwordEncrypted) },
    {
      from: `"${account.fromName.replace(/"/g, "")}" <${account.fromAddress}>`,
      replyTo: account.replyTo,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      text,
      attachment: { filename: attachmentName, content: pdf, contentType: "application/pdf" },
    },
  );

  const record = {
    smtpAccountId: account.id,
    quotationId: quotation.id,
    customerId: quotation.customerId,
    toAddresses: input.to,
    ccAddresses: input.cc,
    bccAddresses: input.bcc,
    subject: input.subject,
    bodyText: text,
    attachmentName,
    attachmentSize: pdf.length,
    attachmentSha256: createHash("sha256").update(pdf).digest("hex"),
    attachmentBytes: new Uint8Array(pdf),
    sentById: ctx.actor.id,
  };
  // The customer's own Activity shows it too (one audit row, two views).
  const scope = quotation.customerId ? { type: "Customer" as const, id: quotation.customerId } : quotationScope(quotation.id);

  if (!result.ok) {
    await inTransaction(ctx, async (c) => {
      const failed = await c.db.sentEmail.create({ data: { ...record, status: "FAILED", error: result.message }, select: { id: true } });
      await writeAudit(c, { action: "quotation.email_failed", entityType: "Quotation", entityId: quotation.id, scope, details: { reference: label, to: input.to, reason: result.message, record: failed.id } });
    });
    throw new InvariantError(`The email was not sent: ${result.message}`);
  }

  return inTransaction(ctx, async (c) => {
    const sent = await c.db.sentEmail.create({ data: { ...record, status: "SENT", messageId: result.messageId }, select: { id: true } });
    await writeAudit(c, {
      action: "quotation.emailed",
      entityType: "Quotation",
      entityId: quotation.id,
      scope,
      details: { reference: label, to: input.to, cc: input.cc, bccCount: input.bcc.length, subject: input.subject, attachment: attachmentName, from: account.fromAddress, record: sent.id },
    });
    return { id: sent.id, quotationId: quotation.id, to: input.to };
  });
}
