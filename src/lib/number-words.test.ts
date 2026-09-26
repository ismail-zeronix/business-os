import { describe, expect, it } from "vitest";
import { amountInWords, integerInWords } from "./number-words";

describe("integerInWords", () => {
  it.each([
    [0, "Zero"],
    [7, "Seven"],
    [13, "Thirteen"],
    [21, "Twenty-One"],
    [100, "One Hundred"],
    [105, "One Hundred and Five"],
    [999, "Nine Hundred and Ninety-Nine"],
    [1000, "One Thousand"],
    [1005, "One Thousand and Five"],
    [1100, "One Thousand One Hundred"],
    [21_015, "Twenty-One Thousand and Fifteen"],
    [1_000_000, "One Million"],
    [2_500_000, "Two Million Five Hundred Thousand"],
  ])("%i", (n, words) => expect(integerInWords(n)).toBe(words));

  it("refuses a fraction, a negative or a number that is too large", () => {
    expect(() => integerInWords(1.5)).toThrow(RangeError);
    expect(() => integerInWords(-1)).toThrow(RangeError);
    expect(() => integerInWords(1e15)).toThrow(RangeError);
  });
});

describe("amountInWords", () => {
  it("writes dirhams and fils", () => {
    expect(amountInWords("5648.88", "AED")).toBe("Five Thousand Six Hundred and Forty-Eight UAE Dirhams and Eighty-Eight Fils Only");
  });
  it("leaves out the minor unit when there is none", () => {
    expect(amountInWords("7200.00", "AED")).toBe("Seven Thousand Two Hundred UAE Dirhams Only");
  });
  it("uses cents for dollars and the code for an unknown currency", () => {
    expect(amountInWords("1.05", "USD")).toBe("One US Dollars and Five Cents Only");
    expect(amountInWords("2.00", "XYZ")).toBe("Two XYZ Only");
  });
  it("writes zero", () => {
    expect(amountInWords("0.00", "AED")).toBe("Zero UAE Dirhams Only");
  });
});
