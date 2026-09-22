import { requireAdmin } from "@/core/permissions/actor";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Panel, PanelSection } from "@/components/application/page-canvas";
import { EmptyState } from "@/components/application/states";
import { TabNav } from "@/components/application/tab-nav";
import { TopbarActions } from "@/components/application/topbar-slot";
import { FormDrawer } from "@/components/forms/form-drawer";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/config/company";
import { isSecretKeyConfigured } from "@/core/security/secret-box";
import { firstParam } from "@/lib/search-params";
import { EmailAccountForm } from "@/modules/email/components/account-form";
import { EmailAccountsTable } from "@/modules/email/components/accounts-table";
import { SmtpAccountForm } from "@/modules/email/components/smtp-account-form";
import { SmtpAccountsTable } from "@/modules/email/components/smtp-accounts-table";
import { listEmailAccounts } from "@/modules/email/queries";
import { defaultSyncFromInput } from "@/modules/email/schemas";
import { listSmtpAccounts } from "@/modules/email/smtp.queries";
import { defaultSignature } from "@/modules/quotations/email";
import { SignatureForm } from "@/modules/users/components/signature-form";
import { getOwnSignature } from "@/modules/users/queries";

export const metadata: Metadata = { title: "Email accounts · Settings" };

export default async function EmailSettingsPage(props: PageProps<"/settings/email">) {
  const actor = await requireAdmin();
  await connection(); // live accounts and sync status: never prerender it at build time
  const searchParams = await props.searchParams;
  const tab = firstParam(searchParams, "tab") === "outgoing" ? "outgoing" : "incoming";
  const keyConfigured = isSecretKeyConfigured();

  const tabs = <TabNav tabs={[{ key: "incoming", label: "Incoming" }, { key: "outgoing", label: "Outgoing" }]} active={tab} basePath="/settings/email" />;

  if (tab === "outgoing") {
    const [rows, incomingRows, signature] = await Promise.all([listSmtpAccounts(), listEmailAccounts(), getOwnSignature(actor.id)]);
    const incoming = incomingRows.filter((row) => row.status === "ACTIVE").map((row) => ({ value: row.id, label: `${row.username} (${row.label})` }));
    const addAccount = (
      <FormDrawer
        trigger={
          <Button size="sm">
            <Plus aria-hidden /> Add account
          </Button>
        }
        title="Add outgoing account"
        description="The mailbox quotations are emailed from. Hostinger's settings are pre-filled."
      >
        <SmtpAccountForm keyConfigured={keyConfigured} incoming={incoming} defaultFromName={COMPANY.name} />
      </FormDrawer>
    );

    return (
      <>
        <TopbarActions>{addAccount}</TopbarActions>
        {tabs}
        <div className="space-y-5">
          <PanelSection title="Your signature">
            <SignatureForm signature={signature} suggestion={defaultSignature(actor.name)} />
          </PanelSection>
          {rows.length === 0 ? (
            <Panel>
              <EmptyState title="No outgoing account yet" description="Add the mailbox quotations are sent from. Only one is active at a time, and passwords are stored encrypted." action={addAccount} />
            </Panel>
          ) : (
            <SmtpAccountsTable rows={rows} incoming={incoming} defaultFromName={COMPANY.name} testTo={actor.email} keyConfigured={keyConfigured} />
          )}
        </div>
      </>
    );
  }

  const rows = await listEmailAccounts();
  const defaultSyncFrom = defaultSyncFromInput();
  const addAccount = (
    <FormDrawer
      trigger={
        <Button size="sm">
          <Plus aria-hidden /> Add account
        </Button>
      }
      title="Add email account"
      description="An IMAP mailbox that receives customer enquiries. Hostinger's settings are pre-filled."
    >
      <EmailAccountForm defaultSyncFrom={defaultSyncFrom} keyConfigured={keyConfigured} />
    </FormDrawer>
  );

  return (
    <>
      <TopbarActions>{addAccount}</TopbarActions>
      {tabs}
      {rows.length === 0 ? (
        <Panel>
          <EmptyState title="No email accounts yet" description="Add the mailbox that receives customer enquiries. Access is read-only and passwords are stored encrypted." action={addAccount} />
        </Panel>
      ) : (
        <EmailAccountsTable rows={rows} defaultSyncFrom={defaultSyncFrom} keyConfigured={keyConfigured} />
      )}
    </>
  );
}
