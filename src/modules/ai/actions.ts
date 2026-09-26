"use server";

import { revalidatePath } from "next/cache";
import { NotFoundError, ValidationError } from "@/core/errors";
import { getServiceContext } from "@/core/permissions/actor";
import { assertCapability } from "@/core/permissions/capabilities";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { testProviderConnection } from "./orchestrator/connection";
import { createEnquiryFromChat, runEnquiryDraftTurn, type EnquiryChatTurn } from "./orchestrator/enquiry-draft";
import { loadProviderConfig } from "./queries";
import {
  aiProviderActiveSchema,
  aiProviderCreateSchema,
  aiProviderTestSchema,
  aiProviderUpdateSchema,
  type CreateEnquiryFromChatInput,
  type EnquiryChatTurnInput,
} from "./schemas";
import type { DraftEnquiryOutput } from "./tools/draft-enquiry";
import { createProviderSetting, setProviderActive, updateProviderSetting } from "./service";

/**
 * Thin server actions for Settings > AI. SECURITY: `runAction` echoes submitted values back when a form fails, so the API key is
 * stripped from the FormData first: it must never be sent back to the browser.
 */
type IdResult = ActionResult<{ id: string }>;

function withoutKey(formData: FormData): FormData {
  const safe = new FormData();
  for (const [key, value] of formData.entries()) if (key !== "apiKey") safe.append(key, value);
  return safe;
}

const refresh = () => revalidatePath("/settings/ai");

export async function createAiProviderAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const setting = await createProviderSetting(await getServiceContext(), aiProviderCreateSchema.parse(formDataToObject(formData)));
      refresh();
      return { id: setting.id };
    },
    { successMessage: "AI provider saved", formData: withoutKey(formData) },
  );
}

export async function updateAiProviderAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const setting = await updateProviderSetting(await getServiceContext(), aiProviderUpdateSchema.parse(formDataToObject(formData)));
      refresh();
      return { id: setting.id };
    },
    { successMessage: "AI provider saved", formData: withoutKey(formData) },
  );
}

export async function setAiProviderActiveAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = aiProviderActiveSchema.parse(formDataToObject(formData));
      await setProviderActive(await getServiceContext(), input);
      refresh();
      return { id: input.id };
    },
    { successMessage: formData.get("active") === "true" ? "The assistant now uses this provider" : "The assistant is switched off", formData },
  );
}

// ── enquiry intake chat ─────────────────────────────────────────────────────────────────────────────────────────

/** One chat turn. Called from the panel, not a form. Nothing is saved: the model only replies. */
export async function sendEnquiryChatMessageAction(input: EnquiryChatTurnInput): Promise<ActionResult<EnquiryChatTurn>> {
  return runAction(async () => runEnquiryDraftTurn(await getServiceContext(), input));
}

/** The person pressed "Create enquiry draft". The requirements it proposes stay PENDING on the enquiry until they are confirmed. */
export async function createEnquiryFromChatAction(input: CreateEnquiryFromChatInput): Promise<ActionResult<DraftEnquiryOutput>> {
  return runAction(async () => {
    const created = await createEnquiryFromChat(await getServiceContext(), input);
    revalidatePath("/enquiries");
    revalidatePath("/", "layout");
    return created;
  });
}

type TestResult = ActionResult<{ model: string; latencyMs: number }>;

/**
 * "Test connection" for the form as filled in. On a saved provider a blank key means "use the stored one" (decrypted here, in memory,
 * never returned). Sends one tiny request to the provider and stores nothing. A failure is one plain sentence.
 */
export async function testAiProviderAction(_prev: TestResult | null, formData: FormData): Promise<TestResult> {
  return runAction(
    async () => {
      assertCapability(await getServiceContext(), "ai.settings.manage");
      const input = aiProviderTestSchema.parse(formDataToObject(formData));
      let apiKey = input.apiKey;
      if (apiKey === undefined && input.id) {
        const stored = await loadProviderConfig(input.id);
        if (!stored || stored.provider !== input.provider) throw new NotFoundError("AI provider");
        apiKey = stored.apiKey;
      }
      if (apiKey === undefined) throw new ValidationError("Enter the API key to test the connection.", { apiKey: "Enter the key" });
      return testProviderConnection({ provider: input.provider, model: input.model, apiKey });
    },
    { successMessage: "Connection works", formData: withoutKey(formData) },
  );
}
