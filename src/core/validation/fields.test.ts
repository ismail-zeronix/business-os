import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formDataToObject } from "./form-data";
import { idList, optionalEmail, optionalEnum, optionalQuantity, optionalText, optionalUrl, requiredText } from "./fields";

const parse = <T extends z.ZodType>(schema: T, value: unknown) => schema.safeParse(value);

describe("requiredText", () => {
  it("trims and rejects blank input with a plain message", () => {
    expect(parse(requiredText("Name"), "  ABC  ").data).toBe("ABC");
    const blank = parse(requiredText("Name"), "   ");
    expect(blank.success).toBe(false);
    expect(blank.error?.issues[0]?.message).toBe("Name is required");
    expect(parse(requiredText("Name"), undefined).success).toBe(false);
  });
});

describe("optionalText", () => {
  it("turns blank and missing input into null (unknown stays unknown)", () => {
    expect(parse(optionalText(), "").data).toBeNull();
    expect(parse(optionalText(), "   ").data).toBeNull();
    expect(parse(optionalText(), undefined).data).toBeNull();
    expect(parse(optionalText(), " 30 days ").data).toBe("30 days");
  });

  it("enforces a maximum length", () => {
    expect(parse(optionalText(5), "123456").success).toBe(false);
  });
});

describe("optionalEmail", () => {
  it("validates only when supplied", () => {
    expect(parse(optionalEmail(), "").data).toBeNull();
    expect(parse(optionalEmail(), "sales@abc.ae").data).toBe("sales@abc.ae");
    expect(parse(optionalEmail(), "not-an-email").success).toBe(false);
  });
});

describe("optionalUrl", () => {
  it("accepts a bare domain and stores https", () => {
    expect(parse(optionalUrl(), "abc.ae").data).toBe("https://abc.ae");
    expect(parse(optionalUrl(), "http://abc.ae/x").data).toBe("http://abc.ae/x");
    expect(parse(optionalUrl(), "").data).toBeNull();
  });

  it("rejects non-http schemes that would be an XSS risk as links", () => {
    expect(parse(optionalUrl(), "javascript:alert(1)").success).toBe(false);
    expect(parse(optionalUrl(), "data:text/html,<b>x</b>").success).toBe(false);
    expect(parse(optionalUrl(), "ftp://abc.ae").success).toBe(false);
  });
});

describe("optionalEnum", () => {
  const schema = optionalEnum(["ACTIVE", "INACTIVE"] as const, "status");
  it("maps blank to null and rejects unknown values", () => {
    expect(parse(schema, "").data).toBeNull();
    expect(parse(schema, "ACTIVE").data).toBe("ACTIVE");
    expect(parse(schema, "BOGUS").success).toBe(false);
  });
});

describe("optionalQuantity", () => {
  it("keeps zero, maps blank to null, rejects negatives and decimals", () => {
    expect(parse(optionalQuantity(), "0").data).toBe(0);
    expect(parse(optionalQuantity(), "25").data).toBe(25);
    expect(parse(optionalQuantity(), "").data).toBeNull();
    expect(parse(optionalQuantity(), "-1").success).toBe(false);
    expect(parse(optionalQuantity(), "2.5").success).toBe(false);
  });
});

describe("idList", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  it("accepts absent, single and repeated values and removes duplicates", () => {
    expect(parse(idList(), undefined).data).toEqual([]);
    expect(parse(idList(), id).data).toEqual([id]);
    expect(parse(idList(), [id, other, id]).data).toEqual([id, other]);
  });

  it("rejects values that are not ids", () => {
    expect(parse(idList(), ["nope"]).success).toBe(false);
  });
});

describe("formDataToObject", () => {
  it("returns strings for single keys and arrays for repeated keys", () => {
    const fd = new FormData();
    fd.append("name", "ABC");
    fd.append("brandIds", "a");
    fd.append("brandIds", "b");
    expect(formDataToObject(fd)).toEqual({ name: "ABC", brandIds: ["a", "b"] });
  });
});
