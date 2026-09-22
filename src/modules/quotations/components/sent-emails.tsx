import { Paperclip } from "lucide-react";
import { CollapsibleSection } from "@/components/application/collapsible-section";
import { SoftPill } from "@/components/application/soft-pill";
import { formatDateTime } from "@/lib/format";
import type { SentEmailRow } from "../queries";

const addresses = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);
const kb = (bytes: number | null) => (bytes ? `${Math.max(1, Math.round(bytes / 1024))} KB` : "");

/** Every email sent for this quotation, and every attempt that failed, newest first. The attachment is the exact PDF that went out. */
export function SentEmailsSection({ rows }: { rows: SentEmailRow[] }) {
  return (
    <CollapsibleSection title="Emails sent" count={rows.length} summary={rows.length ? `Last: ${formatDateTime(rows[0]!.createdAt)} to ${addresses(rows[0]!.toAddresses).join(", ")}` : "Not emailed yet"}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not emailed yet.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0">
              <SoftPill tone={row.status === "SENT" ? "green" : "red"} dot>
                {row.status === "SENT" ? "Sent" : "Failed"}
              </SoftPill>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{row.subject}</p>
                <p className="truncate text-xs text-muted-foreground">
                  To {addresses(row.toAddresses).join(", ")}
                  {addresses(row.ccAddresses).length ? ` · Cc ${addresses(row.ccAddresses).join(", ")}` : ""} · {formatDateTime(row.createdAt)} · by {row.sentBy.name}
                </p>
                {row.error ? <p className="text-xs text-danger">{row.error}</p> : null}
              </div>
              {row.attachmentName ? (
                <a href={`/sent-emails/${row.id}/attachment`} download className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                  <Paperclip className="size-3.5" aria-hidden /> {row.attachmentName} {kb(row.attachmentSize)}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </CollapsibleSection>
  );
}
