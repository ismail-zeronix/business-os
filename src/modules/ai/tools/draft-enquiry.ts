import { z } from "zod";
import { createEnquiry } from "../../enquiries/service";
import { enquiryReference } from "../../enquiries/shared";
import type { AIToolDefinition } from "./types";

/**
 * draft_enquiry: saves what the intake chat compiled as a new enquiry, exactly as if a person had pasted it: the text becomes immutable
 * evidence (channel ASSISTANT), the deterministic parser proposes the requirements, and every one stays PENDING until a person confirms it.
 * It is called only from the "Create enquiry draft" button, never chosen by the model. The customer is not matched here: a person links it
 * afterwards on the enquiry, as for any pasted request.
 */

const inputSchema = z.object({
  summary: z.string().trim().min(1).max(6000),
  requesterName: z.string().trim().min(1).max(200).nullable(),
  requesterEmail: z.email().max(254).nullable(),
});
export type DraftEnquiryInput = z.output<typeof inputSchema>;

export type DraftEnquiryOutput = { enquiryId: string; reference: string; itemCount: number };

export const draftEnquiryTool: AIToolDefinition<DraftEnquiryInput, DraftEnquiryOutput> = {
  name: "draft_enquiry",
  description: "Save a compiled customer request as a new enquiry whose requirements are proposals for a person to review.",
  inputSchema,
  requiredCapabilities: ["ai.use"],
  async execute(input, ctx) {
    const { enquiry, itemCount } = await createEnquiry(ctx, {
      source: { kind: "new", channel: "ASSISTANT", observedAt: new Date(), rawText: input.summary },
      customerId: null,
      contactId: null,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      subject: null,
      notes: null,
    });
    return { enquiryId: enquiry.id, reference: enquiryReference(enquiry.number), itemCount };
  },
};
