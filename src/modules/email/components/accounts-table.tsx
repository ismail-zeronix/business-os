import { Pencil } from "lucide-react";
import { RecordStatusBadge } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { FormDrawer } from "@/components/forms/form-drawer";
import { RecordStatusControl } from "@/components/forms/record-status-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelativeAge } from "@/lib/format";
import { EMAIL_SECURITY_LABEL } from "@/lib/labels";
import { setEmailAccountStatusAction } from "../actions";
import type { EmailAccountRow } from "../queries";
import { EmailAccountForm } from "./account-form";
import { SyncMailButton } from "./sync-button";

/** Connected mailboxes. Credentials are never part of a row: only where it connects, when it last synced and how that went. */
export function EmailAccountsTable({ rows, defaultSyncFrom, keyConfigured }: { rows: EmailAccountRow[]; defaultSyncFrom: string; keyConfigured: boolean }) {
  const now = new Date();
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Label</TableHead>
            <TableHead>Mailbox</TableHead>
            <TableHead>Folder</TableHead>
            <TableHead>Last sync</TableHead>
            <TableHead>Last result</TableHead>
            <TableHead className="text-right">Messages</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-28 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className={row.status === "ACTIVE" ? undefined : "text-muted-foreground"}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell>
                <span className="block truncate">{row.username}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {row.host}:{row.port} · {EMAIL_SECURITY_LABEL[row.security]}
                </span>
              </TableCell>
              <TableCell>{row.folder}</TableCell>
              <TableCell>
                <span className="num block text-xs" title={row.lastSyncAt ? formatDateTime(row.lastSyncAt) : undefined}>
                  {row.lastSyncAt ? formatRelativeAge(row.lastSyncAt, now) : <span className="text-muted-foreground">Never</span>}
                </span>
                {row.status === "ACTIVE" ? (
                  <div className="mt-1">
                    <SyncMailButton accountId={row.id} size="xs" />
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="max-w-64">
                {row.lastSyncStatus === "OK" ? (
                  <Badge variant="success">OK</Badge>
                ) : row.lastSyncStatus === "ERROR" ? (
                  <span className="block truncate text-xs text-danger" title={row.lastSyncError ?? undefined}>
                    {row.lastSyncError ?? "The last sync failed."}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not synced yet</span>
                )}
              </TableCell>
              <TableCell className="num text-right">{row.messageCount.toLocaleString("en-US")}</TableCell>
              <TableCell>
                <RecordStatusBadge status={row.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <FormDrawer
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Edit ${row.label}`} title="Edit">
                        <Pencil aria-hidden />
                      </Button>
                    }
                    title={`Edit ${row.label}`}
                    description="The stored password is never shown. Leave it blank to keep it."
                  >
                    <EmailAccountForm
                      keyConfigured={keyConfigured}
                      defaultSyncFrom={defaultSyncFrom}
                      account={{
                        id: row.id,
                        label: row.label,
                        host: row.host,
                        port: row.port,
                        security: row.security,
                        username: row.username,
                        folder: row.folder,
                        syncFromDate: row.syncFromDate.toISOString().slice(0, 10),
                      }}
                    />
                  </FormDrawer>
                  <RecordStatusControl id={row.id} status={row.status} action={setEmailAccountStatusAction} entityLabel={row.label} triggerLabel="Status" size="xs" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}
