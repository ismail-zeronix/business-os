import type { EmailBand } from "../../../generated/prisma/enums";
import { findBrand, findSpecs } from "../../broadcasts/parsing/extractors";
import { findFamily, findRequestedQuantity } from "../../enquiries/parsing/extractors";
import { BAND_THRESHOLDS, PHRASES, SCORE_WEIGHTS } from "./config";

export type ScoreInput = {
  subject: string | null;
  /** The new part of the body (quoted replies already removed). */
  visibleText: string;
  fromAddress: string | null;
  attachmentNames: string[];
  hasListUnsubscribe: boolean;
  autoSubmitted: boolean;
};

export type ScoreContext = {
  brands: string[];
  categories: string[];
  families: string[];
  knownCustomer: boolean;
  knownSupplier: boolean;
};

export type ScoreReason = { label: string; points: number };
export type ScoreResult = { score: number; band: EmailBand; reasons: ScoreReason[] };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const firstMatch = (text: string, pattern: RegExp): string | null => pattern.exec(text)?.[0].trim() ?? null;

/** A category from the Category master mentioned as a whole word (or its plural). Longest names first, so "Workstation" beats "Station". */
function findCategory(text: string, categories: readonly string[]): string | null {
  for (const name of [...categories].filter(Boolean).sort((a, b) => b.length - a.length)) {
    if (new RegExp(String.raw`(?<![A-Za-z0-9])${escapeRegex(name)}s?(?![A-Za-z0-9])`, "i").test(text)) return name;
  }
  return null;
}

/**
 * Deterministic enquiry score. Pure: the same email and context always give the same result. Each rule can fire once and records a
 * readable reason. The total is clamped to 0-100 and mapped to a band. It never decides anything by itself: a person creates or dismisses.
 */
export function scoreEmail(input: ScoreInput, context: ScoreContext): ScoreResult {
  const reasons: ScoreReason[] = [];
  const add = (label: string, points: number) => reasons.push({ label, points });
  const subject = input.subject ?? "";
  const body = input.visibleText;
  const both = `${subject}\n${body}`;

  const subjectPhrase = firstMatch(subject, PHRASES.rfqSubject);
  if (subjectPhrase) add(`Subject mentions "${subjectPhrase}"`, SCORE_WEIGHTS.subjectRfq);

  const intentPhrase = firstMatch(body, PHRASES.intent);
  if (intentPhrase) add(`Asks for a quote or supply ("${intentPhrase}")`, SCORE_WEIGHTS.intent);

  if (context.knownCustomer) add("Sender is a known customer", SCORE_WEIGHTS.knownCustomer);

  const brand = findBrand(both, context.brands);
  if (brand) add(`Brand "${brand.name}" mentioned`, SCORE_WEIGHTS.knownBrand);

  const category = findCategory(both, context.categories);
  if (category) add(`Category "${category}" mentioned`, SCORE_WEIGHTS.knownCategory);

  const spec = findSpecs(both).snippets[0];
  const family = findFamily(both, context.families);
  if (spec || family) add(`Product detail found ("${spec?.text ?? family?.name}")`, SCORE_WEIGHTS.specPattern);

  const quantity = findRequestedQuantity(both, context.brands);
  if (quantity) add(`Quantity stated (${quantity.quantity})`, SCORE_WEIGHTS.quantity);

  const rfqAttachment = input.attachmentNames.find((name) => PHRASES.attachmentName.test(name));
  if (rfqAttachment) add(`Attachment "${rfqAttachment}" looks like an RFQ or BOQ`, SCORE_WEIGHTS.attachmentName);

  const marketing = firstMatch(both, PHRASES.marketing);
  if (marketing) add(`Marketing wording ("${marketing}")`, SCORE_WEIGHTS.marketing);

  const recruitment = firstMatch(both, PHRASES.recruitment);
  if (recruitment) add(`Recruitment wording ("${recruitment}")`, SCORE_WEIGHTS.recruitment);

  const newsletter = input.hasListUnsubscribe ? "List-Unsubscribe header" : firstMatch(both, PHRASES.newsletter);
  if (newsletter) add(`Newsletter indicator (${input.hasListUnsubscribe ? newsletter : `"${newsletter}"`})`, SCORE_WEIGHTS.newsletter);

  if (input.autoSubmitted || (input.fromAddress && PHRASES.automatedSender.test(input.fromAddress))) add("Automated sender", SCORE_WEIGHTS.automatedSender);

  if (context.knownSupplier) add("Sender is a known supplier (likely a price list, not an enquiry)", SCORE_WEIGHTS.knownSupplier);

  const total = reasons.reduce((sum, r) => sum + r.points, 0);
  const score = Math.max(0, Math.min(100, total));
  const band: EmailBand = score >= BAND_THRESHOLDS.likely ? "LIKELY" : score >= BAND_THRESHOLDS.review ? "REVIEW" : "LOW";
  return { score, band, reasons };
}
