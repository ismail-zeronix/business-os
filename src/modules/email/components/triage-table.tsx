import { Paperclip } from "lucide-react";
import Link from "next/link";
import { EmptyState, Unknown } from "@/components/application/states";
import { EmailBandPill } from "@/components/application/status-badges";
import { InitialsAvatar, SoftPill } from "@/components/application/soft-pill";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelativeAge } from "@/lib/format";
import { EMAIL_TRIAGE_LABEL } from "@/lib/labels";
import type { EmailListRow } from "../queries";

/**
 * Design v2 (pilot). The email triage queue: who sent it, what it says, how likely it is an enquiry and why. Opening a row shows the
 * message and lets a person create an enquiry or dismiss it. The sender cell is the (stretched) row link, so the whole row is clickable
 * without JavaScript. `bare` drops the outer border so the table can sit inside a <Panel>.
 */
export function EmailTriageTable({ rows, hrefFor, bare = false }: { rows: EmailListRow[]; hrefFor: (emailId: string) => string; bare?: boolean }) {
  const now = new Date();
  const table = (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-10 w-[22%] bg-transparent px-4">From</TableHead>
          <TableHead className="h-10 w-[24%] bg-transparent px-4">Subject</TableHead>
          <TableHead className="h-10 w-[140px] min-w-[140px] bg-transparent px-4">Likelihood</TableHead>
          <TableHead className="h-10 w-[22%] bg-transparent px-4">Why</TableHead>
          <TableHead className="h-10 w-10 bg-transparent px-2" aria-label="Attachments" />
          <TableHead className="h-10 w-[150px] min-w-[150px] bg-transparent px-4">State</TableHead>
          <TableHead className="h-10 w-[110px] min-w-[110px] bg-transparent px-4 text-right">Received</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const sender = row.fromName ?? row.fromAddress;
          return (
            <TableRow key={row.id} className="relative border-border/70 hover:bg-zinc-50/80">
              <TableCell className="h-[60px] px-4 py-2">
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={sender ?? "?"} />
                  <div className="min-w-0">
                    {sender ? (
                      <Link href={hrefFor(row.id)} scroll={false} className="block truncate font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset">
                        {sender}
                      </Link>
                    ) : (
                      <Link href={hrefFor(row.id)} scroll={false} className="block after:absolute after:inset-0">
                        <Unknown dash />
                      </Link>
                    )}
                    {row.fromName && row.fromAddress ? <span className="block truncate text-xs text-muted-foreground">{row.fromAddress}</span> : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className="truncate px-4 py-2">{row.subject ?? <span className="text-muted-foreground">(no subject)</span>}</TableCell>
              <TableCell className="px-4 py-2">
                <EmailBandPill band={row.band} score={row.score} />
              </TableCell>
              <TableCell className="max-w-64 px-4 py-2">
                {row.reasons.length ? (
                  <span className="block truncate text-xs text-muted-foreground" title={row.reasons.map((r) => `${r.points > 0 ? "+" : ""}${r.points} ${r.label}`).join("\n")}>
                    {row.reasons
                      .slice(0, 2)
                      .map((r) => r.label)
                      .join(" · ")}
                    {row.reasons.length > 2 ? ` +${row.reasons.length - 2}` : ""}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">No rule matched</span>
                )}
              </TableCell>
              <TableCell className="w-10 px-2 py-2 text-muted-foreground" title={row.attachmentCount ? `${row.attachmentCount} attachment(s)` : undefined}>
                {row.attachmentCount ? <Paperclip className="size-3.5" aria-label={`${row.attachmentCount} attachments`} /> : null}
              </TableCell>
              <TableCell className="px-4 py-2">
                {row.triageStatus === "NEW" ? (
                  <SoftPill tone="amber" dot>
                    Waiting
                  </SoftPill>
                ) : (
                  <SoftPill tone={row.triageStatus === "ENQUIRY_CREATED" ? "green" : "neutral"} title={row.dismissedReason ?? undefined}>
                    {EMAIL_TRIAGE_LABEL[row.triageStatus]}
                  </SoftPill>
                )}
              </TableCell>
              <TableCell className="num px-4 py-2 text-right text-xs whitespace-nowrap text-muted-foreground" title={formatDateTime(row.receivedAt)}>
                {formatRelativeAge(row.receivedAt, now)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
  return bare ? table : <TableShell className="rounded-lg">{table}</TableShell>;
}

export function NoEmails({ title, description, action, bare = false }: { title: string; description?: string; action?: React.ReactNode; bare?: boolean }) {
  const empty = <EmptyState title={title} description={description} action={action} />;
  return bare ? <div className="py-10">{empty}</div> : <TableShell>{empty}</TableShell>;
}
