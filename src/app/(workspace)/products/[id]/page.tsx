import { requireActor } from "@/core/permissions/actor";
import { History, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { KeyValue } from "@/components/application/key-value";
import { PageBody, Panel, PanelSection } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { RecordStatusBadge, TemporaryBadge } from "@/components/application/status-badges";
import { TabNav, type TabItem } from "@/components/application/tab-nav";
import { Timeline } from "@/components/application/timeline";
import { FormDrawer } from "@/components/forms/form-drawer";
import { RecordStatusControl } from "@/components/forms/record-status-control";
import { Button } from "@/components/ui/button";
import { buildHref, firstParam } from "@/lib/search-params";
import { listActivity } from "@/modules/audit/queries";
import { EvidenceDrawer } from "@/modules/evidence/components/evidence-drawer";
import { HistoryTable, ProductIntelligenceTable } from "@/modules/observations/components/offers";
import { getProductIntelligence, listProductHistory } from "@/modules/observations/procurement-queries";
import { setProductStatusAction } from "@/modules/products/actions";
import { AliasPanel } from "@/modules/products/components/alias-panel";
import { ProductForm } from "@/modules/products/components/product-form";
import { listBrandOptions, listCategoryOptions } from "@/modules/products/master-data.queries";
import { getProduct } from "@/modules/products/queries";

const TABS = ["overview", "activity"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata(props: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const product = z.uuid().safeParse(id).success ? await getProduct(id) : null;
  return { title: product?.name ?? "Product" };
}

export default async function ProductDetailPage(props: PageProps<"/products/[id]">) {
  await requireActor();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const product = await getProduct(id);
  if (!product) notFound();

  const requested = firstParam(searchParams, "tab");
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "overview";
  const [brandOptions, categoryOptions] = await Promise.all([listBrandOptions(product.brandId ? [product.brandId] : []), listCategoryOptions(product.categoryId ? [product.categoryId] : [])]);

  const tabs: TabItem[] = [
    { key: "overview", label: "Overview" },
    { key: "activity", label: "Activity" },
  ];
  const subtitle = [product.brand?.name, product.category?.name].filter(Boolean).join(" · ");

  const basePath = `/products/${id}`;
  const showHistory = firstParam(searchParams, "history") === "1";
  const [intelligence, historyRows] = await Promise.all([
    tab === "overview" ? getProductIntelligence(id) : Promise.resolve([]),
    tab === "overview" && showHistory ? listProductHistory(id) : Promise.resolve([]),
  ]);
  const evidenceHref = (observationId: string) => buildHref(basePath, searchParams, { evidence: observationId });

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Products", href: "/products" }, { label: product.name }]}
        title={product.name}
        subtitle={subtitle || undefined}
        meta={
          <div className="flex items-center gap-1.5">
            <RecordStatusBadge status={product.status} />
            {product.isTemporary ? <TemporaryBadge /> : null}
            {product.partNumber ? <span className="font-mono text-xs text-muted-foreground">{product.partNumber}</span> : null}
          </div>
        }
        actions={
          <>
            {tab === "overview" ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildHref(basePath, searchParams, { history: showHistory ? undefined : "1" })} scroll={false}>
                  <History aria-hidden /> {showHistory ? "Hide history" : "Show history"}
                </Link>
              </Button>
            ) : null}
            <RecordStatusControl id={id} status={product.status} action={setProductStatusAction} entityLabel="This product" triggerLabel="Status" />
            <FormDrawer
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil aria-hidden /> Edit
                </Button>
              }
              title="Edit product"
            >
              <ProductForm product={product} brandOptions={brandOptions} categoryOptions={categoryOptions} />
            </FormDrawer>
          </>
        }
      />
      <TabNav flush tabs={tabs} active={tab} basePath={basePath} />

      <PageBody>
        {tab === "overview" ? (
          <div className="space-y-4">
          <ProductIntelligenceTable rows={intelligence} evidenceHref={evidenceHref} />
          {showHistory ? (
            <Panel>
              <div className="border-b border-border/70 px-4 py-2.5 text-xs font-medium text-muted-foreground">Observation history, including retracted</div>
              <HistoryTable rows={historyRows} evidenceHref={evidenceHref} />
            </Panel>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PanelSection title="Identity" className="lg:col-span-2">
              <KeyValue
                items={[
                  { label: "Brand", value: product.brand?.name },
                  { label: "Category", value: product.category?.name },
                  { label: "Family", value: product.family },
                  { label: "Model", value: product.model },
                  { label: "Part number", value: product.partNumber, mono: true },
                  { label: "Manufacturer SKU", value: product.manufacturerSku, mono: true },
                  { label: "Description", value: product.description },
                ]}
              />
            </PanelSection>
            <PanelSection title="Aliases" className="h-fit">
              <div>
                <AliasPanel productId={id} aliases={product.aliases.map((a) => ({ id: a.id, alias: a.alias, source: a.source }))} archived={product.status === "ARCHIVED"} />
              </div>
            </PanelSection>
          </div>
          </div>
        ) : null}

        {tab === "activity" ? <Timeline rows={await listActivity({ type: "Product", id })} emptyTitle="No activity recorded yet" /> : null}

        <EvidenceDrawer observationId={firstParam(searchParams, "evidence")} closeHref={buildHref(basePath, searchParams, { evidence: undefined })} />
      </PageBody>
    </>
  );
}
