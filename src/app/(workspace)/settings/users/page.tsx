import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Panel } from "@/components/application/page-canvas";
import { EmptyState } from "@/components/application/states";
import { TopbarActions } from "@/components/application/topbar-slot";
import { FormDrawer } from "@/components/forms/form-drawer";
import { Button } from "@/components/ui/button";
import { requireAdmin, signInEnabled } from "@/core/permissions/actor";
import { listUsers } from "@/modules/users/queries";
import { AddUserForm } from "@/modules/users/components/user-forms";
import { UsersTable } from "@/modules/users/components/users-table";

export const metadata: Metadata = { title: "Users · Settings" };

export default async function UsersSettingsPage() {
  await connection();
  const admin = await requireAdmin();
  const [rows, signInOn] = await Promise.all([listUsers(), signInEnabled()]);

  const addUser = (
    <FormDrawer
      trigger={
        <Button size="sm">
          <Plus aria-hidden /> Add user
        </Button>
      }
      title="Add user"
      description="A colleague who can sign in. You choose their first password and tell it to them."
    >
      <AddUserForm />
    </FormDrawer>
  );

  return (
    <>
      <TopbarActions>{addUser}</TopbarActions>
      {!signInOn ? (
        <p className="mb-3 text-xs text-warning">Sign-in is not set up yet, so nobody is asked to sign in. Set it up from the banner at the top, then add colleagues here.</p>
      ) : null}
      {rows.length === 0 ? (
        <Panel>
          <EmptyState title="No users" description="Add the people who will use the application." action={addUser} />
        </Panel>
      ) : (
        <UsersTable rows={rows} currentUserId={admin.id} />
      )}
    </>
  );
}
