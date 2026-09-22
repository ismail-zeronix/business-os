import { requireActor } from "@/core/permissions/actor";
import { Archive, CircleAlert, List, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/application/page-header";
import { PanelTabs, type PanelTab } from "@/components/application/panel-tabs";
import { Panel } from "@/components/application/page-canvas";
import { Pagination } from "@/components/data-table/pagination";
import { Button } from "@/components/ui/button";
import { buildHref, firstParam, parsePage } from "@/lib/search-params";
import { BroadcastsTable, NoBroadcasts } from "@/modules/broadcasts/components/broadcasts-table";
import { countBroadcastsByView, listBroadcasts, type BroadcastView } from "@/modules/broadcasts/queries";

export const metadata: Metadata = { title: "Broadcasts" };

const VIEWS: readonly BroadcastView[] = ["review", "all", "archived"];

export default async function BroadcastsPage(props: PageProps<"/broadcasts">) {
  await requireActor();
  const searchParams = await props.searchParams;
  const requested = firstParam(searchParams, "view");
  const view: BroadcastView = (VIEWS as readonly string[]).includes(requested ?? "") ? (requested as BroadcastView) : "review";
  const supplier = firstParam(searchParams, "supplier");
  const supplierId = supplier && z.uuid().safeParse(supplier).success ? supplier : undefined;
  const page = parsePage(searchParams);

  const [{ rows, total }, counts] = await Promise.all([listBroadcasts({ view, supplierId, page }), countBroadcastsByView(supplierId)]);

  const newBroadcast = (
    <Button asChild size="sm">
      <Link href="/broadcasts/new">
        <Plus aria-hidden /> New broadcast
      </Link>
    </Button>
  );

  const withSupplier = supplierId ? { supplier: supplierId } : {};
  const tabs: PanelTab[] = [
    { key: "review", label: "Needs review", icon: CircleAlert, attention: true, count: counts.review, href: buildHref("/broadcasts", withSupplier, {}) },
    { key: "all", label: "All", icon: List, count: counts.all, href: buildHref("/broadcasts", withSupplier, { view: "all" }) },
    { key: "archived", label: "Archived", icon: Archive, count: counts.archived, href: buildHref("/broadcasts", withSupplier, { view: "archived" }) },
  ];

  return (
    <>
      <PageHeader title="Broadcasts" subtitle="Supplier messages: the original is preserved, items are reviewed, confirmed items become price and stock observations." actions={newBroadcast} />
      <Panel flush>
        <PanelTabs tabs={tabs} active={view} label="Broadcast views" />

      {rows.length === 0 ? (
        view === "review" ? (
          <NoBroadcasts title="Nothing to review" description="Every broadcast has been reviewed. Paste a new supplier message to add more." action={newBroadcast} />
        ) : view === "archived" ? (
          <NoBroadcasts title="No archived broadcasts" description="Archived broadcasts appear here. Nothing is ever deleted." />
        ) : (
          <NoBroadcasts action={newBroadcast} />
        )
      ) : (
        <>
          <BroadcastsTable rows={rows} />
          <Pagination pathname="/broadcasts" searchParams={searchParams} page={page} total={total} />
        </>
      )}
      </Panel>
    </>
  );
}
