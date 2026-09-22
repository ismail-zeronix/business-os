import { z } from "zod";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { optionalText } from "../../core/validation/fields";
import { writeAudit } from "../audit/service";

/** Each person has their own email signature, added under the emails they send. Anyone signed in may change their own, and only their own. */
export const signatureSchema = z.object({ signature: optionalText(2000) });
export type SignatureInput = z.output<typeof signatureSchema>;

export async function saveOwnSignature(ctx: ServiceContext, input: SignatureInput) {
  return inTransaction(ctx, async (c) => {
    const before = await c.db.user.findUnique({ where: { id: ctx.actor.id }, select: { emailSignature: true } });
    if ((before?.emailSignature ?? null) === input.signature) return { signature: input.signature };
    await c.db.user.update({ where: { id: ctx.actor.id }, data: { emailSignature: input.signature } });
    await writeAudit(c, { action: "user.signature_changed", entityType: "User", entityId: ctx.actor.id, details: { signature: input.signature ? "set" : "cleared" } });
    return { signature: input.signature };
  });
}

/** The signature of one person, or null when they have not saved one. */
export async function getSignature(ctx: ServiceContext, userId: string): Promise<string | null> {
  const user = await ctx.db.user.findUnique({ where: { id: userId }, select: { emailSignature: true } });
  return user?.emailSignature ?? null;
}
