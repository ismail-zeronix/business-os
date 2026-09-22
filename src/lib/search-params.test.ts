import { describe, expect, it } from "vitest";
import { buildHref, firstParam, parsePage } from "./search-params";

describe("firstParam", () => {
  it("trims and treats blank as absent", () => {
    expect(firstParam({ q: "  dell " }, "q")).toBe("dell");
    expect(firstParam({ q: "   " }, "q")).toBeUndefined();
    expect(firstParam({}, "q")).toBeUndefined();
  });

  it("takes the first of repeated params", () => {
    expect(firstParam({ status: ["ACTIVE", "ARCHIVED"] }, "status")).toBe("ACTIVE");
  });
});

describe("parsePage", () => {
  it("defaults to 1 and rejects invalid values", () => {
    expect(parsePage({})).toBe(1);
    expect(parsePage({ page: "0" })).toBe(1);
    expect(parsePage({ page: "-3" })).toBe(1);
    expect(parsePage({ page: "abc" })).toBe(1);
    expect(parsePage({ page: "2.5" })).toBe(2);
  });

  it("reads a valid page", () => {
    expect(parsePage({ page: "4" })).toBe(4);
  });
});

describe("buildHref", () => {
  it("preserves existing params and applies a patch", () => {
    expect(buildHref("/suppliers", { q: "dell", status: "ACTIVE" }, { page: 2 })).toBe("/suppliers?q=dell&status=ACTIVE&page=2");
  });

  it("removes a key when the patch value is empty, null or undefined", () => {
    expect(buildHref("/suppliers", { q: "dell", page: "3" }, { page: undefined })).toBe("/suppliers?q=dell");
    expect(buildHref("/suppliers", { q: "dell" }, { q: "" })).toBe("/suppliers");
    expect(buildHref("/suppliers", { q: "dell" }, { q: null })).toBe("/suppliers");
  });

  it("returns the bare path when nothing remains", () => {
    expect(buildHref("/products", {}, {})).toBe("/products");
  });
});
