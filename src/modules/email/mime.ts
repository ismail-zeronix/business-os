import PostalMime, { type Address } from "postal-mime";
import { htmlToText } from "./text";

/**
 * MIME to a normalised email. Only what the application needs is kept: identifiers, addresses, subject, dates, a clean text body and
 * attachment METADATA (name, type, size; never the content). The full original message is stored separately as immutable raw MIME.
 */

export type EmailAddress = { name: string; address: string };
export type EmailAttachment = { filename: string | null; contentType: string; size: number };

export type NormalizedEmail = {
  messageId: string | null;
  inReplyTo: string | null;
  referencesHeader: string | null;
  fromName: string | null;
  /** lower-cased */
  fromAddress: string | null;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string | null;
  sentAt: Date | null;
  textBody: string;
  attachments: EmailAttachment[];
  hasListUnsubscribe: boolean;
  /** Set by mailing lists and auto-responders ("Auto-Submitted: auto-generated"). */
  autoSubmitted: boolean;
};

function flatten(addresses: Address[] | undefined): EmailAddress[] {
  const result: EmailAddress[] = [];
  for (const entry of addresses ?? []) {
    if (entry.address) result.push({ name: entry.name ?? "", address: entry.address.toLowerCase() });
    else for (const member of entry.group ?? []) if (member.address) result.push({ name: member.name ?? "", address: member.address.toLowerCase() });
  }
  return result;
}

const clean = (value: string | undefined | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** Parses a raw RFC 822 message. Throws if it cannot be read at all; the caller records that as a parse-error row, never silently skips it. */
export async function normalizeEmail(raw: Buffer): Promise<NormalizedEmail> {
  const email = await PostalMime.parse(raw, { maxNestingDepth: 20, maxHeadersSize: 512 * 1024 });
  const from = flatten(email.from ? [email.from] : undefined)[0];
  const headers = new Map(email.headers.map((h) => [h.key.toLowerCase(), h.value]));
  const autoSubmitted = (headers.get("auto-submitted") ?? "no").trim().toLowerCase() !== "no";

  const plain = email.text?.trim() ? email.text.replace(/\r\n?/g, "\n").trim() : "";
  const textBody = plain || (email.html ? htmlToText(email.html) : "");

  const date = email.date ? new Date(email.date) : null;
  return {
    messageId: clean(email.messageId),
    inReplyTo: clean(email.inReplyTo),
    referencesHeader: clean(email.references),
    fromName: clean(from?.name),
    fromAddress: from?.address ?? null,
    to: flatten(email.to),
    cc: flatten(email.cc),
    subject: clean(email.subject),
    sentAt: date && !Number.isNaN(date.getTime()) ? date : null,
    textBody,
    attachments: email.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.mimeType,
      size: typeof a.content === "string" ? Buffer.byteLength(a.content) : a.content.byteLength,
    })),
    hasListUnsubscribe: headers.has("list-unsubscribe"),
    autoSubmitted,
  };
}

const addressLine = (list: EmailAddress[]) => (list.length ? list.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(", ") : "—");

/**
 * The text stored as the email's EvidenceSource (`raw_text`): a fixed five-line header block, a blank line, then the clean body. The
 * enquiry workspace shows this text with line numbers, so it is generated once and never changes. The full MIME is in email_messages.
 */
export function renderEvidenceText(email: NormalizedEmail, receivedAt: Date): string {
  const from = email.fromAddress ? (email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress) : "—";
  return [
    `From: ${from}`,
    `To: ${addressLine(email.to)}`,
    `Cc: ${addressLine(email.cc)}`,
    `Date: ${(email.sentAt ?? receivedAt).toISOString()}`,
    `Subject: ${email.subject ?? "(no subject)"}`,
    "",
    email.textBody,
  ].join("\n");
}
