import { beforeEach, describe, expect, it } from "vitest";
import { createTestContext, resetDatabase, testDb } from "@/test/helpers";

/**
 * The database's own rules (triggers, CHECK constraints, partial unique indexes), exercised directly through Prisma so a service bug can
 * never be the reason they hold. Runs against the "*_test" database only (see src/test/helpers.ts). Quotations here are manual ones
 * (no enquiry), which the schema allows.
 */

type DriverError = { meta?: { driverAdapterError?: { cause?: { originalMessage?: string } } }; message?: string };

/** Expects the promise to be refused by the database, and the database's own message (not Prisma's generic one) to match. */
async function guard(promise: Promise<unknown>, pattern: RegExp) {
  let error: DriverError | undefined;
  try {
    await promise;
  } catch (e) {
    error = e as DriverError;
  }
  expect(error, "the database should have refused this").toBeDefined();
  expect(error?.meta?.driverAdapterError?.cause?.originalMessage ?? error?.message ?? "").toMatch(pattern);
}

let actorId: string;

beforeEach(async () => {
  await resetDatabase();
  actorId = (await createTestContext()).actor.id;
});

let seq = 0;
const draft = (over: Record<string, unknown> = {}) => {
  seq += 1;
  return testDb.quotation.create({
    data: { quoteDate: new Date("2026-09-26"), quoteSeq: seq, createdById: actorId, customerName: "TEST Customer", validUntil: new Date("2026-12-31"), ...over },
  });
};
const line = (quotationId: string, over: Record<string, unknown> = {}) =>
  testDb.quotationLine.create({ data: { quotationId, position: 1, description: "TEST line", quantity: 2, unitPrice: "10.00", ...over } });
const issue = (id: string) => testDb.quotation.update({ where: { id }, data: { status: "ISSUED", issuedAt: new Date(), issuedById: actorId } });

describe("quotations guard", () => {
  it("must start as a draft", async () => {
    await guard(draft({ status: "ISSUED", issuedAt: new Date(), issuedById: actorId }), /starts as a draft/);
  });

  it("refuses issuing without a customer name, a valid-until date, a line, or a quantity and price on every line", async () => {
    const noName = await draft({ customerName: null });
    await line(noName.id);
    await guard(issue(noName.id), /customer name/);

    const noDate = await draft({ validUntil: null });
    await line(noDate.id);
    await guard(issue(noDate.id), /valid-until/);

    const noLines = await draft();
    await guard(issue(noLines.id), /at least one line/);

    const noPrice = await draft();
    await line(noPrice.id, { unitPrice: null });
    await guard(issue(noPrice.id), /quantity and a price/);
    await testDb.quotationLine.deleteMany({ where: { quotationId: noPrice.id } });
    await line(noPrice.id, { quantity: null });
    await guard(issue(noPrice.id), /quantity and a price/);
  });

  it("issues a complete draft, then freezes it", async () => {
    const q = await draft();
    await line(q.id);
    const issued = await issue(q.id);
    expect(issued.status).toBe("ISSUED");

    await guard(testDb.quotation.update({ where: { id: q.id }, data: { customerName: "Changed" } }), /issued/);
    await expect(testDb.quotation.update({ where: { id: q.id }, data: { status: "DRAFT", issuedAt: null, issuedById: null } })).rejects.toThrow();
    await guard(testDb.quotation.delete({ where: { id: q.id } }), /never deleted/);
  });

  it("lets an issued quotation only be superseded, and a superseded one never changes", async () => {
    const q = await draft();
    await line(q.id);
    await issue(q.id);
    await testDb.quotation.update({ where: { id: q.id }, data: { status: "SUPERSEDED", supersededAt: new Date() } });
    await guard(testDb.quotation.update({ where: { id: q.id }, data: { notes: "x" } }), /superseded/);
  });

  it("does not let a draft be superseded directly", async () => {
    const q = await draft();
    await guard(testDb.quotation.update({ where: { id: q.id }, data: { status: "SUPERSEDED", supersededAt: new Date() } }), /only an issued quotation/);
  });

  it("never lets the number, revision, or creator change", async () => {
    const q = await draft();
    await guard(testDb.quotation.update({ where: { id: q.id }, data: { revision: 2 } }), /cannot change/);
    await guard(testDb.quotation.update({ where: { id: q.id }, data: { number: q.number + 100 } }), /cannot change/);
  });

  it("allows a draft to be edited freely", async () => {
    const q = await draft();
    const updated = await testDb.quotation.update({ where: { id: q.id }, data: { customerName: "TEST Renamed", vatPercent: "0", notes: "n" } });
    expect(updated.customerName).toBe("TEST Renamed");
  });

  it("has CHECKs on currency, VAT and revision", async () => {
    await expect(draft({ currencyCode: "aed" })).rejects.toThrow();
    await expect(draft({ vatPercent: "100.01" })).rejects.toThrow();
    await expect(draft({ vatPercent: "-1" })).rejects.toThrow();
    await expect(draft({ revision: 0 })).rejects.toThrow();
  });

  it("has a unique number and revision", async () => {
    const q = await draft();
    await expect(draft({ number: q.number, revision: q.revision })).rejects.toThrow();
  });
});

describe("quotation lines guard", () => {
  it("can be added, changed and removed while the quotation is a draft", async () => {
    const q = await draft();
    const l = await line(q.id);
    await testDb.quotationLine.update({ where: { id: l.id }, data: { quantity: 5 } });
    await testDb.quotationLine.delete({ where: { id: l.id } });
    expect(await testDb.quotationLine.count({ where: { quotationId: q.id } })).toBe(0);
  });

  it("cannot be added, changed or removed once the quotation is issued", async () => {
    const q = await draft();
    const l = await line(q.id);
    await issue(q.id);
    await guard(line(q.id, { position: 2 }), /issued quotation/);
    await guard(testDb.quotationLine.update({ where: { id: l.id }, data: { quantity: 9 } }), /issued quotation/);
    await guard(testDb.quotationLine.delete({ where: { id: l.id } }), /issued quotation/);
  });

  it("cannot move to another quotation", async () => {
    const a = await draft();
    const b = await draft();
    const l = await line(a.id);
    await guard(testDb.quotationLine.update({ where: { id: l.id }, data: { quotationId: b.id } }), /cannot move/);
  });

  it("has CHECKs on quantity, price, markup and description", async () => {
    const q = await draft();
    await expect(line(q.id, { quantity: 0 })).rejects.toThrow();
    await expect(line(q.id, { unitPrice: "-0.01" })).rejects.toThrow();
    await expect(line(q.id, { markupPercent: "-100.01" })).rejects.toThrow();
    await expect(line(q.id, { description: "   " })).rejects.toThrow();
    // Boundaries that are allowed.
    await expect(line(q.id, { unitPrice: "0", markupPercent: "-100" })).resolves.toBeTruthy();
  });

  it("has a unique position within a quotation", async () => {
    const q = await draft();
    await line(q.id);
    await expect(line(q.id)).rejects.toThrow();
  });
});

describe("sent emails are permanent", () => {
  const account = () =>
    testDb.smtpAccount.create({
      data: { label: "TEST", host: "smtp.test", port: 465, username: "u", passwordEncrypted: "v1:x:y:z", fromName: "TEST", fromAddress: "test@example.test", createdById: actorId },
    });
  const email = (smtpAccountId: string, over: Record<string, unknown> = {}) =>
    testDb.sentEmail.create({
      data: { smtpAccountId, toAddresses: ["a@example.test"], ccAddresses: [], bccAddresses: [], subject: "TEST", bodyText: "TEST", status: "SENT", sentById: actorId, ...over },
    });

  it("cannot be updated or deleted", async () => {
    const a = await account();
    const e = await email(a.id);
    await guard(testDb.sentEmail.update({ where: { id: e.id }, data: { subject: "changed" } }), /permanent record/);
    await guard(testDb.sentEmail.delete({ where: { id: e.id } }), /permanent record/);
  });

  it("ties a failure to a reason", async () => {
    const a = await account();
    await expect(email(a.id, { status: "FAILED" })).rejects.toThrow();
    await expect(email(a.id, { status: "SENT", error: "boom" })).rejects.toThrow();
    await expect(email(a.id, { status: "FAILED", error: "The mail server could not be reached." })).resolves.toBeTruthy();
  });

  it("needs at least one recipient", async () => {
    const a = await account();
    await expect(email(a.id, { toAddresses: [] })).rejects.toThrow();
  });

  it("allows one active outgoing account at a time", async () => {
    await account();
    await expect(account()).rejects.toThrow();
    await expect(testDb.smtpAccount.create({ data: { label: "TEST2", host: "h", port: 587, username: "u", passwordEncrypted: "v1:x:y:z", fromName: "T", fromAddress: "t@example.test", status: "ARCHIVED", createdById: actorId } })).resolves.toBeTruthy();
  });

  it("checks the port range and the from address", async () => {
    const bad = (over: Record<string, unknown>) =>
      testDb.smtpAccount.create({ data: { label: "TEST", host: "h", port: 465, username: "u", passwordEncrypted: "v1:x:y:z", fromName: "T", fromAddress: "t@example.test", status: "ARCHIVED", createdById: actorId, ...over } });
    await expect(bad({ port: 0 })).rejects.toThrow();
    await expect(bad({ port: 65536 })).rejects.toThrow();
    await expect(bad({ fromAddress: "no-at-sign" })).rejects.toThrow();
  });
});

describe("the last admin", () => {
  it("cannot be demoted or deactivated, but can be once another admin exists", async () => {
    const admin = await testDb.user.create({ data: { email: "admin@example.test", name: "TEST Admin", role: "ADMIN" } });
    await testDb.user.update({ where: { id: actorId }, data: { role: "STAFF" } }); // the helper's user was the other admin
    await guard(testDb.user.update({ where: { id: admin.id }, data: { role: "STAFF" } }), /last active admin/);
    await guard(testDb.user.update({ where: { id: admin.id }, data: { status: "ARCHIVED" } }), /last active admin/);

    await testDb.user.update({ where: { id: actorId }, data: { role: "ADMIN" } });
    await expect(testDb.user.update({ where: { id: admin.id }, data: { role: "STAFF" } })).resolves.toBeTruthy();
  });

  it("stores only one row per session token hash, and rejects a negative failed-login count", async () => {
    await testDb.session.create({ data: { userId: actorId, tokenHash: "h1", expiresAt: new Date(Date.now() + 1000) } });
    await expect(testDb.session.create({ data: { userId: actorId, tokenHash: "h1", expiresAt: new Date(Date.now() + 1000) } })).rejects.toThrow();
    await expect(testDb.user.update({ where: { id: actorId }, data: { failedLoginCount: -1 } })).rejects.toThrow();
  });
});
