import { Plus } from "lucide-react";
import Link from "next/link";
import { Panel } from "@/components/application/page-canvas";
import { EmptyState } from "@/components/application/states";
import { SupplierRequestStatusPill } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { FormDrawer } from "@/components/forms/form-drawer";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelativeAge, toZonedInputValue } from "@/lib/format";
import { PREFERRED_CHANNEL_LABEL } from "@/lib/labels";
import type { EnquiryDetail } from "@/modules/enquiries/queries";
import { getProductsIntelligence, type SupplierIntelligenceRow } from "@/modules/observations/procurement-queries";
import { listContactOptions, listSupplierOptions } from "@/modules/suppliers/queries";
import { buildRequestMessage } from "../message";
import { getSupplierSuggestions, listDecisionsForEnquiry, listRequestsForEnquiry, type SupplierRequestRow } from "../queries";
import { AddSupplierForm } from "./add-supplier-form";
import { CompareTable } from "./compare-table";
import { RequestMessageDrawer } from "./message-drawer";
import { OutcomeButton, RemoveRequestButton, ReopenRequestButton } from "./request-actions";

const replyHref = (request: SupplierRequestRow) => `/broadcasts/new?supplier=${request.supplier.id}&request=${request.id}`;

/**
 * The Sourcing tab of an enquiry: which suppliers were asked about the confirmed requirements, what was sent, and whether they replied.
 * The app prepares the message; a person sends it. A reply is recorded as a broadcast (the existing review flow), linked to the request.
 */
export async function SourcingTab({ enquiry, evidenceHref }: { enquiry: EnquiryDetail; evidenceHref: (observationId: string) => string }) {
  const lines = enquiry.items.filter((item) => item.reviewStatus === "CONFIRMED");
  const productIds = [...new Set(lines.map((line) => line.productId).filter((id): id is string => Boolean(id)))];
  const [requests, suggestions, supplierOptions, contactOptions, decisions, intelligence] = await Promise.all([
    listRequestsForEnquiry(enquiry.id),
    getSupplierSuggestions(enquiry.id),
    listSupplierOptions(),
    listContactOptions(),
    listDecisionsForEnquiry(enquiry.id),
    productIds.length ? getProductsIntelligence(productIds) : Promise.resolve(new Map<string, SupplierIntelligenceRow[]>()),
  ]);

  const now = new Date();
  const defaultSentAt = toZonedInputValue(now);
  const archived = Boolean(enquiry.archivedAt);
  const pending = enquiry.items.filter((item) => item.reviewStatus === "PENDING").length;

  // Suggested suppliers first, each with the reason; then every other active supplier not already on the enquiry.
  const askedIds = new Set(requests.map((r) => r.supplier.id));
  const suggestedIds = new Set(suggestions.map((s) => s.supplierId));
  const options = [
    ...suggestions.map((s) => ({ value: s.supplierId, label: `${s.name} · ${s.reasons.join(", ")}` })),
    ...supplierOptions.filter((o) => !askedIds.has(o.value) && !suggestedIds.has(o.value)),
  ];

  const waiting = requests.filter((r) => r.status === "SENT").length;
  const replied = requests.filter((r) => r.status === "REPLIED").length;

  const addSupplier = (
    <FormDrawer
      trigger={
        <Button variant="outline" size="sm" disabled={archived || lines.length === 0}>
          <Plus aria-hidden /> Add supplier
        </Button>
      }
      title="Add supplier"
      description="Who to ask about the confirmed requirements. Each supplier gets a ready-to-copy message."
    >
      <AddSupplierForm enquiryId={enquiry.id} suppliers={options} contacts={contactOptions} />
    </FormDrawer>
  );

  if (lines.length === 0 && requests.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="Confirm a requirement first"
          description="Suppliers are asked about the requirements you have confirmed. Review the requirements, then come back here."
          action={
            <Button asChild size="sm">
              <Link href={`/enquiries/${enquiry.id}`}>Go to Requirements</Link>
            </Button>
          }
        />
      </Panel>
    );
  }

  return (
    <section aria-label="Sourcing" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {requests.length} asked · {waiting} waiting · {replied} replied
          {lines.length ? ` · ${lines.length} confirmed requirement${lines.length === 1 ? "" : "s"} in the message` : ""}
        </p>
        {archived ? null : addSupplier}
      </div>

      {pending > 0 ? (
        <p className="text-xs text-muted-foreground">
          {pending} requirement{pending === 1 ? " is" : "s are"} still pending review and {pending === 1 ? "is" : "are"} not included in the message.
        </p>
      ) : null}

      {requests.length === 0 ? (
        <Panel>
          <EmptyState title="No suppliers asked yet" description="Add the suppliers you want to ask. Each one gets a message you can copy and send." action={addSupplier} />
        </Panel>
      ) : (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[22%]">Supplier</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[16%]">Sent</TableHead>
                <TableHead className="w-[20%]">Reply</TableHead>
                <TableHead className="w-[14%]">Note</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => {
                const message = request.status === "DRAFT" ? buildRequestMessage({ contactName: request.contact?.name ?? null, lines }) : null;
                const sentSummary = request.sentAt && request.channel ? `${PREFERRED_CHANNEL_LABEL[request.channel]}, ${formatDateTime(request.sentAt)}${request.sentBy ? `, by ${request.sentBy.name}` : ""}` : null;
                return (
                  <TableRow key={request.id} className="align-top">
                    <TableCell className="h-auto py-2">
                      <Link href={`/suppliers/${request.supplier.id}`} className="block truncate font-medium hover:underline">
                        {request.supplier.name}
                      </Link>
                      {request.contact ? <span className="block truncate text-xs text-muted-foreground">{request.contact.name}</span> : null}
                    </TableCell>
                    <TableCell className="h-auto py-2">
                      <SupplierRequestStatusPill status={request.status} />
                    </TableCell>
                    <TableCell className="h-auto py-2">
                      {request.sentAt && request.channel ? (
                        <span className="num" title={formatDateTime(request.sentAt)}>
                          {PREFERRED_CHANNEL_LABEL[request.channel]} · {formatRelativeAge(request.sentAt, now)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not sent</span>
                      )}
                    </TableCell>
                    <TableCell className="h-auto py-2">
                      {request.replies.length > 0 ? (
                        request.replies.map((reply) => (
                          <Link key={reply.id} href={`/broadcasts/${reply.id}`} className="block text-xs hover:underline">
                            Reply · {formatRelativeAge(reply.evidenceSource.observedAt, now)} · {reply._count.items} item{reply._count.items === 1 ? "" : "s"}
                            {reply.archivedAt ? " (archived)" : ""}
                          </Link>
                        ))
                      ) : (
                        <span className="text-muted-foreground">No reply yet</span>
                      )}
                    </TableCell>
                    <TableCell className="h-auto py-2">
                      {request.note ? <span className="block text-xs">{request.note}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="h-auto py-2">
                      {archived ? (
                        request.sentAt ? (
                          <RequestMessageDrawer request={{ id: request.id, supplierName: request.supplier.name, sent: true }} initialSubject="" initialBody="" defaultSentAt="" sentText={request.messageText} sentSummary={sentSummary} />
                        ) : null
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          {message ? (
                            <RequestMessageDrawer
                              request={{ id: request.id, supplierName: request.supplier.name, sent: false }}
                              initialSubject={message.subject}
                              initialBody={message.body}
                              defaultSentAt={defaultSentAt}
                              sentText={null}
                              sentSummary={null}
                            />
                          ) : request.sentAt ? (
                            <RequestMessageDrawer request={{ id: request.id, supplierName: request.supplier.name, sent: true }} initialSubject="" initialBody="" defaultSentAt="" sentText={request.messageText} sentSummary={sentSummary} />
                          ) : null}
                          {request.status !== "DRAFT" ? (
                            <Button asChild variant="outline" size="xs">
                              <Link href={replyHref(request)}>{request.status === "REPLIED" ? "Record another reply" : "Record reply"}</Link>
                            </Button>
                          ) : null}
                          {request.status === "DRAFT" || request.status === "SENT" ? <OutcomeButton id={request.id} /> : null}
                          {request.status === "NO_STOCK" || request.status === "DECLINED" ? <ReopenRequestButton id={request.id} /> : null}
                          {request.status === "DRAFT" ? <RemoveRequestButton id={request.id} /> : null}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableShell>
      )}

      {requests.length > 0 && lines.length > 0 ? (
        <CompareTable lines={lines} requests={requests} intelligence={intelligence} decisions={decisions} evidenceHref={evidenceHref} archived={archived} now={now} />
      ) : null}
    </section>
  );
}
