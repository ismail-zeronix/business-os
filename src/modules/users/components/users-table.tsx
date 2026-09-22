import { RecordStatusBadge } from "@/components/application/status-badges";
import { SoftPill } from "@/components/application/soft-pill";
import { TableShell } from "@/components/data-table/table-shell";
import { FormDrawer } from "@/components/forms/form-drawer";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelativeAge } from "@/lib/format";
import { USER_ROLE_LABEL } from "@/lib/labels";
import type { UserRow } from "../queries";
import { EditUserForm, ResetPasswordForm, UserStatusButton } from "./user-forms";

/** Everyone who can (or could) sign in. Never shows a password or hash, only whether one is set. */
export function UsersTable({ rows, currentUserId }: { rows: UserRow[]; currentUserId: string }) {
  const now = new Date();
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[28%]">Person</TableHead>
            <TableHead className="w-[10%]">Role</TableHead>
            <TableHead className="w-[12%]">Status</TableHead>
            <TableHead className="w-[20%]">Last sign-in</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((user) => {
            const isSelf = user.id === currentUserId;
            const locked = user.lockedUntil !== null && user.lockedUntil > now;
            return (
              <TableRow key={user.id} className="align-top">
                <TableCell className="h-auto py-2">
                  <span className="flex items-center gap-2 font-medium">
                    {user.name}
                    {isSelf ? <SoftPill tone="sky">You</SoftPill> : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </TableCell>
                <TableCell className="h-auto py-2">
                  <SoftPill tone={user.role === "ADMIN" ? "violet" : "neutral"}>{USER_ROLE_LABEL[user.role]}</SoftPill>
                </TableCell>
                <TableCell className="h-auto py-2">
                  <RecordStatusBadge status={user.status} />
                </TableCell>
                <TableCell className="h-auto py-2 text-xs">
                  {!user.hasPassword ? (
                    <span className="text-warning">No password set: cannot sign in</span>
                  ) : user.lastLoginAt ? (
                    <span className="num" title={formatDateTime(user.lastLoginAt)}>
                      {formatRelativeAge(user.lastLoginAt, now)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                  {locked ? <span className="block text-warning">Locked until {formatDateTime(user.lockedUntil as Date)}</span> : null}
                </TableCell>
                <TableCell className="h-auto py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <FormDrawer trigger={<Button variant="ghost" size="xs">Edit</Button>} title={`Edit ${user.name}`}>
                      <EditUserForm user={{ id: user.id, name: user.name, email: user.email, role: user.role }} isSelf={isSelf} />
                    </FormDrawer>
                    <FormDrawer trigger={<Button variant="ghost" size="xs">Reset password</Button>} title={`Reset password for ${user.name}`}>
                      <ResetPasswordForm userId={user.id} userName={user.name} />
                    </FormDrawer>
                    {isSelf ? null : <UserStatusButton userId={user.id} active={user.status === "ACTIVE"} />}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableShell>
  );
}
