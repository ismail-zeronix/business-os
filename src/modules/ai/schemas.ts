import { z } from "zod";
import { AiProvider } from "../../generated/prisma/enums";
import { requiredText } from "../../core/validation/fields";

// ── provider settings ───────────────────────────────────────────────────────────────────────────────────────────

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

const model = requiredText("Model", 100).regex(/^[A-Za-z0-9._:/@-]+$/, "Enter the model name exactly, without spaces");
/** Keys are not trimmed inside, only at the ends, and never echoed back (the actions strip them from a failed form). */
const apiKey = z.string({ error: "Enter the API key" }).trim().min(10, "Enter the API key").max(500, "The key is too long");

export const aiProviderCreateSchema = z.object({ provider: z.enum(AiProvider), model, apiKey });
/** A blank key on edit means "keep the stored one". */
export const aiProviderUpdateSchema = z.object({ id: z.uuid(), model, apiKey: z.preprocess(blankToUndefined, apiKey.optional()) });
export const aiProviderActiveSchema = z.object({ id: z.uuid(), active: z.enum(["true", "false"]).transform((v) => v === "true") });
/** Test connection: the form as filled in. On a saved provider a blank key means "use the stored one". */
export const aiProviderTestSchema = z.object({
  id: z.preprocess(blankToUndefined, z.uuid().optional()),
  provider: z.enum(AiProvider),
  model,
  apiKey: z.preprocess(blankToUndefined, apiKey.optional()),
});

export type AiProviderCreateInput = z.output<typeof aiProviderCreateSchema>;
export type AiProviderUpdateInput = z.output<typeof aiProviderUpdateSchema>;
export type AiProviderActiveInput = z.output<typeof aiProviderActiveSchema>;

// ── asking the assistant ─────────────────────────────────────────────────────────────────────────────────────────

/** The client sends only the path it is on; the server decides what entity that is (context/page.ts). */
export const askSchema = z.object({
  question: requiredText("Question", 2000),
  path: z.string().max(300).startsWith("/").nullable().default(null),
});
export type AskInput = z.input<typeof askSchema>;

// ── what the model may return ────────────────────────────────────────────────────────────────────────────────────

/** Actions the model may suggest. They are buttons for a person, never executed by the AI. */
export const NEXT_ACTION_TYPES = ["OPEN_PRODUCT", "OPEN_SUPPLIER", "REQUEST_STOCK_CONFIRMATION", "REFINE_QUESTION"] as const;
export type NextActionType = (typeof NEXT_ACTION_TYPES)[number];

/**
 * The model's draft for an answer. It does NOT contain the confidence number, the evidence details or any figure of its own: it cites
 * short references from the evidence package (E1, P1, S1), and the orchestrator checks every reference and every figure against it.
 * Every property is required and optional values are nullable, so one strict JSON Schema serves every provider.
 */
export const answerDraftSchema = z.object({
  answer: z.string().trim().min(1).max(2500),
  evidenceRefs: z.array(z.string().max(12)).max(40),
  warnings: z.array(z.string().trim().min(1).max(300)).max(8),
  missingInformation: z.array(z.string().trim().min(1).max(300)).max(8),
  recommendations: z.array(z.object({ title: z.string().trim().min(1).max(160), reason: z.string().trim().min(1).max(400) })).max(4),
  nextActions: z.array(z.object({ type: z.enum(NEXT_ACTION_TYPES), label: z.string().trim().min(1).max(80), ref: z.string().max(12).nullable() })).max(4),
});
export type AnswerDraft = z.output<typeof answerDraftSchema>;

/** When the rules find nothing, the model may propose search terms. They are searched like anything a person types. */
export const searchTermsSchema = z.object({ searchTerms: z.array(z.string().trim().min(2).max(80)).max(3) });

/** Test connection: the smallest structured call that proves the key, the model and structured output all work. */
export const connectionCheckSchema = z.object({ ok: z.boolean() });
