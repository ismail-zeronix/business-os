import { createHash } from "node:crypto";
import type { ServiceContext } from "../../core/database/tx";
import type { EvidenceChannel, EvidenceKind } from "../../generated/prisma/enums";

/** sha256 of the whitespace-normalised, lower-cased text. Used only to WARN about duplicate pastes (same wording, different spacing), never to block. */
export function contentHashOf(rawText: string): string {
  const normalised = rawText.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(normalised).digest("hex");
}

/**
 * Stores raw evidence exactly as received. The row is immutable (a database trigger rejects UPDATE and DELETE), so the original
 * message survives however the structured data derived from it is later corrected. Audited by the caller as part of its own change.
 */
export async function createEvidence(ctx: ServiceContext, input: { kind: EvidenceKind; channel: EvidenceChannel; rawText: string; observedAt: Date }) {
  return ctx.db.evidenceSource.create({
    data: {
      kind: input.kind,
      channel: input.channel,
      rawText: input.rawText, // preserved verbatim: no trimming, no normalising
      contentHash: contentHashOf(input.rawText),
      observedAt: input.observedAt,
      createdById: ctx.actor.id,
    },
  });
}
