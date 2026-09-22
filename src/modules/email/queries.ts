import { db } from "../../core/database/client";
import type { Prisma } from "../../generated/prisma/client";
import type { EmailBand, EmailSecurity, EmailSyncStatus, EmailTriageStatus, RecordStatus } from "../../generated/prisma/enums";
import { PAGE_SIZE } from "../../lib/search-params";

/**
 * Read side for email accounts. SECURITY: `passwordEncrypted` is excluded from every query in this file except `getEmailAccountForSync`,
 * which only the sync and test-connection code paths call. Never add it to a list, a detail view or anything that reaches the browser.
 */

export type EmailAccountRow = {
  id: string;
  label: string;
  host: string;
  port: number;
  security: EmailSecurity;
  username: string;
  folder: string;
  syncFromDate: Date;
  status: RecordStatus;
  lastSyncAt: Date | null;
  lastSyncStatus: EmailSyncStatus | null;
  lastSyncError: string | null;
  messageCount: number;
};

export async function listEmailAccounts(): Promise<EmailAccountRow[]> {
  const accounts = await db.emailAccount.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { label: "asc" },
    select: {
      id: true,
      label: true,
      host: true,
      port: true,
      security: true,
      username: true,
      folder: true,
      syncFromDate: true,
      status: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncError: true,
      _count: { select: { messages: true } },
    },
  });
  return accounts.map(({ _count, ...account }) => ({ ...account, messageCount: _count.messages }));
}

/** Active accounts, for the "Sync mail" buttons. No credentials. */
export async function listActiveEmailAccountOptions() {
  return db.emailAccount.findMany({ where: { status: "ACTIVE" }, orderBy: { label: "asc" }, select: { id: true, label: true } });
}

/** INTERNAL: the only query that returns the encrypted password. Used by the sync and test-connection services, never by pages. */
export async function getEmailAccountForSync(id: string) {
  return db.emailAccount.findUnique({
    where: { id },
    select: {
      id: true,
      label: true,
      host: true,
      port: true,
      security: true,
      username: true,
      passwordEncrypted: true,
      folder: true,
      syncFromDate: true,
      status: true,
      uidValidity: true,
      lastUid: true,
    },
  });
}

// ─────────────────────────────── messages (triage) ───────────────────────────────
// SECURITY/SIZE: these queries never select `rawSource` (up to 20 MB) or, for lists, `textBody`. Only `getEmailRaw` reads the original.

export type EmailBandFilter = "likely-review" | "all" | "low";
export type EmailListParams = { band: EmailBandFilter; status: EmailTriageStatus; page: number };

export type ScoreReasonRow = { label: string; points: number };

export type EmailListRow = {
  id: string;
  receivedAt: Date;
  fromName: string | null;
  fromAddress: string | null;
  subject: string | null;
  band: EmailBand;
  score: number;
  reasons: ScoreReasonRow[];
  attachmentCount: number;
  triageStatus: EmailTriageStatus;
  dismissedReason: string | null;
  enquiryId: string | null;
};

const asReasons = (value: unknown): ScoreReasonRow[] =>
  Array.isArray(value) ? value.filter((r): r is ScoreReasonRow => typeof r === "object" && r !== null && typeof (r as ScoreReasonRow).label === "string") : [];

function bandWhere(band: EmailBandFilter): Prisma.EmailMessageWhereInput {
  if (band === "all") return {};
  if (band === "low") return { band: "LOW" };
  return { band: { in: ["LIKELY", "REVIEW"] } };
}

/** The triage queue, newest first, paginated server-side. Default view: likely and review bands, still waiting. */
export async function listEmailMessages(params: EmailListParams): Promise<{ rows: EmailListRow[]; total: number }> {
  const where: Prisma.EmailMessageWhereInput = { ...bandWhere(params.band), triageStatus: params.status };
  const [messages, total] = await Promise.all([
    db.emailMessage.findMany({
      where,
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, receivedAt: true, fromName: true, fromAddress: true, subject: true, band: true, score: true, scoreReasons: true, attachments: true, triageStatus: true, dismissedReason: true, enquiryId: true },
    }),
    db.emailMessage.count({ where }),
  ]);
  return {
    total,
    rows: messages.map((m) => ({
      id: m.id,
      receivedAt: m.receivedAt,
      fromName: m.fromName,
      fromAddress: m.fromAddress,
      subject: m.subject,
      band: m.band,
      score: m.score,
      reasons: asReasons(m.scoreReasons),
      attachmentCount: Array.isArray(m.attachments) ? m.attachments.length : 0,
      triageStatus: m.triageStatus,
      dismissedReason: m.dismissedReason,
      enquiryId: m.enquiryId,
    })),
  };
}

/** One email for the drawer: headers, clean text, score breakdown, attachment metadata. Never the original MIME. */
export async function getEmailMessage(id: string) {
  const message = await db.emailMessage.findUnique({
    where: { id },
    select: {
      id: true,
      folder: true,
      messageId: true,
      fromName: true,
      fromAddress: true,
      toAddresses: true,
      ccAddresses: true,
      subject: true,
      sentAt: true,
      receivedAt: true,
      textBody: true,
      attachments: true,
      rawSize: true,
      parseError: true,
      score: true,
      scoreReasons: true,
      band: true,
      triageStatus: true,
      dismissedAt: true,
      dismissedReason: true,
      dismissedBy: { select: { name: true } },
      enquiry: { select: { id: true, number: true } },
      account: { select: { label: true } },
      rawSource: false,
    },
  });
  return message ? { ...message, reasons: asReasons(message.scoreReasons) } : null;
}

export type EmailDetail = NonNullable<Awaited<ReturnType<typeof getEmailMessage>>>;

/** Emails still waiting for a decision that are worth a look (likely or review). Shown as a count on the inbox and Overview. */
export async function countEmailTriage(): Promise<number> {
  return db.emailMessage.count({ where: { band: { in: ["LIKELY", "REVIEW"] }, triageStatus: "NEW" } });
}

/** INTERNAL: the only place that reads the original MIME, for the `.eml` download. */
export async function getEmailRaw(id: string) {
  return db.emailMessage.findUnique({ where: { id }, select: { rawSource: true, rawSize: true, subject: true } });
}
