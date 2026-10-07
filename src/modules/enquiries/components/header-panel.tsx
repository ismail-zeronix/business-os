import { Pencil, UserPlus } from "lucide-react";
import Link from "next/link";
import { KeyValue } from "@/components/application/key-value";
import { PanelSection } from "@/components/application/page-canvas";
import { TopbarActions } from "@/components/application/topbar-slot";
import { FormDrawer } from "@/components/forms/form-drawer";
import type { SelectOption } from "@/components/forms/multi-select";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import { EVIDENCE_CHANNEL_LABEL } from "@/lib/labels";
import type { EnquiryDetail } from "../queries";
import { CreateCustomerFromRequesterForm } from "./create-customer-form";
import { EnquiryHeaderForm } from "./enquiry-header-form";
import { EnquiryOwnerControl } from "./owner-control";

type ContactOption = SelectOption & { customerId: string };

/** The operational picture of an enquiry: who asked, how urgent, by when, where to, what blocks it and what happens next. */
export function EnquiryHeaderPanel({
  enquiry,
  customers,
  contacts,
  owners,
  isAdmin,
}: {
  enquiry: EnquiryDetail;
  customers: SelectOption[];
  contacts: ContactOption[];
  owners: SelectOption[];
  isAdmin: boolean;
}) {
  const requester = [enquiry.requesterName, enquiry.requesterEmail].filter(Boolean).join(" · ");
  const archived = Boolean(enquiry.archivedAt);
  const canPromote = !enquiry.customerId && Boolean(enquiry.requesterName || enquiry.requesterEmail);

  return (
    <>
      <TopbarActions>
        {isAdmin ? <EnquiryOwnerControl enquiryId={enquiry.id} ownerId={enquiry.assignedTo?.id ?? null} ownerName={enquiry.assignedTo?.name ?? null} users={owners} disabled={archived} /> : null}
        {canPromote ? (
          <FormDrawer
            trigger={
              <Button variant="outline" size="sm" disabled={archived}>
                <UserPlus aria-hidden /> Save as customer
              </Button>
            }
            title="Save as customer"
            description="Creates a customer and contact from the person who wrote in, and links this enquiry to them."
          >
            <CreateCustomerFromRequesterForm enquiryId={enquiry.id} requesterName={enquiry.requesterName} requesterEmail={enquiry.requesterEmail} />
          </FormDrawer>
        ) : null}
        <FormDrawer
          trigger={
            <Button variant="outline" size="sm" disabled={archived} title={archived ? "Restore the enquiry to edit it" : undefined}>
              <Pencil aria-hidden /> Edit
            </Button>
          }
          title={`Edit ENQ-${String(enquiry.number).padStart(5, "0")}`}
        >
          <EnquiryHeaderForm
            enquiry={{
              id: enquiry.id,
              customerId: enquiry.customerId,
              contactId: enquiry.contactId,
              requesterName: enquiry.requesterName,
              requesterEmail: enquiry.requesterEmail,
              subject: enquiry.subject,
              priority: enquiry.priority,
              requiredBy: enquiry.requiredBy ? enquiry.requiredBy.toISOString().slice(0, 10) : null,
              deliveryLocation: enquiry.deliveryLocation,
              blocker: enquiry.blocker,
              nextAction: enquiry.nextAction,
              notes: enquiry.notes,
            }}
            customers={customers}
            contacts={contacts}
          />
        </FormDrawer>
      </TopbarActions>

      <PanelSection className="mb-4">

        <KeyValue
          columns={3}
          items={[
            {
              label: "Customer",
              value: enquiry.customer ? (
                <Link href={`/customers/${enquiry.customer.id}`} className="text-brand hover:underline">
                  {enquiry.customer.name}
                </Link>
              ) : null,
            },
            { label: "Contact", value: enquiry.contact?.name },
            { label: "Requester (as written)", value: requester || null },
            { label: "Subject", value: enquiry.subject },
            { label: "Received", value: `${formatDateTime(enquiry.evidenceSource.observedAt)} · ${EVIDENCE_CHANNEL_LABEL[enquiry.evidenceSource.channel]}` },
            { label: "Required by", value: enquiry.requiredBy ? formatDate(enquiry.requiredBy) : null },
            { label: "Delivery", value: enquiry.deliveryLocation },
            { label: "Owner", value: enquiry.assignedTo?.name },
            { label: "Blocker", value: enquiry.blocker },
            { label: "Next action", value: enquiry.nextAction },
            { label: "Notes", value: enquiry.notes },
          ]}
        />
      </PanelSection>
    </>
  );
}
