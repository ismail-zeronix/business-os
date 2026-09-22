import { describe, expect, it } from "vitest";
import { escapeLike } from "./like";

describe("escapeLike", () => {
  it("escapes the LIKE wildcards and the escape character itself", () => {
    expect(escapeLike("50%")).toBe("50\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("back\\slash")).toBe("back\\\\slash");
  });

  it("leaves ordinary text unchanged", () => {
    expect(escapeLike("Dell Latitude 5440")).toBe("Dell Latitude 5440");
    expect(escapeLike("")).toBe("");
  });
});
