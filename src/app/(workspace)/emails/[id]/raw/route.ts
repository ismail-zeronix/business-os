import { requireActor } from "@/core/permissions/actor";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getEmailRaw } from "@/modules/email/queries";

/**
 * Downloads the original message exactly as it was received (RFC 822 / .eml). This is the immutable evidence, so it is served as a file
 * attachment and never rendered. A message that was too large to store has no original: the response says so plainly.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/emails/[id]/raw">) {
  await requireActor();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  const email = await getEmailRaw(id);
  if (!email) return new Response("Not found", { status: 404 });
  if (!email.rawSource) {
    return new Response("The original of this message was not stored (it was too large or could not be downloaded).", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // The filename comes from the subject: keep only safe characters so it cannot break the header or the file system.
  const safeName = (email.subject ?? "email").replace(/[^A-Za-z0-9 ._-]/g, "").trim().slice(0, 80) || "email";
  return new Response(new Uint8Array(email.rawSource), {
    headers: {
      "Content-Type": "message/rfc822",
      "Content-Disposition": `attachment; filename="${safeName}.eml"`,
      "Content-Length": String(email.rawSource.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
