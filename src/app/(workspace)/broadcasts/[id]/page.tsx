import { requireActor } from "@/core/permissions/actor";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageBody, Panel } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { SoftPill } from "@/components/application/soft-pill";
import { EmptyState } from "@/components/application/states";
import { Timeline } from "@/components/application/timeline";
import { TabNav } from "@/components/application/tab-nav";
import { FormDrawer } from "@/components/forms/form-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { EVIDENCE_CHANNEL_LABEL } from "@/lib/labels";
import { buildHref, firstParam } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { listActivity } from "@/modules/audit/queries";
import { AddItemForm } from "@/modules/broadcasts/components/add-item-form";
import { ArchiveBroadcastControl, ConfirmReadyControl } from "@/modules/broadcasts/components/item-controls";
import { ItemRow } from "@/modules/broadcasts/components/item-row";
import { RawPane, type LineRange } from "@/modules/broadcasts/components/raw-pane";
import { ReviewKeys } from "@/modules/broadcasts/components/review-keys";
import { getBroadcast, getCandidateSpecs, getItemCandidates, listAwaitingReview } from "@/modules/broadcasts/queries";
import { enquiryReference } from "@/modules/enquiries/shared";
import { listBrandOptions, listCategoryOptions } from "@/modules/products/master-data.queries";
import { Alert } from "@/components/ui/alert";

const FILTERS = ["all", "pending", "confirmed", "ignored"] as const;
type Filter = (typeof FILTERS)[number];
const STATUS_OF: Record<Exclude<Filter, "all">, "PENDING" | "CONFIRMED" | "IGNORED"> = { pending: "PENDING", confirmed: "CONFIRMED", ignored: "IGNORED" };

export async function generateMetadata(props: PageProps<"/broadcasts/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const broadcast = z.uuid().safeParse(id).success ? await getBroadcast(id) : null;
  return { title: broadcast ? `Broadcast · ${broadcast.supplier.name}` : "Broadcast" };
}

export default async function BroadcastReviewPage(props: PageProps<"/broadcasts/[id]">) {
  await requireActor();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const broadcast = await getBroadcast(id);
  if (!broadcast) notFound();

  const view = firstParam(searchParams, "view") === "activity" ? "activity" : "review";
  const requestedFilter = firstParam(searchParams, "filter");
  const filter: Filter = (FILTERS as readonly string[]).includes(requestedFilter ?? "") ? (requestedFilter as Filter) : "all";

  const items = broadcast.items;
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

  const [candidates, brandOptions, categoryOptions] = await Promise.all([
    selected && selected.reviewStatus === "PENDING" ? getItemCandidates(selected) : Promise.resolve([]),
    listBrandOptions(),
    listCategoryOptions(),
  ]);
  // Each ambiguous candidate's own spec text, so the picker can show *why* two same-named candidates differ (only ever
  // runs for the one expanded item's handful of candidates, not the whole broadcast).
  const candidateSpecs = await getCandidateSpecs(candidates.map((c) => c.productId));

  // When nothing is left to review, point at the next broadcast that needs attention so clearing a queue flows.
  const allReviewed = counts.all > 0 && counts.pending === 0 && !broadcast.archivedAt;
  const nextToReview = allReviewed ? (await listAwaitingReview(3)).find((b) => b.id !== id) : undefined;

  const basePath = `/broadcasts/${id}`;
  const hrefFor = (itemId: string) => buildHref(basePath, { filter: filter === "all" ? undefined : filter }, { item: itemId });
  const filterHref = (f: Filter) => buildHref(basePath, {}, { filter: f === "all" ? undefined : f });
  const keepQuery = filter === "all" ? "" : `filter=${filter}`;
  const readyCount = broadcast.readyItemIds.length;

  const ranges: LineRange[] = items.map((i) => ({ start: i.sourceLineStart ?? 0, end: i.sourceLineEnd ?? 0, status: i.reviewStatus })).filter((r) => r.start > 0);
  const selectedRange = selected?.sourceLineStart && selected.sourceLineEnd ? { start: selected.sourceLineStart, end: selected.sourceLineEnd } : null;

  const addItem = (
    <FormDrawer
      trigger={
        <Button variant="outline" size="sm" disabled={Boolean(broadcast.archivedAt)}>
          <Plus aria-hidden /> Add item
        </Button>
      }
      title="Add item"
      description="For a line the parser missed. It joins the review as a pending item."
    >
      <AddItemForm broadcastId={id} />
    </FormDrawer>
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Broadcasts", href: "/broadcasts" }, { label: broadcast.supplier.name }]}
        title={
          <span className="flex items-center gap-2">
            <Link href={`/suppliers/${broadcast.supplier.id}`} className="hover:underline">
              {broadcast.supplier.name}
            </Link>
            {broadcast.archivedAt ? <Badge variant="muted">Archived</Badge> : null}
          </span>
        }
        subtitle={[
          broadcast.contact?.name,
          EVIDENCE_CHANNEL_LABEL[broadcast.evidenceSource.channel],
          `received ${formatDateTime(broadcast.evidenceSource.observedAt)}`,
          `saved by ${broadcast.createdBy.name}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        meta={
          <>
            {broadcast.archivedAt ? <Badge variant="muted">Archived</Badge> : null}
            {broadcast.supplierRequest ? (
              <Link href={`/enquiries/${broadcast.supplierRequest.enquiry.id}?view=sourcing`}>
                <SoftPill tone="violet">Reply to {enquiryReference(broadcast.supplierRequest.enquiry.number)}</SoftPill>
              </Link>
            ) : null}
            {counts.pending ? <SoftPill tone="amber">{counts.pending} pending</SoftPill> : null}
          </>
        }
        actions={
          <>
            {addItem}
            <ArchiveBroadcastControl broadcastId={id} archived={Boolean(broadcast.archivedAt)} />
          </>
        }
      />

      <TabNav
        flush
        basePath={basePath}
        param="view"
        active={view}
        tabs={[
          { key: "review", label: "Review" },
          { key: "activity", label: "Activity" },
        ]}
      />
      <PageBody>
        {view === "activity" ? (
          <Timeline rows={await listActivity({ type: "Broadcast", id })} emptyTitle="No activity recorded yet" />
        ) : (
          <>
          {allReviewed ? (
            <Alert variant="success" role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs">
              <span>
                All items reviewed: {counts.confirmed} confirmed{counts.ignored ? `, ${counts.ignored} ignored` : ""}. Confirmed prices and stock are now searchable.
              </span>
              {nextToReview ? (
                <Link href={`/broadcasts/${nextToReview.id}`} className="font-medium underline">
                  Next to review: {nextToReview.supplierName} ({nextToReview.counts.pending} pending)
                </Link>
              ) : (
                <Link href="/broadcasts" className="font-medium underline">
                  Back to broadcasts
                </Link>
              )}
            </Alert>
          ) : null}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <RawPane rawText={broadcast.evidenceSource.rawText} ranges={ranges} selected={selectedRange} />

            <section aria-label="Extracted items" className="space-y-3">
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
                <div className="ml-auto flex items-center gap-3">
                  <ConfirmReadyControl broadcastId={id} readyCount={readyCount} keepQuery={keepQuery} />
                  <span className="text-[11px] text-muted-foreground">j / k next and previous item</span>
                </div>
              </div>

              {items.length === 0 ? (
                <Panel>
                  <EmptyState title="No items were extracted" description="The message was saved as evidence, but no product lines were recognised. Add items by hand from the raw text." action={addItem} />
                </Panel>
              ) : visible.length === 0 ? (
                <Panel>
                  <EmptyState title={`No ${filter} items`} />
                </Panel>
              ) : (
                <ul className="space-y-2">
                  {visible.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      selected={selected?.id === item.id}
                      href={hrefFor(item.id)}
                      candidates={selected?.id === item.id ? candidates : []}
                      candidateSpecs={selected?.id === item.id ? candidateSpecs : {}}
                      brandOptions={brandOptions}
                      categoryOptions={categoryOptions}
                      nextItemId={nextItemId}
                      keepQuery={keepQuery}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
          </>
        )}

        <ReviewKeys itemIds={visible.map((i) => i.id)} currentId={selected?.id ?? null} />
      </PageBody>
    </>
  );
}
