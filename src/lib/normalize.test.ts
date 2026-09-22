import { describe, expect, it } from "vitest";
import { normalizeCode, normalizeCodeOrNull, normalizeName } from "./normalize";

describe("normalizeName", () => {
  it("trims, collapses whitespace and lower-cases", () => {
    expect(normalizeName("  ABC   Computers ")).toBe("abc computers");
  });

  it("makes case and spacing variants identical", () => {
    expect(normalizeName("Dell")).toBe(normalizeName(" dell "));
    expect(normalizeName("Tech  Distribution")).toBe(normalizeName("tech distribution"));
  });

  it("folds full-width characters (NFKC)", () => {
    expect(normalizeName("ＡＢＣ Trading")).toBe("abc trading");
  });

  it("keeps punctuation that distinguishes names", () => {
    expect(normalizeName("ABC Computers - Sharjah")).not.toBe(normalizeName("ABC Computers - Dubai"));
  });
});

describe("normalizeCode", () => {
  it("strips separators and upper-cases", () => {
    expect(normalizeCode("83a100-suak")).toBe("83A100SUAK");
    expect(normalizeCode("83A100 SUAK")).toBe("83A100SUAK");
  });

  it("makes alias spellings comparable", () => {
    expect(normalizeCode("V15 G4")).toBe("V15G4");
    expect(normalizeCode("V15G4")).toBe("V15G4");
    expect(normalizeCode("v15-g4")).toBe("V15G4");
  });

  it("keeps non-latin letters instead of erasing them", () => {
    expect(normalizeCode("حاسوب 15")).toBe("حاسوب15");
  });

  it("returns an empty string when nothing alphanumeric remains", () => {
    expect(normalizeCode("---")).toBe("");
  });
});

describe("normalizeCodeOrNull", () => {
  it("returns null for unknown input rather than an empty key", () => {
    expect(normalizeCodeOrNull(undefined)).toBeNull();
    expect(normalizeCodeOrNull(null)).toBeNull();
    expect(normalizeCodeOrNull("  ")).toBeNull();
    expect(normalizeCodeOrNull("---")).toBeNull();
  });

  it("returns the normalised code when present", () => {
    expect(normalizeCodeOrNull("7L6Z4EA#ABV")).toBe("7L6Z4EAABV");
  });
});
