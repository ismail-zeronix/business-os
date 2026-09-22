import { FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QUOTATION_STATUS_LABEL } from "@/lib/labels";
import type { QuotationStatus } from "@/generated/prisma/enums";
import { quotationLabel } from "../shared";
import { CreateQuotationButton } from "./quotation-actions";

type EnquiryQuotation = { id: string; quoteDate: Date; quoteSeq: number; revision: number; status: QuotationStatus };

/**
 * The enquiry's link to its quotations, in the page's action bar: a link to each current quotation (draft or issued; superseded revisions
 * are reached from their quotation) and the button to make a new one. Creating needs a confirmed requirement.
 */
export function EnquiryQuotationActions({ enquiryId, quotations, confirmedCount, archived }: { enquiryId: string; quotations: EnquiryQuotation[]; confirmedCount: number; archived: boolean }) {
  const current = quotations.filter((q) => q.status !== "SUPERSEDED");
  const hasDraft = current.some((q) => q.status === "DRAFT");

  return (
    <>
      {current.map((quotation) => (
        <Button key={quotation.id} asChild variant="outline" size="sm">
          <Link href={`/quotations/${quotation.id}`}>
            <FileText aria-hidden /> {quotationLabel(quotation)} · {QUOTATION_STATUS_LABEL[quotation.status]}
          </Link>
        </Button>
      ))}
      {hasDraft || archived ? null : (
        <CreateQuotationButton
          enquiryId={enquiryId}
          disabled={confirmedCount === 0}
          disabledTitle="Confirm at least one requirement first"
        />
      )}
    </>
  );
}
