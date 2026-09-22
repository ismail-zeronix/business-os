import Link from "next/link";
import { KeyValue } from "@/components/application/key-value";
import { PanelCaption } from "@/components/application/page-header";
import { RetractedBadge, StockBadge, VatBadge } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatMoney, formatRelativeAge } from "@/lib/format";
import { EVIDENCE_CHANNEL_LABEL, EVIDENCE_KIND_LABEL, STOCK_STATUS_LABEL, VAT_STATE_LABEL } from "@/lib/labels";
import { RawPane } from "@/modules/broadcasts/components/raw-pane";
import type { ObservationEvidence } from "@/modules/observations/procurement-queries";
import { Alert } from "@/components/ui/alert";

const FIELD_LABELS = {
  description: "Description",
  brandText: "Brand",
  modelText: "Model",
  partNumber: "Part number",
  specText: "Specification",
  quantity: "Quantity",
  priceAmount: "Price",
  currencyCode: "Currency",
  vatState: "VAT",
  stockStatus: "Stock status",
} as const;

type FieldKey = keyof typeof FIELD_LABELS;

const display = (key: FieldKey, value: unknown): string => {
  if (value === null || value === undefined || value === "") return "Unknown";
  if (key === "vatState") return VAT_STATE_LABEL[value as keyof typeof VAT_STATE_LABEL] ?? String(value);
  if (key === "stockStatus") return STOCK_STATUS_LABEL[value as keyof typeof STOCK_STATUS_LABEL] ?? String(value);
  return String(value);
};

/** Compares the item as ORIGINALLY parsed (write-once extracted_data) with its confirmed values. Money is compared as a number. */
function corrections(item: NonNullable<ObservationEvidence["item"]>) {
  const original = (item.extractedData as { fields?: Record<string, unknown> } | null)?.fields;
  if (!original) return null;
  const changed: { key: FieldKey; from: string; to: string }[] = [];
  for (const key of Object.keys(FIELD_LABELS) as FieldKey[]) {
    const before = original[key] ?? null;
    const now = item[key] ?? null;
    const same = key === "priceAmount" ? (before === null ? now === null : now !== null && Number(before) === Number(now.toString())) : before === now;
    if (!same) changed.push({ key, from: display(key, before), to: display(key, now === null ? null : key === "priceAmount" ? now.toString() : now) });
  }
  return changed;
}

/** Everything behind one observation. Read-only: the evidence and observations are immutable; corrections happen by reopening the item. */
export function EvidencePanel({ data }: { data: ObservationEvidence }) {
  const now = new Date();
  const changed = data.item?.origin === "PARSER" ? corrections(data.item) : null;
  const range = data.item?.sourceLineStart && data.item.sourceLineEnd ? { start: data.item.sourceLineStart, end: data.item.sourceLineEnd } : null;

  return (
    <>
      {data.retraction ? (
        <Alert variant="danger" className="text-xs">
          <div className="flex items-center gap-2 font-medium">
            <RetractedBadge /> Retracted {formatDateTime(data.retraction.at)}
            {data.retraction.byName ? ` by ${data.retraction.byName}` : ""}
          </div>
          {data.retraction.reason ? <p className="mt-1">Reason: {data.retraction.reason}</p> : null}
          <p className="mt-1 text-danger/80">Kept for history and excluded from the latest values.</p>
        </Alert>
      ) : null}

      <section>
        <PanelCaption>Observation</PanelCaption>
        <KeyValue
          items={[
            { label: "Product", value: <Link href={`/products/${data.product.id}`} className="text-brand hover:underline">{data.product.name}</Link> },
            { label: "Supplier", value: <Link href={`/suppliers/${data.supplier.id}`} className="text-brand hover:underline">{data.supplier.name}</Link> },
            {
              label: data.kind === "price" ? "Price" : "Stock",
              value: data.price ? (
                <span className="flex items-center gap-2">
                  <span className="num font-medium">{formatMoney(data.price.amount, data.price.currencyCode)}</span>
                  <VatBadge state={data.price.vatState} />
                </span>
              ) : data.stock ? (
                <StockBadge status={data.stock.status} quantity={data.stock.quantity} />
              ) : null,
            },
            { label: "Stated by supplier", value: <span className="num">{formatDateTime(data.observedAt)} · {formatRelativeAge(data.observedAt, now)}</span> },
            { label: "Contact", value: data.contactName },
            { label: "Evidence", value: EVIDENCE_KIND_LABEL[data.evidence.kind] },
            { label: "Channel", value: EVIDENCE_CHANNEL_LABEL[data.evidence.channel] },
            { label: "Recorded in Zeronix", value: <span className="num">{formatDateTime(data.recordedAt)}</span> },
            { label: "Part number", value: data.product.partNumber, mono: true },
          ]}
        />
      </section>

      {data.item ? (
        <section>
          <PanelCaption>Extraction and corrections</PanelCaption>
          {data.item.origin === "MANUAL" ? (
            <p className="text-xs text-muted-foreground">This item was added by hand, so there is no automatic extraction to compare with.</p>
          ) : changed === null ? (
            <p className="text-xs text-muted-foreground">The original extraction was not recorded for this item.</p>
          ) : changed.length === 0 ? (
            <p className="text-xs text-muted-foreground">No corrections: the confirmed values are exactly what was extracted from the message.</p>
          ) : (
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Field</TableHead>
                    <TableHead>Originally extracted</TableHead>
                    <TableHead>Confirmed value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changed.map((c) => (
                    <TableRow key={c.key}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {FIELD_LABELS[c.key]} <Badge variant="warning" className="ml-1">Corrected</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground line-through">{c.from}</TableCell>
                      <TableCell className="num text-xs font-medium">{c.to}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          )}
        </section>
      ) : null}

      <section>
        <PanelCaption
          actions={
            data.broadcastId ? (
              <Link href={`/broadcasts/${data.broadcastId}${data.item ? `?item=${data.item.id}` : ""}`} className="text-xs text-brand hover:underline">
                Open the whole broadcast
              </Link>
            ) : undefined
          }
        >
          Original message
        </PanelCaption>
        <RawPane rawText={data.evidence.rawText} ranges={range ? [{ ...range, status: data.item?.reviewStatus ?? "CONFIRMED" }] : []} selected={range} embedded />
      </section>
    </>
  );
}
