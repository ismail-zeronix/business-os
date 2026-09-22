import { requireActor } from "@/core/permissions/actor";
import type { Metadata } from "next";
import { z } from "zod";
import { PageBody, Panel } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { toZonedInputValue } from "@/lib/format";
import { firstParam } from "@/lib/search-params";
import { listCustomerContactOptions, listCustomerOptions } from "@/modules/customers/queries";
import { EnquiryForm } from "@/modules/enquiries/components/enquiry-form";

export const metadata: Metadata = { title: "New enquiry" };

export default async function NewEnquiryPage(props: PageProps<"/enquiries/new">) {
  await requireActor();
  const searchParams = await props.searchParams;
  const [customers, contacts] = await Promise.all([listCustomerOptions(), listCustomerContactOptions()]);

  const requested = firstParam(searchParams, "customer");
  const defaultCustomerId = requested && z.uuid().safeParse(requested).success && customers.some((c) => c.value === requested) ? requested : null;

  return (
    <PageBody>
      <PageHeader
        breadcrumbs={[{ label: "Enquiries", href: "/enquiries" }, { label: "New enquiry" }]}
        title="New enquiry"
        subtitle="Paste a customer request. The original is preserved exactly; requirements are proposed for you to review."
      />
      <Panel className="max-w-4xl p-6">
        <EnquiryForm customers={customers} contacts={contacts} defaultCustomerId={defaultCustomerId} defaultReceivedAt={toZonedInputValue(new Date())} />
      </Panel>
    </PageBody>
  );
}
