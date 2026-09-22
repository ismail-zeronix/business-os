import { requireActor } from "@/core/permissions/actor";
import { verifyRenderToken } from "@/core/security/render-token";
import { Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BrandMarkStatic } from "@/components/application/brand-mark-static";
import { COMPANY } from "@/config/company";
import { formatDate } from "@/lib/format";
import { firstParam } from "@/lib/search-params";
import { amountInWords } from "@/lib/number-words";
import { PrintToolbar } from "@/modules/quotations/components/print-toolbar";
import { centsToAmount, computeTotals, lineTotalCents } from "@/modules/quotations/pricing";
import { getQuotationForPrint } from "@/modules/quotations/queries";
import { quotationLabel } from "@/modules/quotations/shared";

const number = (amount: string) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount));

export async function generateMetadata(props: PageProps<"/quotations/[id]/print">): Promise<Metadata> {
  const { id } = await props.params;
  const quotation = z.uuid().safeParse(id).success ? await getQuotationForPrint(id) : null;
  // The title becomes the suggested file name when the page is saved as a PDF.
  return { title: quotation ? `Quotation ${quotationLabel(quotation)}` : "Quotation" };
}

/** Items on one line with a thin divider between them ("a@x.ae | b@x.ae"). */
function Separated({ items, className }: { items: string[]; className?: string }) {
  return (
    <span className={className}>
      {items.map((item, index) => (
        <Fragment key={item}>
          {index > 0 ? <span className="mx-2 text-border">|</span> : null}
          <span className="whitespace-nowrap">{item}</span>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * The customer's copy: a plain business document in the Business OS colours on white paper. Everything here comes from
 * `getQuotationForPrint`, whose select names only customer-visible columns: no supplier, cost, markup or margin is available to this page,
 * so none can be printed. A draft says so on the paper. The footer carries the Business OS branding.
 */
export default async function QuotationPrintPage(props: PageProps<"/quotations/[id]/print">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  // A person must be signed in, except for this server's own headless browser making the PDF, which carries a short-lived signed token.
  if (!verifyRenderToken(id, firstParam(searchParams, "render"))) await requireActor();
  if (!z.uuid().safeParse(id).success) notFound();

  const quotation = await getQuotationForPrint(id);
  if (!quotation) notFound();

  const currency = quotation.currencyCode;
  const totals = computeTotals(quotation.lines, quotation.vatPercent);
  const vat = Number(quotation.vatPercent.toString());
  const reference = quotationLabel(quotation);
  const date = quotation.issuedAt ?? quotation.createdAt;
  const salesperson = quotation.issuedBy?.name ?? quotation.createdBy.name;
  const terms = [
    { label: "Payment terms", value: quotation.paymentTerms },
    { label: "Delivery terms", value: quotation.deliveryTerms },
  ].filter((t): t is { label: string; value: string } => Boolean(t.value));

  return (
    <>
      <PrintToolbar backHref={`/quotations/${id}`} />
      <article
        aria-label={`Quotation ${reference}`}
        className="mx-auto flex min-h-[297mm] max-w-[210mm] flex-col bg-white p-[14mm] text-[11px] leading-relaxed text-foreground shadow-panel print:min-h-[calc(297mm-28mm)] print:max-w-none print:p-0 print:shadow-none"
      >
        {quotation.status !== "ISSUED" ? (
          <p className="mb-4 border border-foreground/30 px-3 py-1.5 text-center text-xs font-semibold tracking-wide uppercase">
            {quotation.status === "DRAFT" ? "Draft: not issued" : "Superseded by a later revision"}
          </p>
        ) : null}

        <header className="flex items-start justify-between gap-8 border-b-2 border-brand pb-4">
          <div>
            <h1>
              {/* A plain <img>: the print page needs the file itself, not an optimised variant. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={COMPANY.logo.src} width={COMPANY.logo.width} height={COMPANY.logo.height} alt={COMPANY.name} className="h-6 w-auto" />
            </h1>
            <p className="mt-2.5 text-[14px] leading-tight font-bold tracking-tight text-sidebar">{COMPANY.name}</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li className="flex items-start gap-2">
                <MapPin className="mt-[3px] size-3.5 shrink-0 text-brand" strokeWidth={1.75} aria-label="Address" />
                <address className="not-italic">
                  {COMPANY.address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-3.5 shrink-0 text-brand" strokeWidth={1.75} aria-label="Email" />
                <Separated items={COMPANY.emails} />
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-3.5 shrink-0 text-brand" strokeWidth={1.75} aria-label="Phone" />
                <Separated items={COMPANY.phones} className="tabular-nums" />
              </li>
              {COMPANY.trn ? <li className="pl-[22px]">TRN: {COMPANY.trn}</li> : null}
            </ul>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl leading-none font-semibold text-sidebar">Quotation</p>
            <dl className="mt-3 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-0.5 text-right">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="font-semibold text-sidebar">{reference}</dd>
              <dt className="text-muted-foreground">Date</dt>
              <dd>{formatDate(date)}</dd>
              {quotation.validUntil ? (
                <>
                  <dt className="text-muted-foreground">Valid until</dt>
                  <dd>{formatDate(quotation.validUntil)}</dd>
                </>
              ) : null}
            </dl>
          </div>
        </header>

        <section aria-label="Quotation for" className="mt-4">
          <p className="text-muted-foreground">Quotation for</p>
          <p className="text-sm font-semibold text-sidebar">{quotation.customerName ?? "—"}</p>
          {quotation.contactName ? <p>Attention: {quotation.contactName}</p> : null}
        </section>

        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-y border-sidebar/40 text-left text-sidebar">
              <th className="w-8 px-2 py-1.5 font-semibold">#</th>
              <th className="px-2 py-1.5 font-semibold">Description</th>
              <th className="w-14 px-2 py-1.5 text-right font-semibold">Qty</th>
              <th className="w-28 px-2 py-1.5 text-right font-semibold">Unit price ({currency})</th>
              <th className="w-28 px-2 py-1.5 text-right font-semibold">Total ({currency})</th>
            </tr>
          </thead>
          <tbody>
            {quotation.lines.map((line, index) => {
              const total = lineTotalCents(line.quantity, line.unitPrice);
              return (
                <tr key={line.position} className="break-inside-avoid border-b border-border align-top">
                  <td className="px-2 py-2 text-muted-foreground">{index + 1}</td>
                  <td className="px-2 py-2">
                    <span className="block font-medium">{line.description}</span>
                    {line.partNumber ? <span className="block text-[10px] text-muted-foreground">P/N {line.partNumber}</span> : null}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{line.quantity ?? "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{line.unitPrice ? number(line.unitPrice.toString()) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{total === null ? "—" : number(centsToAmount(total))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 flex items-start justify-between gap-8 break-inside-avoid">
          <div className="max-w-[95mm]">
            {Number(totals.total) > 0 ? (
              <>
                <p className="text-muted-foreground">Amount in words</p>
                <p className="font-semibold text-sidebar">{amountInWords(totals.total, currency)}</p>
              </>
            ) : null}
          </div>
          <dl className="w-64 shrink-0 space-y-1">
            <div className="flex justify-between gap-6 px-2">
              <dt className="text-muted-foreground">Subtotal (excl. VAT)</dt>
              <dd className="tabular-nums">{number(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-6 px-2">
              <dt className="text-muted-foreground">VAT {vat}%</dt>
              <dd className="tabular-nums">{number(totals.vat)}</dd>
            </div>
            <div className="flex justify-between gap-6 border-t border-sidebar px-2 pt-1.5 text-sm font-semibold text-sidebar">
              <dt>Total ({currency})</dt>
              <dd className="tabular-nums">{number(totals.total)}</dd>
            </div>
          </dl>
        </div>

        {terms.length || quotation.notes ? (
          <section aria-label="Terms" className="mt-6 space-y-1.5 break-inside-avoid">
            {terms.map((term) => (
              <p key={term.label}>
                <span className="font-semibold text-sidebar">{term.label}:</span> {term.value}
              </p>
            ))}
            {quotation.notes ? (
              <div>
                <p className="font-semibold text-sidebar">Notes</p>
                <p className="whitespace-pre-line">{quotation.notes}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        <section aria-label="Sales representative" className="mt-8 break-inside-avoid">
          <p className="text-muted-foreground">Sales representative</p>
          <p className="text-sm font-semibold text-sidebar">{salesperson}</p>
        </section>

        <footer className="mt-auto break-inside-avoid pt-8">
          <div className="flex items-center justify-between gap-4 border-t border-brand pt-2.5">
            <div className="flex items-center gap-2">
              <BrandMarkStatic className="size-6" />
              <span className="text-[13px] font-bold tracking-tight text-sidebar">Business OS</span>
            </div>
            <p className="text-muted-foreground">
              Created using <span className="font-semibold text-sidebar">Business OS</span> by {COMPANY.name}
            </p>
          </div>
        </footer>
      </article>
    </>
  );
}
