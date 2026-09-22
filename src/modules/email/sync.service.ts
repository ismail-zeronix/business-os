import type { ImapFlow } from "imapflow";
import { ConflictError, InvariantError, NotFoundError } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { decryptSecret } from "../../core/security/secret-box";
import type { Prisma } from "../../generated/prisma/client";
import { writeAudit } from "../audit/service";
import { findKnownCustomerByEmail } from "../customers/queries";
import { createEvidence } from "../evidence/service";
import { describeImapError, openClient } from "./imap";
import { normalizeEmail, renderEvidenceText, type NormalizedEmail } from "./mime";
import { getEmailAccountForSync } from "./queries";
import { scoreEmail } from "./scoring/score";
import { stripQuotedForScoring } from "./text";

/**
 * Mailbox sync (docs/plans/active/CURRENT.md section 10). Reads new messages from one IMAP folder, READ-ONLY, and stores each as
 * immutable evidence with a deterministic enquiry score. It never creates an enquiry: a person does that from the triage queue.
 *
 *  - overlap guard: a compare-and-set lease on the account, so two syncs of one account cannot run at once
 *  - bounded: only messages on or after the account's sync-from date, at most MAX_PER_RUN per run, oldest first (Sync again continues)
 *  - cursor: (uid_validity, last_uid). A changed UIDVALIDITY restarts from the sync-from date; Message-ID de-duplication prevents repeats
 *  - nothing is dropped silently: an unreadable or oversized message is stored as a row that says so
 *  - errors are stored as short sanitised sentences; the password and raw error text never leave this module
 * Relative imports only, so `scripts/mail-sync.ts` can use it.
 */

export const MAX_PER_RUN = 200;
export const MAX_RAW_BYTES = 20 * 1024 * 1024;
const LEASE_MS = 10 * 60_000;

export type SyncResult = { ingested: number; skipped: number; errors: number; remaining: boolean; error: string | null };

export type Account = NonNullable<Awaited<ReturnType<typeof getEmailAccountForSync>>>;
export type MasterLists = { brands: string[]; categories: string[]; families: string[] };
type Outcome = "ingested" | "skipped";

const toDate = (value: Date | string | undefined | null): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function loadMasterLists(ctx: ServiceContext): Promise<MasterLists> {
  const [brands, categories, families] = await Promise.all([
    ctx.db.brand.findMany({ where: { status: { not: "ARCHIVED" } }, select: { name: true } }),
    ctx.db.category.findMany({ where: { status: { not: "ARCHIVED" } }, select: { name: true } }),
    ctx.db.product.findMany({ where: { status: { not: "ARCHIVED" }, family: { not: null } }, select: { family: true }, distinct: ["family"] }),
  ]);
  return { brands: brands.map((b) => b.name), categories: categories.map((c) => c.name), families: families.map((p) => p.family as string) };
}

/** True when the address belongs to a supplier (a contact's email or the supplier's general email): such mail is usually a price list. */
async function isKnownSupplier(ctx: ServiceContext, address: string): Promise<boolean> {
  const same = { equals: address, mode: "insensitive" as const };
  const [contact, supplier] = await Promise.all([
    ctx.db.supplierContact.findFirst({ where: { email: same, status: { not: "ARCHIVED" } }, select: { id: true } }),
    ctx.db.supplier.findFirst({ where: { email: same, status: { not: "ARCHIVED" } }, select: { id: true } }),
  ]);
  return Boolean(contact || supplier);
}

/** Stores one message, or skips it if it is already stored. Everything for one message is written in one transaction. */
export async function ingestMessage(ctx: ServiceContext, client: ImapFlow, account: Account, uidValidity: bigint, uid: number, lists: MasterLists): Promise<Outcome> {
  const folder = account.folder;
  const already = await ctx.db.emailMessage.findUnique({
    where: { accountId_folder_uidValidity_uid: { accountId: account.id, folder, uidValidity, uid: BigInt(uid) } },
    select: { id: true },
  });
  if (already) return "skipped";

  const meta = await client.fetchOne(String(uid), { uid: true, size: true, internalDate: true, envelope: true }, { uid: true });
  if (!meta) return "skipped"; // removed from the server since it was listed
  const size = meta.size ?? 0;
  const receivedAt = toDate(meta.internalDate) ?? new Date();
  const envelope = meta.envelope;
  const envelopeFrom = envelope?.from?.[0];

  let raw: Buffer | null = null;
  let parseError: string | null = null;
  if (size > MAX_RAW_BYTES) {
    parseError = `The message is larger than ${MAX_RAW_BYTES / (1024 * 1024)} MB, so the original was not downloaded.`;
  } else {
    const full = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
    raw = full && full.source ? Buffer.from(full.source) : null;
    if (!raw) parseError = "The message could not be downloaded.";
  }

  let email: NormalizedEmail | null = null;
  if (raw) {
    try {
      email = await normalizeEmail(raw);
    } catch {
      parseError = "The message could not be read (invalid format). The original is preserved.";
    }
  }

  // What we know about the message. A message that could not be parsed still gets a row (nothing is silently skipped).
  const known: NormalizedEmail = email ?? {
    messageId: envelope?.messageId?.trim() || null,
    inReplyTo: null,
    referencesHeader: null,
    fromName: envelopeFrom?.name?.trim() || null,
    fromAddress: envelopeFrom?.address?.trim().toLowerCase() || null,
    to: [],
    cc: [],
    subject: envelope?.subject?.trim() || null,
    sentAt: toDate(envelope?.date),
    textBody: `(${parseError ?? "This message could not be read."})`,
    attachments: [],
    hasListUnsubscribe: false,
    autoSubmitted: false,
  };

  if (known.messageId) {
    const duplicate = await ctx.db.emailMessage.findFirst({ where: { accountId: account.id, messageId: known.messageId }, select: { id: true } });
    if (duplicate) return "skipped";
  }

  const [customer, supplier] = await Promise.all([
    known.fromAddress ? findKnownCustomerByEmail(known.fromAddress) : Promise.resolve(null),
    known.fromAddress ? isKnownSupplier(ctx, known.fromAddress) : Promise.resolve(false),
  ]);
  const score = parseError
    ? { score: 0, band: "LOW" as const, reasons: [{ label: parseError, points: 0 }] }
    : scoreEmail(
        {
          subject: known.subject,
          visibleText: stripQuotedForScoring(known.textBody),
          fromAddress: known.fromAddress,
          attachmentNames: known.attachments.map((a) => a.filename ?? ""),
          hasListUnsubscribe: known.hasListUnsubscribe,
          autoSubmitted: known.autoSubmitted,
        },
        { ...lists, knownCustomer: Boolean(customer), knownSupplier: supplier },
      );

  await inTransaction(ctx, async (c) => {
    const evidence = await createEvidence(c, { kind: "CUSTOMER_EMAIL", channel: "EMAIL", rawText: renderEvidenceText(known, receivedAt), observedAt: receivedAt });
    await c.db.emailMessage.create({
      data: {
        accountId: account.id,
        folder,
        uid: BigInt(uid),
        uidValidity,
        messageId: known.messageId,
        inReplyTo: known.inReplyTo,
        referencesHeader: known.referencesHeader,
        fromName: known.fromName,
        fromAddress: known.fromAddress,
        toAddresses: known.to as unknown as Prisma.InputJsonValue,
        ccAddresses: known.cc as unknown as Prisma.InputJsonValue,
        subject: known.subject,
        sentAt: known.sentAt,
        receivedAt,
        textBody: known.textBody,
        attachments: known.attachments as unknown as Prisma.InputJsonValue,
        rawSource: raw ? Uint8Array.from(raw) : null,
        rawSize: size,
        parseError,
        score: score.score,
        scoreReasons: score.reasons as unknown as Prisma.InputJsonValue,
        band: score.band,
        evidenceSourceId: evidence.id,
      },
    });
  });
  return "ingested";
}

/**
 * Syncs one account. Throws only when the sync cannot start (unknown or inactive account, another sync running). Failures while
 * talking to the server are recorded on the account (sanitised) and returned in `error`, not thrown.
 */
export async function syncAccount(ctx: ServiceContext, accountId: string): Promise<SyncResult> {
  const account = await getEmailAccountForSync(accountId);
  if (!account) throw new NotFoundError("Email account");
  if (account.status !== "ACTIVE") throw new InvariantError("This account is not active. Activate it to sync.");

  const now = new Date();
  const claimed = await ctx.db.emailAccount.updateMany({
    where: { id: accountId, OR: [{ syncLeaseUntil: null }, { syncLeaseUntil: { lt: now } }] },
    data: { syncLeaseUntil: new Date(now.getTime() + LEASE_MS) },
  });
  if (claimed.count === 0) throw new ConflictError("A sync is already running for this account.");

  const result: SyncResult = { ingested: 0, skipped: 0, errors: 0, remaining: false, error: null };
  let client: ImapFlow | null = null;
  try {
    let password: string;
    try {
      password = decryptSecret(account.passwordEncrypted);
    } catch {
      result.error = "The stored password could not be decrypted. Re-enter it in Settings.";
      return result;
    }

    const lists = await loadMasterLists(ctx);
    client = openClient({ host: account.host, port: account.port, security: account.security, username: account.username, password, folder: account.folder });
    await client.connect();
    const lock = await client.getMailboxLock(account.folder, { readOnly: true });
    try {
      const mailbox = client.mailbox;
      if (typeof mailbox !== "object") throw new Error("mailbox not open");
      const uidValidity = mailbox.uidValidity;

      // A different UIDVALIDITY means the server renumbered the folder: start again from the sync-from date.
      let lastUid = account.uidValidity !== null && account.uidValidity === uidValidity ? account.lastUid : null;
      if (account.uidValidity !== uidValidity) await ctx.db.emailAccount.update({ where: { id: accountId }, data: { uidValidity, lastUid: null }, select: { id: true } });

      const listed = (await client.search({ since: account.syncFromDate }, { uid: true })) || [];
      const pending = listed.filter((uid) => lastUid === null || BigInt(uid) > lastUid).sort((a, b) => a - b);
      const batch = pending.slice(0, MAX_PER_RUN);
      result.remaining = pending.length > MAX_PER_RUN;

      for (const uid of batch) {
        try {
          const outcome = await ingestMessage(ctx, client, account, uidValidity, uid, lists);
          if (outcome === "ingested") result.ingested += 1;
          else result.skipped += 1;
        } catch {
          // A failure while saving (not while reading the server): stop here so this message is retried, never skipped past.
          result.errors += 1;
          result.error = "A message could not be saved. The sync stopped; run it again.";
          break;
        }
        lastUid = BigInt(uid);
        await ctx.db.emailAccount.update({ where: { id: accountId }, data: { uidValidity, lastUid }, select: { id: true } });
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (error) {
    result.error = describeImapError(error);
  } finally {
    try {
      client?.close();
    } catch {
      // already closed
    }
    await ctx.db.emailAccount.update({
      where: { id: accountId },
      data: { syncLeaseUntil: null, lastSyncAt: new Date(), lastSyncStatus: result.error ? "ERROR" : "OK", lastSyncError: result.error },
      select: { id: true },
    });
  }

  if (result.ingested > 0) {
    await writeAudit(ctx, { action: "email_account.synced", entityType: "EmailAccount", entityId: accountId, details: { ingested: result.ingested, skipped: result.skipped, errors: result.errors } });
  }
  return result;
}

/** Syncs every ACTIVE account, one after another. One account failing never stops the others. Used by scripts/mail-sync.ts. */
export async function syncAllActiveAccounts(ctx: ServiceContext): Promise<{ accountId: string; label: string; result: SyncResult | null; error: string | null }[]> {
  const accounts = await ctx.db.emailAccount.findMany({ where: { status: "ACTIVE" }, orderBy: { label: "asc" }, select: { id: true, label: true } });
  const outcomes: { accountId: string; label: string; result: SyncResult | null; error: string | null }[] = [];
  for (const account of accounts) {
    try {
      outcomes.push({ accountId: account.id, label: account.label, result: await syncAccount(ctx, account.id), error: null });
    } catch (error) {
      outcomes.push({ accountId: account.id, label: account.label, result: null, error: error instanceof Error ? error.message : "Sync failed." });
    }
  }
  return outcomes;
}
