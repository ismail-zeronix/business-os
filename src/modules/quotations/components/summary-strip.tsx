import Link from "next/link";
import type { ReactNode } from "react";
import { CollapsibleSection } from "@/components/application/collapsible-section";
import { KeyValue } from "@/components/application/key-value";
import { formatDate, formatDateTime } from "@/lib/format";
import { QUOTATION_STATUS_LABEL } from "@/lib/labels";
import { enquiryReference } from "@/modules/enquiries/shared";
import type { QuotationDetail } from "../queries";

const Item = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[11px] text-muted-foreground">{label}</dt>
    <dd className="text-sm font-medium">{children}</dd>
  </div>
);

/**
 * The few facts you need at a glance (customer, enquiry, currency and VAT, validity, revisions) on one row. Terms, notes and who made it
 * are folded away below, with a one-line preview so a closed section still says what is inside.
 */
export function SummaryStrip({ quotation }: { quotation: QuotationDetail }) {
  const draft = quotation.status === "DRAFT";
  const terms = [quotation.paymentTerms && `Payment: ${quotation.paymentTerms}`, quotation.deliveryTerms && `Delivery: ${quotation.deliveryTerms}`, quotation.notes && "Notes"].filter(Boolean);

  return (
    <div className="mb-4 overflow-clip rounded-lg bg-card shadow-panel ring-1 ring-foreground/10">
      <dl className="flex flex-wrap gap-x-8 gap-y-2 px-4 py-3">
        <Item label="Customer">
          {quotation.customerName ? (
            quotation.customer ? (
              <Link href={`/customers/${quotation.customer.id}`} className="text-brand hover:underline">
                {quotation.customerName}
              </Link>
            ) : (
              quotation.customerName
            )
          ) : (
            <span className="text-warning">Not set</span>
          )}
        </Item>
        {quotation.contactName ? <Item label="Attention">{quotation.contactName}</Item> : null}
        <Item label="Enquiry">
          {quotation.enquiry ? (
            <Link href={`/enquiries/${quotation.enquiry.id}`} className="text-brand hover:underline" title={quotation.enquiry.subject ?? undefined}>
              {enquiryReference(quotation.enquiry.number)}
            </Link>
          ) : (
            <span className="text-muted-foreground">Manual</span>
          )}
        </Item>
        <Item label="Currency and VAT">
          {quotation.currencyCode} · VAT {Number(quotation.vatPercent.toString())}%
        </Item>
        <Item label="Valid until">{quotation.validUntil ? formatDate(quotation.validUntil) : <span className={draft ? "text-warning" : "text-muted-foreground"}>Not set</span>}</Item>
        {quotation.revisions.length > 1 ? (
          <Item label="Revisions">
            <span className="flex flex-wrap gap-x-2">
              {quotation.revisions.map((r) =>
                r.id === quotation.id ? (
                  <span key={r.id}>rev {r.revision}</span>
                ) : (
                  <Link key={r.id} href={`/quotations/${r.id}`} className="font-normal text-brand hover:underline" title={QUOTATION_STATUS_LABEL[r.status]}>
                    rev {r.revision}
                  </Link>
                ),
              )}
            </span>
          </Item>
        ) : null}
      </dl>

      <CollapsibleSection flat title="Terms, notes and history" summary={terms.length ? terms.join(" · ") : "None set"}>
        <KeyValue
          columns={2}
          items={[
            { label: "Payment terms", value: quotation.paymentTerms },
            { label: "Delivery terms", value: quotation.deliveryTerms },
            { label: "Notes for the customer", value: quotation.notes },
            { label: "Created by", value: `${quotation.createdBy.name} · ${formatDateTime(quotation.createdAt)}` },
          ]}
        />
      </CollapsibleSection>
    </div>
  );
}
