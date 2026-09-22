import { requireActor } from "@/core/permissions/actor";
import { Download, Mail, Pencil, Plus, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CollapsibleSection } from "@/components/application/collapsible-section";
import { PageBody, Panel } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { EmptyState } from "@/components/application/states";
import { QuotationStatusPill } from "@/components/application/status-badges";
import { Timeline } from "@/components/application/timeline";
import { FormDrawer } from "@/components/forms/form-drawer";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, toZonedInputValue } from "@/lib/format";
import { buildHref, firstParam } from "@/lib/search-params";
import { getActiveSmtpAccount } from "@/modules/email/smtp.queries";
import { getOwnSignature } from "@/modules/users/queries";
import { listActivity } from "@/modules/audit/queries";
import { listBrandOptions } from "@/modules/products/master-data.queries";
import { listContactOptions, listSupplierOptions } from "@/modules/suppliers/queries";
import { enquiryReference } from "@/modules/enquiries/shared";
import { EvidenceDrawer } from "@/modules/evidence/components/evidence-drawer";
import { AddLineTabs } from "@/modules/quotations/components/add-line-tabs";
import { QuotationDetailsForm } from "@/modules/quotations/components/details-form";
import { LinesTable } from "@/modules/quotations/components/lines-table";
import { EmailQuotationForm } from "@/modules/quotations/components/email-quotation-form";
import { IssueQuotationButton, ReviseQuotationButton } from "@/modules/quotations/components/quotation-actions";
import { SentEmailsSection } from "@/modules/quotations/components/sent-emails";
import { SummaryStrip } from "@/modules/quotations/components/summary-strip";
import { TotalsPanel } from "@/modules/quotations/components/totals-panel";
import { buildQuotationEmailBody, defaultSignature, quotationEmailSubject } from "@/modules/quotations/email";
import { pdfFileName } from "@/modules/quotations/pdf";
import { computeTotals } from "@/modules/quotations/pricing";
import { getEmailComposeData, getQuotation, listSentEmailsForQuotation } from "@/modules/quotations/queries";
import { dateOnly, quotationLabel } from "@/modules/quotations/shared";

export async function generateMetadata(props: PageProps<"/quotations/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const quotation = z.uuid().safeParse(id).success ? await getQuotation(id) : null;
  return { title: quotation ? `${quotationLabel(quotation)} · Quotation` : "Quotation" };
}

export default async function QuotationPage(props: PageProps<"/quotations/[id]">) {
  const actor = await requireActor();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const quotation = await getQuotation(id);
  if (!quotation) notFound();

  const basePath = `/quotations/${id}`;
  const evidenceHref = (observationId: string) => buildHref(basePath, searchParams, { evidence: observationId });
  const draftNow = quotation.status === "DRAFT" && !quotation.enquiry?.archivedAt;
  // The pickers for "From a supplier confirmation" are only needed while the quotation can still be edited.
  // The email drawer is only needed for an issued quotation.
  const canEmail = quotation.status === "ISSUED";
  const [activity, suppliers, contacts, brands, sentEmails, compose, smtp, ownSignature] = await Promise.all([
    listActivity({ type: "Quotation", id }),
    draftNow ? listSupplierOptions() : Promise.resolve([]),
    draftNow ? listContactOptions() : Promise.resolve([]),
    draftNow ? listBrandOptions() : Promise.resolve([]),
    listSentEmailsForQuotation(id),
    canEmail ? getEmailComposeData(id) : Promise.resolve(null),
    canEmail ? getActiveSmtpAccount() : Promise.resolve(null),
    canEmail ? getOwnSignature(actor.id) : Promise.resolve(null),
  ]);

  const label = quotationLabel(quotation);
  const draft = quotation.status === "DRAFT";
  const archived = Boolean(quotation.enquiry?.archivedAt);
  const canEdit = draft && !archived;
  const current = quotation.revisions.find((r) => r.status !== "SUPERSEDED");
  const now = new Date();

  // The pre-written email: recipients from the customer's contacts, the quotation's own terms, and this person's signature.
  let emailButton = null;
  if (canEmail) {
    const vat = Number(quotation.vatPercent.toString());
    const totals = computeTotals(quotation.lines, quotation.vatPercent);
    const recipients = compose?.recipients ?? [];
    const attention = quotation.contactName?.trim().toLowerCase();
    const defaultTo = recipients.length === 1 ? [recipients[0]!.email] : attention ? recipients.filter((r) => r.name.toLowerCase() === attention).map((r) => r.email).slice(0, 1) : [];
    emailButton = smtp ? (
      <FormDrawer
        trigger={
          <Button variant="outline" size="sm">
            <Mail aria-hidden /> Send by email
          </Button>
        }
        title={`Email ${label}`}
        description="Written for you and editable. Nothing is sent until you press Send."
      >
        <EmailQuotationForm
          quotationId={quotation.id}
          from={`${smtp.fromName} <${smtp.fromAddress}>`}
          recipients={recipients}
          defaultTo={defaultTo}
          defaultBcc={smtp.defaultBcc ? [smtp.defaultBcc] : []}
          subject={quotationEmailSubject(label)}
          body={buildQuotationEmailBody({
            reference: label,
            contactName: quotation.contactName,
            currency: quotation.currencyCode,
            vatPercent: vat,
            total: totals.total,
            validUntil: quotation.validUntil,
            paymentTerms: quotation.paymentTerms,
            deliveryTerms: quotation.deliveryTerms,
            notes: quotation.notes,
          })}
          signature={ownSignature ?? defaultSignature(actor.name)}
          signatureSaved={Boolean(ownSignature)}
          attachmentName={pdfFileName(label)}
          previewHref={`${basePath}/pdf?inline=1`}
        />
      </FormDrawer>
    ) : (
      <Button variant="outline" size="sm" disabled title="No outgoing email account is set up. An admin can add one in Settings > Email accounts > Outgoing.">
        <Mail aria-hidden /> Send by email
      </Button>
    );
  }

  const details = {
    id: quotation.id,
    customerName: quotation.customerName,
    contactName: quotation.contactName,
    currencyCode: quotation.currencyCode,
    vatPercent: Number(quotation.vatPercent.toString()).toString(),
    validUntil: dateOnly(quotation.validUntil),
    paymentTerms: quotation.paymentTerms,
    deliveryTerms: quotation.deliveryTerms,
    notes: quotation.notes,
  };

  const addLine = (
    <FormDrawer
      trigger={
        <Button variant="outline" size="sm" disabled={!canEdit}>
          <Plus aria-hidden /> Add line
        </Button>
      }
      title="Add line"
      description="From a supplier's confirmation (recorded as evidence), or a typed line such as delivery."
    >
      <AddLineTabs
        quotationId={quotation.id}
        currencyCode={quotation.currencyCode}
        defaultConfirmedAt={toZonedInputValue(new Date())}
        suppliers={suppliers}
        contacts={contacts}
        brands={brands}
      />
    </FormDrawer>
  );

  return (
    <PageBody>
      <PageHeader
        breadcrumbs={[{ label: "Quotations", href: "/quotations" }, { label }]}
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono text-base text-muted-foreground">{label}</span>
            <span>{quotation.customerName ?? "No customer name"}</span>
          </span>
        }
        subtitle={quotation.enquiry ? `Quotation for ${enquiryReference(quotation.enquiry.number)}` : "Manual quotation"}
        meta={
          <>
            <QuotationStatusPill status={quotation.status} />
            {archived ? <Badge variant="muted">Enquiry archived</Badge> : null}
          </>
        }
        actions={
          <>
            {draft ? (
              <FormDrawer
                trigger={
                  <Button variant="outline" size="sm" disabled={!canEdit} title={archived ? "Restore the enquiry to edit this quotation" : undefined}>
                    <Pencil aria-hidden /> Edit details
                  </Button>
                }
                title={`Edit ${label}`}
                description="What the customer's copy shows."
              >
                <QuotationDetailsForm quotation={details} />
              </FormDrawer>
            ) : null}
            {draft ? addLine : null}
            {draft ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`${basePath}/print`} target="_blank" prefetch={false}>
                  <Printer aria-hidden /> Preview customer copy
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <a href={`${basePath}/pdf`} download title="Downloads the customer copy as a PDF file">
                  <Download aria-hidden /> Download PDF
                </a>
              </Button>
            )}
            {emailButton}
            {draft && canEdit ? <IssueQuotationButton id={quotation.id} /> : null}
            {quotation.status === "ISSUED" && !archived ? <ReviseQuotationButton id={quotation.id} /> : null}
          </>
        }
      />

      {quotation.status === "SUPERSEDED" ? (
        <Alert variant="warning" role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs">
          <span>Replaced by a newer revision. Kept exactly as it was issued.</span>
          {current && current.id !== quotation.id ? (
            <Link href={`/quotations/${current.id}`} className="font-medium underline">
              Open {quotationLabel({ ...quotation, revision: current.revision })}
            </Link>
          ) : null}
        </Alert>
      ) : quotation.status === "ISSUED" ? (
        <Alert variant="success" role="status" className="mb-4 px-4 py-2 text-xs">
          Issued {quotation.issuedAt ? formatDateTime(quotation.issuedAt) : ""}
          {quotation.issuedBy ? ` by ${quotation.issuedBy.name}` : ""}. Read-only: use Revise to change it.
        </Alert>
      ) : null}

      <SummaryStrip quotation={quotation} />

      <section aria-label="Lines" className="mb-4 space-y-2">
        {quotation.lines.length === 0 ? (
          <Panel>
            <EmptyState title="No lines yet" description="Add a line from a supplier's confirmation, or type one." action={canEdit ? addLine : undefined} />
          </Panel>
        ) : (
          <LinesTable quotation={quotation} evidenceHref={evidenceHref} now={now} />
        )}
        {quotation.lines.length > 0 ? (
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>Shaded columns are internal and never printed.</span>
            {draft ? (
              <details className="max-w-xl">
                <summary className="cursor-pointer select-none hover:text-foreground">How pricing works</summary>
                <p className="mt-1">
                  Change the markup and the price follows; change the price and the markup follows. Markup needs a known cost in {quotation.currencyCode}. The refresh icon takes the
                  cost again from the supplier chosen for that requirement.
                </p>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="mb-4">
        <TotalsPanel quotation={quotation} />
      </div>

      {canEmail || sentEmails.length > 0 ? (
        <div className="mb-4">
          <SentEmailsSection rows={sentEmails} />
        </div>
      ) : null}

      <CollapsibleSection title="Activity" count={activity.length}>
        <Timeline rows={activity} emptyTitle="No activity recorded yet" flat />
      </CollapsibleSection>

      <EvidenceDrawer observationId={firstParam(searchParams, "evidence")} closeHref={buildHref(basePath, searchParams, { evidence: undefined })} />
    </PageBody>
  );
}
