import { describe, expect, it } from "vitest";
import { isItemReady } from "./readiness";

describe("isItemReady", () => {
  it("is ready when linked to an ACTIVE product", () => {
    expect(isItemReady({ productId: "p1", product: { status: "ACTIVE" } })).toBe(true);
  });
  it("is not ready when unlinked", () => {
    expect(isItemReady({ productId: null, product: null })).toBe(false);
  });
  it("is not ready when the product is archived", () => {
    expect(isItemReady({ productId: "p1", product: { status: "ARCHIVED" } })).toBe(false);
  });
  it("is not ready when the link points at a product that could not be loaded", () => {
    expect(isItemReady({ productId: "p1", product: null })).toBe(false);
  });
});
