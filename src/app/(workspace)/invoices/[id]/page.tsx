import { getCurrentActor, requireActor } from "@/core/permissions/actor";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { KeyValue } from "@/components/application/key-value";
import { PageBody, Panel, PanelSection } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { Unknown } from "@/components/application/states";
import { InvoiceStatusPill } from "@/components/application/status-badges";
import { Timeline } from "@/components/application/timeline";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { listActivity } from "@/modules/audit/queries";
import { CancelInvoiceControl, IssueInvoiceButton, MarkInvoicePaidButton } from "@/modules/invoices/components/invoice-actions";
import { getInvoice } from "@/modules/invoices/queries";
import { invoiceReference } from "@/modules/invoices/shared";
import { computeTotals, lineTotalCents, centsToAmount } from "@/modules/quotations/pricing";
import { quotationLabel } from "@/modules/quotations/shared";

export async function generateMetadata(props: PageProps<"/invoices/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const actor = await getCurrentActor();
  const invoice = z.uuid().safeParse(id).success ? await getInvoice(id, actor) : null;
  return { title: invoice ? `${invoiceReference(invoice)} · Invoice` : "Invoice" };
}

export default async function InvoicePage(props: PageProps<"/invoices/[id]">) {
  const actor = await requireActor();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const invoice = await getInvoice(id, actor);
  if (!invoice) notFound();

  const totals = computeTotals(invoice.lines, invoice.vatPercent);
  const reference = invoiceReference(invoice);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: reference }]}
        title={reference}
        subtitle={invoice.customerName ?? undefined}
        meta={<InvoiceStatusPill status={invoice.status} />}
        actions={
          <>
            {invoice.status === "DRAFT" ? <IssueInvoiceButton id={invoice.id} /> : null}
            {invoice.status === "ISSUED" ? <MarkInvoicePaidButton id={invoice.id} /> : null}
            {invoice.status === "DRAFT" || invoice.status === "ISSUED" ? <CancelInvoiceControl id={invoice.id} /> : null}
          </>
        }
      />

      <PageBody>
        <PanelSection title="From quotation">
          <Link href={`/quotations/${invoice.quotation.id}`} className="text-sm text-brand hover:underline">
            {quotationLabel(invoice.quotation)}
          </Link>
        </PanelSection>

        <PanelSection title="Details">
          <KeyValue
            items={[
              { label: "Customer", value: invoice.customer ? <Link href={`/customers/${invoice.customer.id}`} className="hover:underline">{invoice.customer.name}</Link> : invoice.customerName },
              { label: "Contact", value: invoice.contactName },
              { label: "Currency", value: invoice.currencyCode },
              { label: "Due date", value: invoice.dueDate ? formatDate(invoice.dueDate) : null },
              { label: "Created by", value: invoice.createdBy.name },
              { label: "Issued by", value: invoice.issuedBy?.name ?? null },
              { label: "Issued", value: invoice.issuedAt ? formatDateTime(invoice.issuedAt) : null },
              { label: "Paid", value: invoice.paidAt ? formatDateTime(invoice.paidAt) : null },
              { label: "Cancelled", value: invoice.cancelledAt ? `${formatDateTime(invoice.cancelledAt)} - ${invoice.cancelledReason}` : null },
            ]}
          />
        </PanelSection>

        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Part number</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.map((line) => {
                const lineCents = lineTotalCents(line.quantity, line.unitPrice);
                return (
                  <TableRow key={line.id}>
                    <TableCell>{line.description}</TableCell>
                    <TableCell className="text-muted-foreground">{line.partNumber ?? <Unknown dash />}</TableCell>
                    <TableCell className="num text-right">{line.quantity ?? <Unknown dash />}</TableCell>
                    <TableCell className="num text-right">{line.unitPrice ? formatMoney(line.unitPrice.toString(), invoice.currencyCode) : <Unknown dash />}</TableCell>
                    <TableCell className="num text-right">{lineCents !== null ? formatMoney(centsToAmount(lineCents), invoice.currencyCode) : <Unknown dash />}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>

        <Panel className="max-w-sm p-4">
          <dl className="space-y-1.5 text-sm">
            <div className="flex items-baseline justify-between gap-6">
              <dt className="text-muted-foreground">Subtotal (excl. VAT)</dt>
              <dd className="num">{formatMoney(totals.subtotal, invoice.currencyCode)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-6">
              <dt className="text-muted-foreground">VAT {invoice.vatPercent.toString()}%</dt>
              <dd className="num">{formatMoney(totals.vat, invoice.currencyCode)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-6 border-t pt-1.5 text-sm font-semibold">
              <dt>Total</dt>
              <dd className="num">{formatMoney(totals.total, invoice.currencyCode)}</dd>
            </div>
          </dl>
        </Panel>

        <Timeline rows={await listActivity({ type: "Invoice", id })} emptyTitle="No activity recorded yet" />
      </PageBody>
    </>
  );
}
