import { requireActor } from "@/core/permissions/actor";
import { Download, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageBody, Panel } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { EmptyState } from "@/components/application/states";
import { SoftPill } from "@/components/application/soft-pill";
import { EnquiryStatusPill, PriorityPill } from "@/components/application/status-badges";
import { TabNav } from "@/components/application/tab-nav";
import { Timeline } from "@/components/application/timeline";
import { FormDrawer } from "@/components/forms/form-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildHref, firstParam } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { listActivity } from "@/modules/audit/queries";
import { RawPane, type LineRange } from "@/modules/broadcasts/components/raw-pane";
import { ReviewKeys } from "@/modules/broadcasts/components/review-keys";
import { listCustomerContactOptions, listCustomerOptions } from "@/modules/customers/queries";
import { AddEnquiryItemForm } from "@/modules/enquiries/components/add-item-form";
import { EnquiryStatusControl } from "@/modules/enquiries/components/status-control";
import { EnquiryHeaderPanel } from "@/modules/enquiries/components/header-panel";
import { ArchiveEnquiryControl } from "@/modules/enquiries/components/item-controls";
import { EnquiryItemRow } from "@/modules/enquiries/components/item-row";
import { NotesComposer } from "@/modules/enquiries/components/notes-composer";
import { SuggestionsStrip, type Suggestion } from "@/modules/enquiries/components/suggestions-strip";
import { getItemIntelligence } from "@/modules/enquiries/intelligence";
import type { EnquiryHeaderProposal } from "@/modules/enquiries/parsing/types";
import { getEnquiry, getEnquiryItemCandidates, listEnquiriesNeedingAttention, listUserOptions } from "@/modules/enquiries/queries";
import { EvidenceDrawer } from "@/modules/evidence/components/evidence-drawer";
import { listBrandOptions, listCategoryOptions } from "@/modules/products/master-data.queries";
import { EnquiryQuotationActions } from "@/modules/quotations/components/enquiry-quotation-actions";
import { listQuotationsForEnquiry } from "@/modules/quotations/queries";
import { SourcingTab } from "@/modules/sourcing/components/sourcing-tab";
import { Alert } from "@/components/ui/alert";

const FILTERS = ["all", "pending", "confirmed", "ignored"] as const;
type Filter = (typeof FILTERS)[number];
const STATUS_OF: Record<Exclude<Filter, "all">, "PENDING" | "CONFIRMED" | "IGNORED"> = { pending: "PENDING", confirmed: "CONFIRMED", ignored: "IGNORED" };

const reference = (number: number) => `ENQ-${String(number).padStart(5, "0")}`;

export async function generateMetadata(props: PageProps<"/enquiries/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const enquiry = z.uuid().safeParse(id).success ? await getEnquiry(id) : null;
  return { title: enquiry ? `${reference(enquiry.number)} · Enquiry` : "Enquiry" };
}

export default async function EnquiryWorkspacePage(props: PageProps<"/enquiries/[id]">) {
  await requireActor();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const enquiry = await getEnquiry(id);
  if (!enquiry) notFound();

  const viewParam = firstParam(searchParams, "view");
  const view = viewParam === "activity" ? "activity" : viewParam === "sourcing" ? "sourcing" : "items";
  const requestedFilter = firstParam(searchParams, "filter");
  const filter: Filter = (FILTERS as readonly string[]).includes(requestedFilter ?? "") ? (requestedFilter as Filter) : "all";

  const items = enquiry.items;
  const counts = {
    all: items.length,
    pending: items.filter((i) => i.reviewStatus === "PENDING").length,
    confirmed: items.filter((i) => i.reviewStatus === "CONFIRMED").length,
    ignored: items.filter((i) => i.reviewStatus === "IGNORED").length,
  };
  const visible = filter === "all" ? items : items.filter((i) => i.reviewStatus === STATUS_OF[filter]);

  // Selection: ?item= if valid, otherwise the first pending item (so review starts where the work is).
  const requestedItem = firstParam(searchParams, "item");
  const selected = items.find((i) => i.id === requestedItem) ?? items.find((i) => i.reviewStatus === "PENDING") ?? null;
  const pendingIds = items.filter((i) => i.reviewStatus === "PENDING").map((i) => i.id);
  const selectedPendingIndex = selected ? pendingIds.indexOf(selected.id) : -1;
  const nextItemId = pendingIds.find((pid, index) => pid !== selected?.id && index > selectedPendingIndex) ?? pendingIds.find((pid) => pid !== selected?.id) ?? null;

  const [candidates, intelligence, brandOptions, categoryOptions, customers, contacts, owners, quotations] = await Promise.all([
    selected && selected.reviewStatus === "PENDING" ? getEnquiryItemCandidates(selected) : Promise.resolve([]),
    selected ? getItemIntelligence({ productId: selected.productId, productBrandId: selected.product?.brandId ?? null, brandText: selected.brandText }) : Promise.resolve(null),
    listBrandOptions(),
    listCategoryOptions(),
    listCustomerOptions(enquiry.customerId ?? undefined),
    listCustomerContactOptions(),
    listUserOptions(),
    listQuotationsForEnquiry(id),
  ]);

  // When nothing is left to review, point at the next enquiry that needs attention so clearing a queue flows.
  const allReviewed = counts.all > 0 && counts.pending === 0 && !enquiry.archivedAt;
  const nextToReview = allReviewed ? (await listEnquiriesNeedingAttention(4)).find((e) => e.id !== id) : undefined;

  const basePath = `/enquiries/${id}`;
  const hrefFor = (itemId: string) => buildHref(basePath, { filter: filter === "all" ? undefined : filter }, { item: itemId });
  const filterHref = (f: Filter) => buildHref(basePath, {}, { filter: f === "all" ? undefined : f });
  const keepQuery = filter === "all" ? "" : `filter=${filter}`;
  const evidenceHref = (observationId: string) => buildHref(basePath, searchParams, { evidence: observationId });

  const ranges: LineRange[] = items.map((i) => ({ start: i.sourceLineStart ?? 0, end: i.sourceLineEnd ?? 0, status: i.reviewStatus })).filter((r) => r.start > 0);
  const selectedRange = selected?.sourceLineStart && selected.sourceLineEnd ? { start: selected.sourceLineStart, end: selected.sourceLineEnd } : null;

  // Parser suggestions that have not been applied yet. Nothing is saved until a person applies one.
  const proposal = (enquiry.extractedData as { header?: EnquiryHeaderProposal } | null)?.header ?? null;
  const suggestions: Suggestion[] = [];
  if (proposal?.deliveryLocation && !enquiry.deliveryLocation) suggestions.push({ field: "deliveryLocation", label: "Delivery", value: proposal.deliveryLocation });
  if (proposal?.priority === "URGENT" && enquiry.priority === "NORMAL") suggestions.push({ field: "priority", label: "Priority", value: "Urgent" });
  const requiredByText = proposal?.requiredByText && !enquiry.requiredBy ? proposal.requiredByText : null;

  const archived = Boolean(enquiry.archivedAt);
  const who = enquiry.customer?.name ?? enquiry.requesterName ?? enquiry.requesterEmail ?? "No customer";

  const addItem = (
    <FormDrawer
      trigger={
        <Button variant="outline" size="sm" disabled={archived}>
          <Plus aria-hidden /> Add requirement
        </Button>
      }
      title="Add requirement"
      description="For a line the parser missed. It joins the review as a pending requirement."
    >
      <AddEnquiryItemForm enquiryId={id} />
    </FormDrawer>
  );

  return (
    <PageBody>
      <PageHeader
        breadcrumbs={[{ label: "Enquiries", href: "/enquiries" }, { label: reference(enquiry.number) }]}
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono text-base text-muted-foreground">{reference(enquiry.number)}</span>
            <span>{who}</span>
          </span>
        }
        subtitle={[enquiry.subject, `saved by ${enquiry.createdBy.name}`].filter(Boolean).join(" · ")}
        meta={
          <>
            <EnquiryStatusPill status={enquiry.status} />
            <PriorityPill priority={enquiry.priority} />
            {archived ? <Badge variant="muted">Archived</Badge> : null}
            {counts.pending ? <SoftPill tone="amber">{counts.pending} pending</SoftPill> : null}
          </>
        }
        actions={
          <>
            {addItem}
            <EnquiryQuotationActions enquiryId={id} quotations={quotations} confirmedCount={counts.confirmed} archived={archived} />
            <EnquiryStatusControl enquiryId={id} status={enquiry.status} />
            <ArchiveEnquiryControl enquiryId={id} archived={archived} />
          </>
        }
      />

      {suggestions.length || requiredByText ? <SuggestionsStrip enquiryId={id} suggestions={archived ? [] : suggestions} requiredByText={requiredByText} /> : null}

      <EnquiryHeaderPanel enquiry={enquiry} customers={customers} contacts={contacts} owners={owners} />

      <TabNav
        basePath={basePath}
        param="view"
        active={view}
        tabs={[
          { key: "items", label: "Requirements", count: counts.all },
          { key: "sourcing", label: "Sourcing", count: enquiry._count.supplierRequests },
          { key: "activity", label: "Activity" },
        ]}
      />

      {view === "activity" ? (
        <>
          <NotesComposer enquiryId={id} />
          <Timeline rows={await listActivity({ type: "Enquiry", id })} emptyTitle="No activity recorded yet" />
        </>
      ) : view === "sourcing" ? (
        <SourcingTab enquiry={enquiry} evidenceHref={evidenceHref} />
      ) : (
        <>
          {allReviewed ? (
            <Alert variant="success" role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs">
              <span>
                All requirements reviewed: {counts.confirmed} confirmed{counts.ignored ? `, ${counts.ignored} ignored` : ""}. Update the status when you have started sourcing.
              </span>
              {nextToReview ? (
                <Link href={`/enquiries/${nextToReview.id}`} className="font-medium underline">
                  Next to review: {reference(nextToReview.number)} ({nextToReview.counts.pending} pending)
                </Link>
              ) : (
                <Link href="/enquiries" className="font-medium underline">
                  Back to enquiries
                </Link>
              )}
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="space-y-2">
              <RawPane rawText={enquiry.evidenceSource.rawText} ranges={ranges} selected={selectedRange} title="Raw request" label="Original customer request" />
              {enquiry.email ? (
                <Button asChild variant="outline" size="xs">
                  <Link href={`/emails/${enquiry.email.id}/raw`} prefetch={false}>
                    <Download aria-hidden /> Download original (.eml)
                  </Link>
                </Button>
              ) : null}
            </div>

            <section aria-label="Requirements" className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {FILTERS.map((f) => (
                  <Link
                    key={f}
                    href={filterHref(f)}
                    className={cn(
                      "flex h-7 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs capitalize transition-colors",
                      f === filter ? "border-brand/40 bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f}
                    <span className="num">{counts[f]}</span>
                  </Link>
                ))}
                <span className="ml-auto text-[11px] text-muted-foreground">j / k next and previous requirement</span>
              </div>

              {items.length === 0 ? (
                <Panel>
                  <EmptyState title="No requirements were recognised" description="The request was saved as evidence, but no product lines were recognised. Add requirements by hand from the original text." action={addItem} />
                </Panel>
              ) : visible.length === 0 ? (
                <Panel>
                  <EmptyState title={`No ${filter} requirements`} />
                </Panel>
              ) : (
                <ul className="space-y-2">
                  {visible.map((item) => (
                    <EnquiryItemRow
                      key={item.id}
                      item={item}
                      selected={selected?.id === item.id}
                      href={hrefFor(item.id)}
                      candidates={selected?.id === item.id ? candidates : []}
                      brandOptions={brandOptions}
                      categoryOptions={categoryOptions}
                      nextItemId={nextItemId}
                      keepQuery={keepQuery}
                      intelligence={selected?.id === item.id ? intelligence : null}
                      evidenceHref={evidenceHref}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      <ReviewKeys itemIds={visible.map((i) => i.id)} currentId={selected?.id ?? null} />
      <EvidenceDrawer observationId={firstParam(searchParams, "evidence")} closeHref={buildHref(basePath, searchParams, { evidence: undefined })} />
    </PageBody>
  );
}
