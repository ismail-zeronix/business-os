import { requireActor } from "@/core/permissions/actor";
import type { Metadata } from "next";
import { z } from "zod";
import { PageBody, Panel } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { EmptyState } from "@/components/application/states";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toZonedInputValue } from "@/lib/format";
import { firstParam } from "@/lib/search-params";
import { BroadcastForm } from "@/modules/broadcasts/components/broadcast-form";
import { enquiryReference } from "@/modules/enquiries/shared";
import { getRequestForReply } from "@/modules/sourcing/queries";
import { listContactOptions, listSupplierOptions } from "@/modules/suppliers/queries";

export const metadata: Metadata = { title: "New broadcast" };

export default async function NewBroadcastPage(props: PageProps<"/broadcasts/new">) {
  await requireActor();
  const searchParams = await props.searchParams;
  const [suppliers, contacts] = await Promise.all([listSupplierOptions(), listContactOptions()]);

  // `?request=` marks this message as the reply to a sourcing request: the supplier is that request's supplier.
  const requestParam = firstParam(searchParams, "request");
  const linked = requestParam && z.uuid().safeParse(requestParam).success ? await getRequestForReply(requestParam) : null;
  const request = linked && !linked.enquiry.archivedAt ? { id: linked.id, enquiryId: linked.enquiry.id, enquiryRef: enquiryReference(linked.enquiry.number) } : null;

  const requested = firstParam(searchParams, "supplier");
  const defaultSupplierId =
    linked && request
      ? linked.supplierId
      : requested && z.uuid().safeParse(requested).success && suppliers.some((s) => s.value === requested)
        ? requested
        : null;

  return (
    <PageBody>
      <PageHeader
        breadcrumbs={[{ label: "Broadcasts", href: "/broadcasts" }, { label: request ? "Record reply" : "New broadcast" }]}
        title={request ? "Record reply" : "New broadcast"}
        subtitle={request ? `Paste the supplier's reply to the request on ${request.enquiryRef}. The original is preserved exactly; items are proposed for you to review.` : "Paste a supplier message. The original is preserved exactly; items are proposed for you to review."}
      />
      {suppliers.length === 0 ? (
        <EmptyState
          title="Add a supplier first"
          description="A broadcast belongs to a supplier. Create one, then come back to paste its message."
          action={
            <Button asChild size="sm">
              <Link href="/suppliers">Go to Suppliers</Link>
            </Button>
          }
        />
      ) : (
        <Panel className="max-w-4xl p-6">
          <BroadcastForm suppliers={suppliers} contacts={contacts} defaultSupplierId={defaultSupplierId} defaultReceivedAt={toZonedInputValue(new Date())} request={request} />
        </Panel>
      )}
    </PageBody>
  );
}
