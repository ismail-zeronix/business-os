import { Download, Paperclip } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { KeyValue } from "@/components/application/key-value";
import { PanelCaption } from "@/components/application/page-header";
import { EmptyState } from "@/components/application/states";
import { UrlSheet } from "@/components/application/url-sheet";
import { EmailBandPill } from "@/components/application/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { EMAIL_TRIAGE_LABEL } from "@/lib/labels";
import { getEmailMessage, type EmailDetail } from "../queries";
import { CreateEnquiryFromEmailButton, DismissEmailControl, RestoreEmailButton } from "./triage-actions";

type Address = { name?: string; address?: string };
const addresses = (value: unknown): string => (Array.isArray(value) ? (value as Address[]).map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).filter(Boolean).join(", ") : "");
const fileSize = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`);

function EmailPanel({ email }: { email: EmailDetail }) {
  const attachments = (Array.isArray(email.attachments) ? email.attachments : []) as { filename: string | null; contentType: string; size: number }[];
  // The original is stored unless it was too large or could not be downloaded (both say so in parseError).
  const hasOriginal = !email.parseError || /invalid format/.test(email.parseError);
  const from = email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress;

  return (
    <>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <EmailBandPill band={email.band} score={email.score} />
          <Badge variant={email.triageStatus === "NEW" ? "warning" : email.triageStatus === "ENQUIRY_CREATED" ? "success" : "muted"}>{EMAIL_TRIAGE_LABEL[email.triageStatus]}</Badge>
          <span className="num text-xs text-muted-foreground">Score {email.score} of 100</span>
        </div>
        <h3 className="text-sm font-semibold break-words">{email.subject ?? "(no subject)"}</h3>

        <div className="flex flex-wrap items-center gap-2">
          {email.triageStatus === "NEW" ? (
            <>
              <CreateEnquiryFromEmailButton emailId={email.id} />
              <DismissEmailControl emailId={email.id} />
            </>
          ) : null}
          {email.triageStatus === "DISMISSED" ? <RestoreEmailButton emailId={email.id} /> : null}
          {email.triageStatus === "ENQUIRY_CREATED" && email.enquiry ? (
            <Button asChild size="sm">
              <Link href={`/enquiries/${email.enquiry.id}`}>Open ENQ-{String(email.enquiry.number).padStart(5, "0")}</Link>
            </Button>
          ) : null}
          {hasOriginal ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/emails/${email.id}/raw`} prefetch={false}>
                <Download aria-hidden /> Download original (.eml)
              </Link>
            </Button>
          ) : null}
        </div>
        {email.triageStatus === "DISMISSED" ? (
          <p className="text-xs text-muted-foreground">
            Dismissed{email.dismissedBy ? ` by ${email.dismissedBy.name}` : ""}
            {email.dismissedAt ? ` on ${formatDateTime(email.dismissedAt)}` : ""}: {email.dismissedReason}
          </p>
        ) : null}
      </section>

      <section>
        <PanelCaption>Message</PanelCaption>
        <KeyValue
          columns={1}
          items={[
            { label: "From", value: from },
            { label: "To", value: addresses(email.toAddresses) || null },
            { label: "Cc", value: addresses(email.ccAddresses) || null },
            { label: "Received", value: formatDateTime(email.receivedAt) },
            { label: "Sent", value: email.sentAt ? formatDateTime(email.sentAt) : null },
            { label: "Mailbox", value: `${email.account.label} · ${email.folder}` },
            { label: "Size", value: fileSize(email.rawSize) },
          ]}
        />
      </section>

      <section>
        <PanelCaption>Why it scored this way</PanelCaption>
        {email.reasons.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rule matched, so the score is 0.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {email.reasons.map((reason, index) => (
              <li key={`${reason.label}-${index}`} className="flex items-baseline gap-2">
                <span className={`num w-9 shrink-0 text-right font-medium ${reason.points > 0 ? "text-success" : reason.points < 0 ? "text-danger" : "text-muted-foreground"}`}>
                  {reason.points > 0 ? "+" : ""}
                  {reason.points}
                </span>
                <span>{reason.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {attachments.length ? (
        <section>
          <PanelCaption>Attachments ({attachments.length})</PanelCaption>
          <ul className="space-y-1 text-xs">
            {attachments.map((a, index) => (
              <li key={`${a.filename}-${index}`} className="flex items-center gap-2">
                <Paperclip className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{a.filename ?? "(unnamed)"}</span>
                <span className="num shrink-0 text-muted-foreground">{fileSize(a.size)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted-foreground">Only the name, type and size are kept here. The original .eml contains the files.</p>
        </section>
      ) : null}

      <section>
        <PanelCaption>Text</PanelCaption>
        {/* Plain text only: an email body is untrusted, so it is never rendered as HTML. */}
        <pre className="max-h-96 overflow-auto rounded-lg border bg-surface p-3 font-mono text-xs leading-5 break-words whitespace-pre-wrap">{email.textBody || "(empty)"}</pre>
      </section>
    </>
  );
}

/** Server-rendered email drawer for `?email=<id>`. Renders nothing when there is no (valid) id. */
export async function EmailDrawer({ emailId, closeHref }: { emailId: string | undefined; closeHref: string }) {
  if (!emailId || !z.uuid().safeParse(emailId).success) return null;
  const email = await getEmailMessage(emailId);
  return (
    <UrlSheet key={emailId} closeHref={closeHref} label="Email" title="Email" description="The message as received, how it was scored, and what to do with it." width="40rem">
      {email ? <EmailPanel email={email} /> : <EmptyState title="Email not found" description="This email does not exist or the link is out of date." />}
    </UrlSheet>
  );
}
