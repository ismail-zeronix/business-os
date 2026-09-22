import { requireActor } from "@/core/permissions/actor";
import { notFound } from "next/navigation";
import { z } from "zod";
import { pdfFileName, renderQuotationPdf } from "@/modules/quotations/pdf";
import { getQuotationForPrint } from "@/modules/quotations/queries";
import { quotationLabel } from "@/modules/quotations/shared";

export const dynamic = "force-dynamic";

/** The customer's copy as a real PDF file: the topbar's Download PDF. Needs a signed-in person, like every page. */
export async function GET(request: Request, ctx: RouteContext<"/quotations/[id]/pdf">) {
  await requireActor();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const quotation = await getQuotationForPrint(id);
  if (!quotation) notFound();

  try {
    const pdf = await renderQuotationPdf(id);
    const disposition = new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment";
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${pdfFileName(quotationLabel(quotation))}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    // A plain message for the person; the details stay in the server log.
    console.error("PDF generation failed:", error);
    const message = error instanceof Error && error.name === "InvariantError" ? error.message : "The PDF could not be made. Try again, or use Print on the quotation page.";
    return new Response(message, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
