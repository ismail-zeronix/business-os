import { describe, expect, it } from "vitest";
import { BAND_THRESHOLDS, SCORE_WEIGHTS } from "./config";
import { scoreEmail, type ScoreContext, type ScoreInput } from "./score";

const context: ScoreContext = { brands: ["Dell", "HP", "Lenovo"], categories: ["Laptop", "Monitor"], families: ["Latitude", "ProBook"], knownCustomer: false, knownSupplier: false };
const email = (over: Partial<ScoreInput> = {}): ScoreInput => ({ subject: null, visibleText: "", fromAddress: "someone@example.test", attachmentNames: [], hasListUnsubscribe: false, autoSubmitted: false, ...over });
const labels = (input: ScoreInput, ctx = context) => scoreEmail(input, ctx).reasons.map((r) => r.label);

describe("scoreEmail", () => {
  it("scores an empty email zero, in the LOW band, with no reasons", () => {
    expect(scoreEmail(email(), context)).toEqual({ score: 0, band: "LOW", reasons: [] });
  });

  it("a clear enquiry from a known customer is LIKELY, and every point has a reason", () => {
    const result = scoreEmail(
      email({ subject: "Request for quotation - laptops", visibleText: "Please quote 10 units Dell Latitude 5440 i7 16GB 512GB SSD laptop." }),
      { ...context, knownCustomer: true },
    );
    expect(result.band).toBe("LIKELY");
    expect(result.score).toBeGreaterThanOrEqual(BAND_THRESHOLDS.likely);
    expect(result.reasons.reduce((sum, r) => sum + r.points, 0)).toBe(result.score);
    const text = result.reasons.map((r) => r.label).join("|");
    expect(text).toContain("Subject mentions");
    expect(text).toContain("Sender is a known customer");
    expect(text).toContain('Brand "Dell" mentioned');
  });

  it("each rule fires at most once, with its configured weight", () => {
    const result = scoreEmail(email({ subject: "RFQ rfq quotation" }), context);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]!.points).toBe(SCORE_WEIGHTS.subjectRfq);
  });

  it("marketing, recruitment, newsletters, automated senders and known suppliers lower the score", () => {
    expect(labels(email({ visibleText: "Limited time offer! Click here" }))).toEqual([expect.stringContaining("Marketing wording")]);
    expect(labels(email({ visibleText: "Please find my CV, I am a candidate" }))).toEqual([expect.stringContaining("Recruitment wording")]);
    expect(labels(email({ hasListUnsubscribe: true }))).toEqual([expect.stringContaining("Newsletter indicator")]);
    expect(labels(email({ fromAddress: "no-reply@example.test" }))).toEqual(["Automated sender"]);
    expect(labels(email({ autoSubmitted: true }))).toEqual(["Automated sender"]);
    expect(labels(email(), { ...context, knownSupplier: true })).toEqual([expect.stringContaining("known supplier")]);
  });

  it("never goes below 0 or above 100", () => {
    const bad = scoreEmail(email({ visibleText: "unsubscribe limited time offer resume", hasListUnsubscribe: true, fromAddress: "no-reply@x.test" }), { ...context, knownSupplier: true });
    expect(bad.score).toBe(0);
    expect(bad.band).toBe("LOW");
    const good = scoreEmail(
      email({ subject: "RFQ", visibleText: "Please quote 5 units HP ProBook 440 i7 16GB 512GB SSD laptop, we need them", attachmentNames: ["RFQ-laptops.xlsx"] }),
      { ...context, knownCustomer: true },
    );
    expect(good.score).toBeLessThanOrEqual(100);
  });

  it("recognises an RFQ attachment name", () => {
    expect(labels(email({ attachmentNames: ["BOQ_final.xlsx"] }))).toEqual([expect.stringContaining("looks like an RFQ or BOQ")]);
    expect(labels(email({ attachmentNames: ["photo.jpg"] }))).toEqual([]);
  });

  it("maps the score to the band at the thresholds", () => {
    const review = scoreEmail(email({ subject: "Quotation", visibleText: "We need laptops" }), context);
    expect(review.score).toBeGreaterThanOrEqual(BAND_THRESHOLDS.review);
    expect(review.band === "REVIEW" || review.band === "LIKELY").toBe(true);
    expect(scoreEmail(email({ visibleText: "Hello" }), context).band).toBe("LOW");
  });

  it("is deterministic", () => {
    const input = email({ subject: "Price request", visibleText: "looking for Lenovo monitor, qty 4" });
    expect(scoreEmail(input, context)).toEqual(scoreEmail(input, context));
  });

  it("only recognises brands and categories from the master lists", () => {
    expect(labels(email({ visibleText: "Acme laptop" }), { ...context, categories: [] })).toEqual([]);
    expect(labels(email({ visibleText: "Acme laptop" }))).toEqual(['Category "Laptop" mentioned']);
  });
});
