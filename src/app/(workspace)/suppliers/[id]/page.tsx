import { requireActor } from "@/core/permissions/actor";
import { Globe, Mail, MapPin, MessageCircle, Pencil, Phone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ContactInfoList } from "@/components/application/contact-info";
import { KeyValue } from "@/components/application/key-value";
import { PageBody, PanelSection } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { Unknown } from "@/components/application/states";
import { RecordStatusBadge } from "@/components/application/status-badges";
import { TabNav, type TabItem } from "@/components/application/tab-nav";
import { TopbarActions } from "@/components/application/topbar-slot";
import { Timeline } from "@/components/application/timeline";
import { FormDrawer } from "@/components/forms/form-drawer";
import { RecordStatusControl } from "@/components/forms/record-status-control";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SUPPLIER_TYPE_LABEL } from "@/lib/labels";
import { buildHref, firstParam } from "@/lib/search-params";
import { listActivity } from "@/modules/audit/queries";
import { EvidenceDrawer } from "@/modules/evidence/components/evidence-drawer";
import { SupplierOffersTable } from "@/modules/observations/components/offers";
import { getSupplierOffers } from "@/modules/observations/procurement-queries";
import { BroadcastsTable, NoBroadcasts } from "@/modules/broadcasts/components/broadcasts-table";
import { listBroadcasts } from "@/modules/broadcasts/queries";
import { listBrandOptions, listCategoryOptions } from "@/modules/products/master-data.queries";
import { setSupplierStatusAction } from "@/modules/suppliers/actions";
import { ContactsPanel } from "@/modules/suppliers/components/contacts-panel";
import { SupplierAssociations } from "@/modules/suppliers/components/supplier-associations";
import { SupplierForm } from "@/modules/suppliers/components/supplier-form";
import { countContacts, getSupplier, listContacts } from "@/modules/suppliers/queries";

const TABS = ["overview", "contacts", "broadcasts", "prices", "activity"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata(props: PageProps<"/suppliers/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const supplier = z.uuid().safeParse(id).success ? await getSupplier(id) : null;
  return { title: supplier?.name ?? "Supplier" };
}

/** This supplier's broadcasts (evidence history), newest first. "New broadcast" lives in the top navbar. */
async function SupplierBroadcasts({ supplierId, archived }: { supplierId: string; archived: boolean }) {
  const { rows } = await listBroadcasts({ view: "all", supplierId, page: 1 });
  const newBroadcast = (
    <Button asChild size="sm" disabled={archived}>
      <Link href={`/broadcasts/new?supplier=${supplierId}`}>
        <Plus aria-hidden /> New broadcast
      </Link>
    </Button>
  );
  return (
    <>
      <TopbarActions>{newBroadcast}</TopbarActions>
      {rows.length === 0 ? (
        <NoBroadcasts title="No broadcasts from this supplier yet" description="Paste a message they sent to start recording prices and stock." action={newBroadcast} />
      ) : (
        <BroadcastsTable rows={rows} showSupplier={false} />
      )}
    </>
  );
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

export default async function SupplierDetailPage(props: PageProps<"/suppliers/[id]">) {
  await requireActor();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const supplier = await getSupplier(id);
  if (!supplier) notFound();

  const requested = firstParam(searchParams, "tab");
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "overview";

  const brandIds = supplier.brands.map((b) => b.brand.id);
  const categoryIds = supplier.categories.map((c) => c.category.id);
  const [contactCount, brandOptions, categoryOptions] = await Promise.all([countContacts(id), listBrandOptions(brandIds), listCategoryOptions(categoryIds)]);

  const tabs: TabItem[] = [
    { key: "overview", label: "Overview" },
    { key: "contacts", label: "Contacts", count: contactCount },
    { key: "broadcasts", label: "Broadcasts" },
    { key: "prices", label: "Prices / Stock" },
    { key: "activity", label: "Activity" },
  ];

  const location = [supplier.area, supplier.emirate, supplier.country].filter(Boolean).join(", ");
  const subtitle = [supplier.type ? SUPPLIER_TYPE_LABEL[supplier.type] : null, location || null].filter(Boolean).join(" · ");
  const fullAddress = [supplier.address, location || null].filter(Boolean).join(", ") || null;
  const basePath = `/suppliers/${id}`;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: supplier.name }]}
        title={supplier.name}
        subtitle={subtitle || undefined}
        meta={<RecordStatusBadge status={supplier.status} />}
        actions={
          <>
            <RecordStatusControl id={id} status={supplier.status} action={setSupplierStatusAction} entityLabel="This supplier" triggerLabel="Status" />
            <FormDrawer
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil aria-hidden /> Edit
                </Button>
              }
              title="Edit supplier"
            >
              <SupplierForm supplier={supplier} />
            </FormDrawer>
          </>
        }
      />
      <TabNav flush tabs={tabs} active={tab} basePath={basePath} />

      <PageBody>
        {tab === "overview" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <PanelSection title="Profile">
                <ContactInfoList
                  items={[
                    { icon: Phone, label: "Phone", value: supplier.phone },
                    { icon: MessageCircle, label: "WhatsApp", value: supplier.whatsapp },
                    { icon: Mail, label: "Email", value: supplier.email },
                    // A React element that renders nothing is not "null", so pass null explicitly when there is no website.
                    { icon: Globe, label: "Website", value: supplier.website ? <WebsiteLink url={supplier.website} /> : null },
                    { icon: MapPin, label: "Address", value: fullAddress },
                  ]}
                />
                <Separator className="my-4" />
                <KeyValue
                  items={[
                    { label: "Legal name", value: supplier.legalName },
                    { label: "Supplier code", value: supplier.code, mono: true },
                    { label: "Type", value: supplier.type ? SUPPLIER_TYPE_LABEL[supplier.type] : null },
                    { label: "TRN", value: supplier.trn, mono: true },
                  ]}
                />
                <Separator className="my-4" />
                <div className="text-xs text-muted-foreground">Notes</div>
                <div className="mt-1">{supplier.notes ? <p className="text-sm whitespace-pre-wrap">{supplier.notes}</p> : <Unknown />}</div>
              </PanelSection>

              <PanelSection title="Procurement profile">
                <KeyValue
                  items={[
                    { label: "Payment terms", value: supplier.paymentTerms },
                    { label: "Credit terms", value: supplier.creditTerms },
                    { label: "Warranty notes", value: supplier.warrantyNotes },
                    { label: "Delivery notes", value: supplier.deliveryNotes },
                  ]}
                />
              </PanelSection>
            </div>

            <PanelSection title="Brands and categories" className="h-fit">
              <div>
                <SupplierAssociations supplierId={id} brandOptions={brandOptions} categoryOptions={categoryOptions} brandIds={brandIds} categoryIds={categoryIds} />
              </div>
            </PanelSection>
          </div>
        ) : null}

        {tab === "contacts" ? (
          <ContactsPanel
            supplierId={id}
            contacts={await listContacts(id, { includeArchived: true })}
            brandOptions={brandOptions}
            categoryOptions={categoryOptions}
            supplierArchived={supplier.status === "ARCHIVED"}
          />
        ) : null}

        {tab === "broadcasts" ? <SupplierBroadcasts supplierId={id} archived={supplier.status === "ARCHIVED"} /> : null}

        {tab === "prices" ? <SupplierOffersTable rows={await getSupplierOffers(id)} evidenceHref={(observationId) => buildHref(basePath, searchParams, { evidence: observationId })} /> : null}

        {tab === "activity" ? <Timeline rows={await listActivity({ type: "Supplier", id })} emptyTitle="No activity recorded yet" /> : null}

        <EvidenceDrawer observationId={firstParam(searchParams, "evidence")} closeHref={buildHref(basePath, searchParams, { evidence: undefined })} />
      </PageBody>
    </>
  );
}
