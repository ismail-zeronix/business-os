import { requireActor } from "@/core/permissions/actor";
import { Archive, CircleAlert, FileCheck2, Hourglass, Inbox, List, Mail, Plus, Search, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { PanelTabs, type PanelTab } from "@/components/application/panel-tabs";
import { ENQUIRY_PRIORITY_TONE, ENQUIRY_STATUS_TONE } from "@/components/application/status-badges";
import { TopbarActions } from "@/components/application/topbar-slot";
import { FilterPill } from "@/components/data-table/filter-pill";
import { Pagination } from "@/components/data-table/pagination";
import { SearchInput } from "@/components/data-table/search-input";
import { Button } from "@/components/ui/button";
import { ENQUIRY_PRIORITY_LABEL, ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_ORDER, EVIDENCE_CHANNEL_LABEL, toOptions } from "@/lib/labels";
import { buildHref, firstParam, type SearchParams } from "@/lib/search-params";
import { listCustomerOptions } from "@/modules/customers/queries";
import { EmailDrawer } from "@/modules/email/components/email-drawer";
import { SyncMailButton } from "@/modules/email/components/sync-button";
import { EmailTriageTable, NoEmails } from "@/modules/email/components/triage-table";
import { parseEmailFilters } from "@/modules/email/filters";
import { countEmailTriage, listActiveEmailAccountOptions, listEmailMessages } from "@/modules/email/queries";
import { EnquiriesTable, NoEnquiries } from "@/modules/enquiries/components/enquiries-table";
import { EnquiryPeekPanel } from "@/modules/enquiries/components/enquiry-peek";
import { hasActiveEnquiryFilters, parseEnquiryFilters } from "@/modules/enquiries/filters";
import { countEnquiriesByView, listEnquiries, type EnquiryView } from "@/modules/enquiries/queries";

export const metadata: Metadata = { title: "Enquiries" };

const TABS: { key: EnquiryView; label: string; icon: PanelTab["icon"]; attention?: boolean }[] = [
  { key: "attention", label: "Needs attention", icon: CircleAlert, attention: true },
  { key: "new", label: "New", icon: Inbox },
  { key: "sourcing", label: "Sourcing", icon: Search },
  { key: "waiting", label: "Waiting supplier", icon: Hourglass },
  { key: "quote", label: "Quote ready", icon: FileCheck2 },
  { key: "all", label: "All", icon: List },
  { key: "archived", label: "Archived", icon: Archive },
];

const EMPTY: Record<EnquiryView, { title: string; description: string }> = {
  attention: { title: "Nothing needs attention", description: "Every open enquiry has been reviewed. Paste a customer request to add more." },
  new: { title: "No new enquiries", description: "New enquiries appear here until someone moves them on." },
  sourcing: { title: "Nothing is being sourced", description: "Set an enquiry to Sourcing when you start looking for suppliers." },
  waiting: { title: "Nothing is waiting on a supplier", description: "Set an enquiry to Waiting supplier when you are waiting for a reply." },
  quote: { title: "No quotes are ready", description: "Set an enquiry to Quote ready when the pricing is done." },
  all: { title: "No enquiries yet", description: "Paste a customer request to start recording what people need." },
  archived: { title: "No archived enquiries", description: "Archived enquiries appear here. Nothing is ever deleted." },
};

const FILTER_KEYS = ["q", "status", "priority", "source", "customer"] as const;

export default async function EnquiriesPage(props: PageProps<"/enquiries">) {
  await requireActor();
  const searchParams = await props.searchParams;
  const emailMode = firstParam(searchParams, "view") === "email";
  const params = parseEnquiryFilters(searchParams);

  const newEnquiry = (
    <Button asChild size="sm">
      <Link href="/enquiries/new">
        <Plus aria-hidden /> New enquiry
      </Link>
    </Button>
  );

  // Tab links carry the current search and filters (enquiry tabs only). The Email tab starts clean: its filters are different.
  const carried: SearchParams = emailMode ? {} : Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams[key]]));
  const [counts, triageCount] = await Promise.all([countEnquiriesByView(params), countEmailTriage()]);
  const tabs: PanelTab[] = [
    ...TABS.map((tab) => ({ key: tab.key, label: tab.label, icon: tab.icon, attention: tab.attention, count: counts[tab.key], href: buildHref("/enquiries", carried, { view: tab.key === "attention" ? undefined : tab.key }) })),
    { key: "email", label: "Email", icon: Mail, attention: true, count: triageCount, href: "/enquiries?view=email" },
  ];

  return (
    <>
      <PageHeader title="Enquiries" subtitle="What customers need, what we already know, and what is blocking a reply." actions={newEnquiry} />
      <Panel flush>
        <PanelTabs tabs={tabs} active={emailMode ? "email" : params.view} label="Enquiry views" />
        {emailMode ? <EmailTriage searchParams={searchParams} /> : <EnquiryList searchParams={searchParams} newEnquiry={newEnquiry} />}
      </Panel>
      {emailMode ? <EmailDrawer emailId={firstParam(searchParams, "email")} closeHref={buildHref("/enquiries", searchParams, { email: undefined })} /> : null}
      {emailMode ? null : <EnquiryPeekPanel enquiryId={firstParam(searchParams, "peek")} closeHref={buildHref("/enquiries", searchParams, { peek: undefined })} />}
    </>
  );
}

async function EnquiryList({ searchParams, newEnquiry }: { searchParams: SearchParams; newEnquiry: React.ReactNode }) {
  const params = parseEnquiryFilters(searchParams);
  const [{ rows, total }, customers] = await Promise.all([listEnquiries(params), listCustomerOptions()]);
  const filtered = hasActiveEnquiryFilters(params);
  const clearHref = buildHref("/enquiries", searchParams, { q: undefined, status: undefined, priority: undefined, source: undefined, customer: undefined, page: undefined });
  const peekHref = (id: string) => buildHref("/enquiries", searchParams, { peek: id });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <SearchInput placeholder="Search enquiries" className="w-72"  />
        <FilterPill param="status" label="Status" options={ENQUIRY_STATUS_ORDER.map((value) => ({ value, label: ENQUIRY_STATUS_LABEL[value], tone: ENQUIRY_STATUS_TONE[value] }))} />
        <FilterPill param="priority" label="Priority" options={(["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((value) => ({ value, label: ENQUIRY_PRIORITY_LABEL[value], tone: ENQUIRY_PRIORITY_TONE[value] }))} />
        <FilterPill param="source" label="Source" options={toOptions(EVIDENCE_CHANNEL_LABEL)} />
        <FilterPill param="customer" label="Customer" mode="single" options={customers} searchable />
        {filtered ? (
          <Button asChild variant="ghost" size="sm" className="rounded-lg text-muted-foreground">
            <Link href={clearHref}>
              <X aria-hidden /> Clear
            </Link>
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        filtered ? (
          <NoEnquiries bare title="No enquiries match" description="Try a different search or filter, or clear them." />
        ) : (
          <NoEnquiries bare title={EMPTY[params.view].title} description={EMPTY[params.view].description} action={params.view === "archived" ? undefined : newEnquiry} />
        )
      ) : (
        <>
          <EnquiriesTable rows={rows} bare peekHref={peekHref} />
          <Pagination pathname="/enquiries" searchParams={searchParams} page={params.page} total={total} />
        </>
      )}
    </>
  );
}

/** Emails that may be enquiries. Nothing here becomes an enquiry until a person creates it. */
async function EmailTriage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseEmailFilters(searchParams);
  const [{ rows, total }, accounts] = await Promise.all([listEmailMessages(params), listActiveEmailAccountOptions()]);
  const filtered = params.band !== "likely-review" || params.status !== "NEW";
  const hrefFor = (emailId: string) => buildHref("/enquiries", searchParams, { email: emailId });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <FilterPill
          param="band"
          label="Likelihood"
          mode="single"
          defaultValue="likely-review"
          options={[
            { value: "likely-review", label: "Likely and review" },
            { value: "all", label: "All, including low" },
            { value: "low", label: "Low only" },
          ]}
        />
        <FilterPill
          param="state"
          label="State"
          mode="single"
          defaultValue="NEW"
          options={[
            { value: "NEW", label: "Waiting for a decision" },
            { value: "ENQUIRY_CREATED", label: "Enquiry created" },
            { value: "DISMISSED", label: "Dismissed" },
          ]}
        />
        {filtered ? (
          <Button asChild variant="ghost" size="sm" className="rounded-lg text-muted-foreground">
            <Link href="/enquiries?view=email">
              <X aria-hidden /> Clear
            </Link>
          </Button>
        ) : null}
      </div>
      <TopbarActions>
        {accounts.map((account) => (
          <SyncMailButton key={account.id} accountId={account.id} label={accounts.length > 1 ? account.label : undefined} />
        ))}
      </TopbarActions>

      {rows.length === 0 ? (
        filtered ? (
          <NoEmails bare title="No emails match" description="Try a different filter, or clear them." />
        ) : accounts.length === 0 ? (
          // Only when there is nothing to show AND nothing to sync from. Stored emails stay reachable even if the mailbox is deactivated.
          <NoEmails
            bare
            title="No active email account"
            description="Connect the mailbox that receives customer enquiries. Mail is read-only and never creates an enquiry by itself."
            action={
              <Button asChild size="sm">
                <Link href="/settings/email">Go to email accounts</Link>
              </Button>
            }
          />
        ) : (
          <NoEmails bare title="No emails to triage" description="Sync mail to fetch new messages. Only emails that look like enquiries are listed here; the rest are kept under Low." />
        )
      ) : (
        <>
          <EmailTriageTable rows={rows} hrefFor={hrefFor} bare />
          <Pagination pathname="/enquiries" searchParams={searchParams} page={params.page} total={total} />
        </>
      )}
    </>
  );
}
