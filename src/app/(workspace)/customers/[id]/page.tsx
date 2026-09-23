import { requireActor } from "@/core/permissions/actor";
import { Globe, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ContactInfoList } from "@/components/application/contact-info";
import { KeyValue } from "@/components/application/key-value";
import { PageBody, Panel, PanelSection } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { Unknown } from "@/components/application/states";
import { RecordStatusBadge } from "@/components/application/status-badges";
import { TabNav, type TabItem } from "@/components/application/tab-nav";
import { TopbarActions } from "@/components/application/topbar-slot";
import { Timeline } from "@/components/application/timeline";
import { Pagination } from "@/components/data-table/pagination";
import { FormDrawer } from "@/components/forms/form-drawer";
import { RecordStatusControl } from "@/components/forms/record-status-control";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { firstParam, parsePage } from "@/lib/search-params";
import { listActivity } from "@/modules/audit/queries";
import { setCustomerStatusAction } from "@/modules/customers/actions";
import { CustomerActivityComposer } from "@/modules/customers/components/activity-composer";
import { CustomerContactsPanel } from "@/modules/customers/components/contacts-panel";
import { CustomerForm } from "@/modules/customers/components/customer-form";
import { countCustomerContacts, getCustomer, listCustomerContacts } from "@/modules/customers/queries";
import { EnquiriesTable, NoEnquiries } from "@/modules/enquiries/components/enquiries-table";
import { listEnquiries } from "@/modules/enquiries/queries";

const TABS = ["overview", "contacts", "enquiries", "activity"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata(props: PageProps<"/customers/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const customer = z.uuid().safeParse(id).success ? await getCustomer(id) : null;
  return { title: customer?.name ?? "Customer" };
}

/** Only render an http(s) URL as a link, whatever is stored (defence in depth; the schema already enforces this on input). */
function WebsiteLink({ url }: { url: string | null }) {
  if (!url || !/^https?:\/\//i.test(url)) return url ? <span>{url}</span> : null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
      {url.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
    </a>
  );
}

/** This customer's enquiries (open and closed, not archived), newest first, "New enquiry" lives in the top navbar. */
async function CustomerEnquiries({ customerId, archived, page, searchParams }: { customerId: string; archived: boolean; page: number; searchParams: Record<string, string | string[] | undefined> }) {
  const { rows, total } = await listEnquiries({ view: "all", customerId, page });
  const newEnquiry = (
    <Button asChild size="sm" disabled={archived}>
      <Link href={`/enquiries/new?customer=${customerId}`}>
        <Plus aria-hidden /> New enquiry
      </Link>
    </Button>
  );
  return (
    <>
      <TopbarActions>{newEnquiry}</TopbarActions>
      <Panel>
        {rows.length === 0 ? (
          <NoEnquiries bare title="No enquiries from this customer yet" description="Paste a request they sent to start recording what they need." action={newEnquiry} />
        ) : (
          <>
            <EnquiriesTable bare rows={rows} showCustomer={false} />
            <Pagination pathname={`/customers/${customerId}`} searchParams={searchParams} page={page} total={total} />
          </>
        )}
      </Panel>
    </>
  );
}

export default async function CustomerDetailPage(props: PageProps<"/customers/[id]">) {
  await requireActor();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const customer = await getCustomer(id);
  if (!customer) notFound();

  const requested = firstParam(searchParams, "tab");
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "overview";
  const contactCount = await countCustomerContacts(id);

  const tabs: TabItem[] = [
    { key: "overview", label: "Overview" },
    { key: "contacts", label: "Contacts", count: contactCount },
    { key: "enquiries", label: "Enquiries" },
    { key: "activity", label: "Activity" },
  ];

  const location = [customer.emirate, customer.country].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: customer.name }]}
        title={customer.name}
        subtitle={location || undefined}
        meta={<RecordStatusBadge status={customer.status} />}
        actions={
          <>
            <RecordStatusControl id={id} status={customer.status} action={setCustomerStatusAction} entityLabel="This customer" triggerLabel="Status" />
            <FormDrawer
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil aria-hidden /> Edit
                </Button>
              }
              title="Edit customer"
            >
              <CustomerForm customer={customer} />
            </FormDrawer>
          </>
        }
      />
      <TabNav flush tabs={tabs} active={tab} basePath={`/customers/${id}`} />

      <PageBody>
        {tab === "overview" ? (
          <PanelSection title="Profile">
            <ContactInfoList
              items={[
                { icon: Phone, label: "Phone", value: customer.phone },
                { icon: Mail, label: "Email", value: customer.email },
                { icon: Globe, label: "Website", value: customer.website ? <WebsiteLink url={customer.website} /> : null },
                { icon: MapPin, label: "Location", value: location || null },
              ]}
            />
            <Separator className="my-4" />
            <KeyValue items={[{ label: "Legal name", value: customer.legalName }, { label: "TRN", value: customer.trn, mono: true }]} />
            <Separator className="my-4" />
            <div className="text-xs text-muted-foreground">Notes</div>
            <div className="mt-1">{customer.notes ? <p className="text-sm whitespace-pre-wrap">{customer.notes}</p> : <Unknown />}</div>
          </PanelSection>
        ) : null}

        {tab === "contacts" ? <CustomerContactsPanel customerId={id} contacts={await listCustomerContacts(id, { includeArchived: true })} customerArchived={customer.status === "ARCHIVED"} /> : null}

        {tab === "enquiries" ? <CustomerEnquiries customerId={id} archived={customer.status === "ARCHIVED"} page={parsePage(searchParams)} searchParams={searchParams} /> : null}

        {tab === "activity" ? (
          <>
            <CustomerActivityComposer customerId={id} />
            <Timeline rows={await listActivity({ type: "Customer", id })} emptyTitle="No activity recorded yet" />
          </>
        ) : null}
      </PageBody>
    </>
  );
}
