import { requireActor } from "@/core/permissions/actor";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/application/page-header";
import { TopbarActions } from "@/components/application/topbar-slot";
import { FilterPill } from "@/components/data-table/filter-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildHref, firstParam } from "@/lib/search-params";
import { listAwaitingReview } from "@/modules/broadcasts/queries";
import { SyncMailButton } from "@/modules/email/components/sync-button";
import { listActiveEmailAccountOptions, listEmailMessages } from "@/modules/email/queries";
import { EnquiriesTable, NoEnquiries } from "@/modules/enquiries/components/enquiries-table";
import { EnquiryPeekPanel } from "@/modules/enquiries/components/enquiry-peek";
import { listEnquiriesNeedingAttention } from "@/modules/enquiries/queries";
import { EvidenceDrawer } from "@/modules/evidence/components/evidence-drawer";
import { listRecentObservations } from "@/modules/observations/procurement-queries";
import { FreshnessChart, PipelineChart, ReceivedChart } from "@/modules/overview/components/charts";
import { QueueCards, queueCards } from "@/modules/overview/components/queue-cards";
import { BroadcastList, EmailList, LatestPriceList, WaitingList } from "@/modules/overview/components/side-lists";
import { SideTabs, type SideTab } from "@/modules/overview/components/side-tabs";
import { getEnquiryCharts, getPriceFreshness, getQueueCounts, listWaitingOnSuppliers } from "@/modules/overview/queries";
import { DEFAULT_RANGE, OVERVIEW_RANGES, parseRange } from "@/modules/overview/stats";

export const metadata: Metadata = { title: "Overview" };

const TABS = ["waiting", "broadcasts", "prices", "emails"] as const;
type Tab = (typeof TABS)[number];
const LIST_LIMIT = 8;

const VIEW_ALL: Record<Tab, { href: string; label: string }> = {
  waiting: { href: "/enquiries?view=all", label: "Open enquiries" },
  broadcasts: { href: "/broadcasts", label: "All broadcasts" },
  prices: { href: "/products", label: "Browse products" },
  emails: { href: "/enquiries?view=email", label: "Open the email queue" },
};

/**
 * The Overview: what needs a person now (four work queues), how the business is moving (three charts), and the lists behind the numbers.
 * A monitor, not a workspace: the work happens on the Enquiries, Broadcasts and Sourcing pages. Every figure comes from real records (see
 * modules/overview); anything the data cannot support is absent rather than invented. All controls live in the top navbar; the period,
 * the list tab and the quick-view drawer live in the URL.
 */
export default async function OverviewPage(props: PageProps<"/">) {
  await requireActor();
  const searchParams = await props.searchParams;
  const requested = firstParam(searchParams, "tab");
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "waiting";
  const range = parseRange(firstParam(searchParams, "range"));
  const now = new Date();

  const [queues, charts, freshness, attention, accounts] = await Promise.all([
    getQueueCounts(),
    getEnquiryCharts(range, now),
    getPriceFreshness(now),
    listEnquiriesNeedingAttention(LIST_LIMIT),
    listActiveEmailAccountOptions(),
  ]);

  const tabs: SideTab[] = [
    { key: "waiting", label: "Waiting on suppliers", count: queues.awaitingSupplierReply.count, href: buildHref("/", searchParams, { tab: undefined, evidence: undefined }) },
    { key: "broadcasts", label: "Broadcasts", count: queues.broadcastsToReview.count, href: buildHref("/", searchParams, { tab: "broadcasts", evidence: undefined }) },
    { key: "prices", label: "Latest prices", href: buildHref("/", searchParams, { tab: "prices" }) },
    { key: "emails", label: "Emails", count: queues.emailsToTriage.count, href: buildHref("/", searchParams, { tab: "emails", evidence: undefined }) },
  ];

  return (
    <>
      <PageHeader title="Overview" />
      <TopbarActions>
        <FilterPill
          param="range"
          mode="single"
          label="Charts"
          defaultValue={String(DEFAULT_RANGE)}
          options={OVERVIEW_RANGES.map((days) => ({ value: String(days), label: `Last ${days} days` }))}
        />
        {accounts.map((account) => (
          <SyncMailButton key={account.id} accountId={account.id} label={accounts.length > 1 ? account.label : undefined} />
        ))}
        <Button asChild size="sm" variant="outline">
          <Link href="/broadcasts/new">
            <Plus aria-hidden /> New broadcast
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/enquiries/new">
            <Plus aria-hidden /> New enquiry
          </Link>
        </Button>
      </TopbarActions>

      <div className="space-y-4 px-6 pt-2 pb-10">
        <QueueCards cards={queueCards(queues, now)} />

        <div className="grid gap-4 lg:grid-cols-3">
          <ReceivedChart data={charts.received} days={range} />
          <PipelineChart data={charts.pipeline} />
          <FreshnessChart data={freshness} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="min-w-0 gap-0 py-0 shadow-panel">
            <div className="flex items-baseline justify-between gap-3 p-5 pb-3">
              <h2 className="text-sm font-semibold">Enquiries needing attention</h2>
              <Link href="/enquiries" className="text-xs font-medium text-brand hover:underline">
                View all →
              </Link>
            </div>
            <div className="border-t">
              {attention.length === 0 ? (
                <NoEnquiries bare title="Nothing needs attention" description="Every open enquiry has been reviewed." />
              ) : (
                <EnquiriesTable rows={attention} bare peekHref={(id) => buildHref("/", searchParams, { peek: id })} />
              )}
            </div>
          </Card>

          <SideTabs tabs={tabs} active={tab} viewAll={VIEW_ALL[tab]}>
            {tab === "waiting" ? <WaitingList rows={await listWaitingOnSuppliers(LIST_LIMIT)} now={now} /> : null}
            {tab === "broadcasts" ? <BroadcastList rows={await listAwaitingReview(LIST_LIMIT)} now={now} /> : null}
            {tab === "prices" ? <LatestPriceList rows={await listRecentObservations(LIST_LIMIT)} now={now} searchParams={searchParams} /> : null}
            {tab === "emails" ? <EmailList rows={(await listEmailMessages({ band: "likely-review", status: "NEW", page: 1 })).rows.slice(0, LIST_LIMIT)} now={now} /> : null}
          </SideTabs>
        </div>
      </div>

      <EnquiryPeekPanel enquiryId={firstParam(searchParams, "peek")} closeHref={buildHref("/", searchParams, { peek: undefined })} />
      <EvidenceDrawer observationId={firstParam(searchParams, "evidence")} closeHref={buildHref("/", searchParams, { evidence: undefined })} />
    </>
  );
}
