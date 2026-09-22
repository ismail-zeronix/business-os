import { Pencil } from "lucide-react";
import { RecordStatusBadge } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { FormDrawer } from "@/components/forms/form-drawer";
import { RecordStatusControl } from "@/components/forms/record-status-control";
import type { SelectOption } from "@/components/forms/multi-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelativeAge } from "@/lib/format";
import { EMAIL_SECURITY_LABEL } from "@/lib/labels";
import type { SmtpAccountRow } from "../smtp.queries";
import { setSmtpAccountStatusAction } from "../smtp.actions";
import { SmtpAccountForm } from "./smtp-account-form";
import { SmtpTestButton } from "./smtp-test-button";

/** Outgoing accounts. Credentials are never part of a row: only where it connects, who it sends as, and how the last test went. */
export function SmtpAccountsTable({ rows, incoming, defaultFromName, testTo, keyConfigured }: { rows: SmtpAccountRow[]; incoming: SelectOption[]; defaultFromName: string; testTo: string; keyConfigured: boolean }) {
  const now = new Date();
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Label</TableHead>
            <TableHead>Sends as</TableHead>
            <TableHead>Server</TableHead>
            <TableHead>Last test</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-56 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className={row.status === "ACTIVE" ? undefined : "text-muted-foreground"}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell>
                <span className="block truncate">
                  {row.fromName} &lt;{row.fromAddress}&gt;
                </span>
                {row.defaultBcc ? <span className="block truncate text-xs text-muted-foreground">Bcc {row.defaultBcc}</span> : null}
              </TableCell>
              <TableCell>
                <span className="block truncate">{row.username}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {row.host}:{row.port} · {EMAIL_SECURITY_LABEL[row.security]}
                </span>
              </TableCell>
              <TableCell className="max-w-56">
                {row.lastTestStatus === "OK" ? (
                  <span className="flex items-center gap-1.5">
                    <Badge variant="success">Sent</Badge>
                    <span className="num text-xs text-muted-foreground" title={row.lastTestAt ? formatDateTime(row.lastTestAt) : undefined}>
                      {row.lastTestAt ? formatRelativeAge(row.lastTestAt, now) : ""}
                    </span>
                  </span>
                ) : row.lastTestStatus === "ERROR" ? (
                  <span className="block truncate text-xs text-danger" title={row.lastTestError ?? undefined}>
                    {row.lastTestError ?? "The last test failed."}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not tested yet</span>
                )}
              </TableCell>
              <TableCell>
                <RecordStatusBadge status={row.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {row.status === "ACTIVE" ? <SmtpTestButton id={row.id} defaultTo={testTo} /> : null}
                  <FormDrawer
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Edit ${row.label}`} title="Edit">
                        <Pencil aria-hidden />
                      </Button>
                    }
                    title={`Edit ${row.label}`}
                    description="The stored password is never shown. Leave it blank to keep it."
                  >
                    <SmtpAccountForm
                      keyConfigured={keyConfigured}
                      incoming={incoming}
                      defaultFromName={defaultFromName}
                      account={{ id: row.id, label: row.label, host: row.host, port: row.port, security: row.security, username: row.username, fromName: row.fromName, fromAddress: row.fromAddress, replyTo: row.replyTo, defaultBcc: row.defaultBcc }}
                    />
                  </FormDrawer>
                  <RecordStatusControl id={row.id} status={row.status} action={setSmtpAccountStatusAction} entityLabel={row.label} triggerLabel="Status" size="xs" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}
