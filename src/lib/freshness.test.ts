import { describe, expect, it } from "vitest";
import { getFreshnessBand } from "./freshness";

const now = new Date("2026-09-20T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("getFreshnessBand", () => {
  it("is fresh under 24 hours", () => {
    expect(getFreshnessBand(hoursAgo(0), now)).toBe("fresh");
    expect(getFreshnessBand(hoursAgo(23.9), now)).toBe("fresh");
  });

  it("is recent from 24 hours to under 7 days", () => {
    expect(getFreshnessBand(hoursAgo(24), now)).toBe("recent");
    expect(getFreshnessBand(hoursAgo(24 * 7 - 1), now)).toBe("recent");
  });

  it("is aging from 7 to under 14 days", () => {
    expect(getFreshnessBand(hoursAgo(24 * 7), now)).toBe("aging");
    expect(getFreshnessBand(hoursAgo(24 * 14 - 1), now)).toBe("aging");
  });

  it("is stale from 14 days", () => {
    expect(getFreshnessBand(hoursAgo(24 * 14), now)).toBe("stale");
    expect(getFreshnessBand(hoursAgo(24 * 200), now)).toBe("stale");
  });

  it("treats a future timestamp as fresh rather than negative age", () => {
    expect(getFreshnessBand(new Date(now.getTime() + 60_000), now)).toBe("fresh");
  });
});
