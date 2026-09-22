import { describe, expect, it } from "vitest";
import { NAVIGATION, isNavActive } from "./navigation";

describe("isNavActive", () => {
  it("matches Overview only on the exact root path", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/suppliers", "/")).toBe(false);
  });

  it("matches a section and its nested routes, but not a sibling with a shared prefix", () => {
    expect(isNavActive("/suppliers", "/suppliers")).toBe(true);
    expect(isNavActive("/suppliers/abc-123", "/suppliers")).toBe(true);
    expect(isNavActive("/suppliers-archive", "/suppliers")).toBe(false);
  });
});

describe("NAVIGATION", () => {
  const hrefs = NAVIGATION.flatMap((group) => group.items.map((item) => item.href));

  it("contains exactly the screens of the current milestone, with no future modules", () => {
    expect(hrefs).toEqual(["/", "/enquiries", "/customers", "/quotations", "/search", "/suppliers", "/broadcasts", "/products", "/audit", "/settings"]);
    for (const future of ["/sourcing", "/rfqs", "/agents"]) {
      expect(hrefs).not.toContain(future);
    }
  });
});
