import { requireActor } from "@/core/permissions/actor";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getSentEmailAttachment } from "@/modules/quotations/queries";

export const dynamic = "force-dynamic";

/** The exact PDF that was attached to a sent email, as it was sent. Needs a signed-in person. */
export async function GET(_request: Request, ctx: RouteContext<"/sent-emails/[id]/attachment">) {
  await requireActor();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const attachment = await getSentEmailAttachment(id);
  if (!attachment) notFound();
  return new Response(new Uint8Array(attachment.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${attachment.name.replace(/"/g, "")}"`, "Cache-Control": "private, no-store" },
  });
}
