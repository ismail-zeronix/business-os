import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceContext } from "@/core/database/tx";
import { ForbiddenError, InvariantError, NotFoundError } from "@/core/errors";
import { decryptSecret, encryptSecret } from "@/core/security/secret-box";
import { createTestContext, resetDatabase, testDb } from "@/test/helpers";
import { createSmtpAccount, setSmtpAccountStatus, testSmtpAccount, updateSmtpAccount } from "../email/smtp-account.service";
import { smtpAccountCreateSchema, smtpAccountUpdateSchema } from "../email/smtp.schemas";
import { saveOwnSignature } from "../users/signature.service";

// The SMTP server and headless Chrome are replaced by stubs: no real mail is ever sent and no browser is started.
const sendSmtpMail = vi.hoisted(() => vi.fn());
const renderQuotationPdf = vi.hoisted(() => vi.fn());
vi.mock("../email/smtp", async (original) => ({ ...(await original<typeof import("../email/smtp")>()), sendSmtpMail }));
vi.mock("./pdf", async (original) => ({ ...(await original<typeof import("./pdf")>()), renderQuotationPdf }));

import { quotationEmailSchema, sendQuotationEmail } from "./email.service";
import { addLine, createManualQuotation, issueQuotation, reviseQuotation, updateQuotationDetails } from "./service";
import { lineAddSchema, manualQuotationSchema, quotationDetailsSchema } from "./schemas";

const KEY = Buffer.alloc(32, 5).toString("base64");
const PDF = Buffer.from("%PDF-1.4 TEST pdf bytes");
const PASSWORD = "TEST-smtp-password-123";

let ctx: ServiceContext;

beforeEach(async () => {
  vi.stubEnv("APP_SECRET_KEY", KEY);
  sendSmtpMail.mockReset();
  sendSmtpMail.mockResolvedValue({ ok: true, messageId: "<test-message-id@example.test>" });
  renderQuotationPdf.mockReset();
  renderQuotationPdf.mockResolvedValue(PDF);
  await resetDatabase();
  ctx = await createTestContext();
});
afterEach(() => vi.unstubAllEnvs());

const accountInput = (over: Record<string, unknown> = {}) =>
  smtpAccountCreateSchema.parse({ label: "TEST outgoing", host: "smtp.example.test", port: "465", security: "SSL_TLS", fromName: 'TEST "Sales"', fromAddress: "Sales@Example.Test", username: "user@example.test", password: PASSWORD, ...over });

async function issuedQuotation(customerName = "TEST Customer") {
  const { id } = await createManualQuotation(ctx, manualQuotationSchema.parse({ customerName }));
  await updateQuotationDetails(ctx, quotationDetailsSchema.parse({ id, customerName, currencyCode: "AED", vatPercent: "5", validUntil: "2099-12-31" }));
  await addLine(ctx, lineAddSchema.parse({ quotationId: id, description: "TEST line", quantity: "1", unitPrice: "10" }));
  await issueQuotation(ctx, { id });
  return id;
}

const emailInput = (quotationId: string, over: Record<string, unknown> = {}) =>
  quotationEmailSchema.parse({ quotationId, to: ["Buyer@Example.Test"], subject: "TEST quotation", body: "TEST body", signature: "TEST signature", ...over });

describe("quotationEmailSchema", () => {
  const id = "01a0db65-5ba7-75e3-a993-a458968ec3b7";
  it("lower-cases and de-duplicates addresses, and accepts a single string", () => {
    const parsed = quotationEmailSchema.parse({ quotationId: id, to: "A@x.test", cc: ["b@x.test", "B@x.test"], subject: "s", body: "b" });
    expect(parsed).toMatchObject({ to: ["a@x.test"], cc: ["b@x.test"], bcc: [], signature: null });
  });
  it("needs a recipient, valid addresses, a one-line subject and a message", () => {
    expect(quotationEmailSchema.safeParse({ quotationId: id, to: [], subject: "s", body: "b" }).success).toBe(false);
    expect(quotationEmailSchema.safeParse({ quotationId: id, to: ["nope"], subject: "s", body: "b" }).success).toBe(false);
    expect(quotationEmailSchema.safeParse({ quotationId: id, to: ["a@x.test"], subject: "a\nBcc: evil@x.test", body: "b" }).success).toBe(false);
    expect(quotationEmailSchema.safeParse({ quotationId: id, to: ["a@x.test"], subject: "s", body: "   " }).success).toBe(false);
  });
  it("limits how many addresses one email can have", () => {
    const many = Array.from({ length: 11 }, (_, i) => `a${i}@x.test`);
    expect(quotationEmailSchema.safeParse({ quotationId: id, to: many, subject: "s", body: "b" }).success).toBe(false);
  });
});

describe("sendQuotationEmail", () => {
  it("sends an issued quotation from the active account, stores the exact PDF and audits on the quotation", async () => {
    await createSmtpAccount(ctx, accountInput());
    const id = await issuedQuotation();
    const result = await sendQuotationEmail(ctx, emailInput(id));

    expect(sendSmtpMail).toHaveBeenCalledTimes(1);
    const [config, mail] = sendSmtpMail.mock.calls[0]!;
    expect(config).toMatchObject({ host: "smtp.example.test", port: 465, username: "user@example.test", password: PASSWORD });
    expect(mail).toMatchObject({ to: ["buyer@example.test"], cc: [], bcc: [], subject: "TEST quotation" });
    expect(mail.from).toBe('"TEST Sales" <sales@example.test>'); // quotes stripped from the name, address lower-cased
    expect(mail.text).toBe("TEST body\n\nTEST signature");
    expect(mail.attachment).toMatchObject({ contentType: "application/pdf" });
    expect(mail.attachment.filename).toMatch(/^Quotation-QUO-\d{8}-0001\.pdf$/);

    const record = await testDb.sentEmail.findUniqueOrThrow({ where: { id: result.id } });
    expect(record).toMatchObject({ status: "SENT", error: null, messageId: "<test-message-id@example.test>", quotationId: id, sentById: ctx.actor.id, subject: "TEST quotation" });
    expect(Buffer.from(record.attachmentBytes!).equals(PDF)).toBe(true);
    expect(record.attachmentSha256).toBe(createHash("sha256").update(PDF).digest("hex"));
    expect(record.attachmentSize).toBe(PDF.length);

    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "quotation.emailed" } });
    expect(audit).toMatchObject({ entityId: id, scopeType: "Quotation", scopeId: id });
    expect(JSON.stringify(audit.details)).not.toContain(PASSWORD);
  });

  it("shows on the customer's activity too when the quotation has a saved customer", async () => {
    await createSmtpAccount(ctx, accountInput());
    const customer = await testDb.customer.create({ data: { name: "TEST Saved", normalizedName: "test saved" } });
    const { id } = await createManualQuotation(ctx, manualQuotationSchema.parse({ customerId: customer.id }));
    await updateQuotationDetails(ctx, quotationDetailsSchema.parse({ id, customerName: "TEST Saved", currencyCode: "AED", vatPercent: "5", validUntil: "2099-12-31" }));
    await addLine(ctx, lineAddSchema.parse({ quotationId: id, description: "TEST", quantity: "1", unitPrice: "1" }));
    await issueQuotation(ctx, { id });
    await sendQuotationEmail(ctx, emailInput(id));
    expect(await testDb.auditLog.findFirstOrThrow({ where: { action: "quotation.emailed" } })).toMatchObject({ scopeType: "Customer", scopeId: customer.id });
  });

  it("stores a failed attempt with a plain reason, audits it, and throws", async () => {
    await createSmtpAccount(ctx, accountInput());
    const id = await issuedQuotation();
    sendSmtpMail.mockResolvedValue({ ok: false, message: "The mail server could not be reached." });
    await expect(sendQuotationEmail(ctx, emailInput(id))).rejects.toThrow("The email was not sent: The mail server could not be reached.");

    const [record] = await testDb.sentEmail.findMany();
    expect(record).toMatchObject({ status: "FAILED", error: "The mail server could not be reached.", messageId: null });
    expect(await testDb.auditLog.count({ where: { action: "quotation.email_failed" } })).toBe(1);
    expect(await testDb.auditLog.count({ where: { action: "quotation.emailed" } })).toBe(0);
  });

  it("only sends an ISSUED quotation", async () => {
    await createSmtpAccount(ctx, accountInput());
    const draft = (await createManualQuotation(ctx, manualQuotationSchema.parse({ customerName: "TEST" }))).id;
    await expect(sendQuotationEmail(ctx, emailInput(draft))).rejects.toThrow("Issue the quotation before emailing it.");

    const issued = await issuedQuotation();
    await reviseQuotation(ctx, { id: issued });
    await expect(sendQuotationEmail(ctx, emailInput(issued))).rejects.toThrow(/replaced by a newer one/);
    expect(sendSmtpMail).not.toHaveBeenCalled();
    expect(renderQuotationPdf).not.toHaveBeenCalled();
    expect(await testDb.sentEmail.count()).toBe(0);
  });

  it("needs an active outgoing account, a key, and an existing quotation", async () => {
    const id = await issuedQuotation();
    await expect(sendQuotationEmail(ctx, emailInput(id))).rejects.toThrow(/No outgoing email account/);

    await createSmtpAccount(ctx, accountInput());
    await expect(sendQuotationEmail(ctx, emailInput("01a0db65-5ba7-75e3-a993-a458968ec3b7"))).rejects.toBeInstanceOf(NotFoundError);

    vi.stubEnv("APP_SECRET_KEY", "");
    await expect(sendQuotationEmail(ctx, emailInput(id))).rejects.toBeInstanceOf(InvariantError);
    expect(sendSmtpMail).not.toHaveBeenCalled();
  });
});

describe("outgoing account service", () => {
  it("is admin only", async () => {
    const staff: ServiceContext = { ...ctx, actor: { ...ctx.actor, role: "STAFF" } };
    await expect(createSmtpAccount(staff, accountInput())).rejects.toBeInstanceOf(ForbiddenError);
    const { id } = await createSmtpAccount(ctx, accountInput());
    await expect(updateSmtpAccount(staff, smtpAccountUpdateSchema.parse({ id, ...accountInput(), password: "" }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setSmtpAccountStatus(staff, { id, status: "INACTIVE" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(testSmtpAccount(staff, { id, to: "a@x.test" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("stores the password encrypted, and never in the audit log", async () => {
    const { id } = await createSmtpAccount(ctx, accountInput());
    const row = await testDb.smtpAccount.findUniqueOrThrow({ where: { id } });
    expect(row.passwordEncrypted).not.toContain(PASSWORD);
    expect(decryptSecret(row.passwordEncrypted)).toBe(PASSWORD);
    const audits = JSON.stringify(await testDb.auditLog.findMany());
    expect(audits).not.toContain(PASSWORD);
    expect(audits).not.toContain(row.passwordEncrypted);
  });

  it("activating one account deactivates the other", async () => {
    const first = await createSmtpAccount(ctx, accountInput({ label: "TEST one" }));
    const second = await createSmtpAccount(ctx, accountInput({ label: "TEST two" }));
    expect((await testDb.smtpAccount.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("INACTIVE");
    expect((await testDb.smtpAccount.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("ACTIVE");

    await setSmtpAccountStatus(ctx, { id: first.id, status: "ACTIVE" });
    expect((await testDb.smtpAccount.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("INACTIVE");
    expect(await testDb.smtpAccount.count({ where: { status: "ACTIVE" } })).toBe(1);
  });

  it("keeps the stored password on edit when the field is left blank, and audits only that it changed when it is replaced", async () => {
    const { id } = await createSmtpAccount(ctx, accountInput());
    const before = (await testDb.smtpAccount.findUniqueOrThrow({ where: { id } })).passwordEncrypted;
    await updateSmtpAccount(ctx, smtpAccountUpdateSchema.parse({ id, ...accountInput({ label: "TEST renamed" }), password: "" }));
    expect((await testDb.smtpAccount.findUniqueOrThrow({ where: { id } })).passwordEncrypted).toBe(before);

    await updateSmtpAccount(ctx, smtpAccountUpdateSchema.parse({ id, ...accountInput({ label: "TEST renamed" }), password: "TEST-new-password" }));
    const after = (await testDb.smtpAccount.findUniqueOrThrow({ where: { id } })).passwordEncrypted;
    expect(after).not.toBe(before);
    expect(decryptSecret(after)).toBe("TEST-new-password");
    const changed = await testDb.auditLog.findFirstOrThrow({ where: { action: "smtp_account.password_changed" } });
    expect(JSON.stringify(changed.details ?? null)).not.toContain("TEST-new-password");
  });

  it("copies the login of an incoming mailbox without decrypting it", async () => {
    const encrypted = encryptSecret("TEST-incoming-password");
    const mailbox = await testDb.emailAccount.create({
      data: { label: "TEST incoming", host: "imap.example.test", port: 993, security: "SSL_TLS", username: "in@example.test", passwordEncrypted: encrypted, normalizedKey: "imap.example.test|993|in@example.test|inbox", syncFromDate: new Date("2026-01-01"), createdById: ctx.actor.id },
    });
    const { id } = await createSmtpAccount(ctx, smtpAccountCreateSchema.parse({ label: "TEST copy", host: "smtp.example.test", port: "465", security: "SSL_TLS", fromName: "TEST", fromAddress: "x@example.test", copyLoginFromAccountId: mailbox.id }));
    expect(await testDb.smtpAccount.findUniqueOrThrow({ where: { id } })).toMatchObject({ username: "in@example.test", passwordEncrypted: encrypted });
  });

  it("records how a test message went, and returns only ok or a plain message", async () => {
    const { id } = await createSmtpAccount(ctx, accountInput());
    expect(await testSmtpAccount(ctx, { id, to: "me@example.test" })).toEqual({ ok: true });
    expect(await testDb.smtpAccount.findUniqueOrThrow({ where: { id } })).toMatchObject({ lastTestStatus: "OK", lastTestError: null });

    sendSmtpMail.mockResolvedValue({ ok: false, message: "Sign-in failed. Check the username and password." });
    expect(await testSmtpAccount(ctx, { id, to: "me@example.test" })).toEqual({ ok: false, message: "Sign-in failed. Check the username and password." });
    expect(await testDb.smtpAccount.findUniqueOrThrow({ where: { id } })).toMatchObject({ lastTestStatus: "ERROR", lastTestError: "Sign-in failed. Check the username and password." });
  });

  it("refuses to store a password when no key is configured", async () => {
    vi.stubEnv("APP_SECRET_KEY", "");
    await expect(createSmtpAccount(ctx, accountInput())).rejects.toBeInstanceOf(InvariantError);
    expect(await testDb.smtpAccount.count()).toBe(0);
  });
});

describe("saveOwnSignature", () => {
  it("saves and clears only the signed-in person's own signature, and audits without repeating the text", async () => {
    const other = await testDb.user.create({ data: { email: "other@example.test", name: "TEST Other" } });
    await saveOwnSignature(ctx, { signature: "TEST secret-ish signature" });
    expect((await testDb.user.findUniqueOrThrow({ where: { id: ctx.actor.id } })).emailSignature).toBe("TEST secret-ish signature");
    expect((await testDb.user.findUniqueOrThrow({ where: { id: other.id } })).emailSignature).toBeNull();

    await saveOwnSignature(ctx, { signature: null });
    expect((await testDb.user.findUniqueOrThrow({ where: { id: ctx.actor.id } })).emailSignature).toBeNull();
    const audits = await testDb.auditLog.findMany({ where: { action: "user.signature_changed" } });
    expect(audits).toHaveLength(2);
    expect(JSON.stringify(audits)).not.toContain("secret-ish");
  });

  it("writes no audit row when nothing changed", async () => {
    await saveOwnSignature(ctx, { signature: "TEST same" });
    await saveOwnSignature(ctx, { signature: "TEST same" });
    expect(await testDb.auditLog.count({ where: { action: "user.signature_changed" } })).toBe(1);
  });
});
