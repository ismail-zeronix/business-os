import { describe, expect, it } from "vitest";
import { htmlToText, stripQuotedForScoring } from "./text";

describe("htmlToText", () => {
  it("drops scripts, styles, heads and comments completely", () => {
    const html = "<head><title>T</title></head><style>p{color:red}</style><script>alert('x')</script><!-- hidden --><p>Visible</p>";
    expect(htmlToText(html)).toBe("Visible");
  });
  it("turns blocks and breaks into lines, and list items into dashes", () => {
    expect(htmlToText("<p>One</p><p>Two<br>Three</p>")).toBe("One\n\nTwo\nThree"); // paragraphs are a blank line apart, a <br> is one line
    expect(htmlToText("<ul><li>A</li><li>B</li></ul>").split("\n").filter(Boolean)).toEqual(["- A", "- B"]); // items are separated by a blank line
  });
  it("turns table cells into tabs", () => {
    const text = htmlToText("<table><tr><td>Model</td><td>Qty</td></tr><tr><td>P14s</td><td>5</td></tr></table>");
    expect(text).toContain("Model\tQty");
    expect(text).toContain("P14s\t5");
    expect(text.indexOf("Model")).toBeLessThan(text.indexOf("P14s"));
  });
  it("decodes named and numeric entities, and leaves unknown ones alone", () => {
    expect(htmlToText("Tom &amp; Jerry &lt;3 &#65;&#x42; &nbsp;x &unknown; &#0; &#1114112;")).toBe("Tom & Jerry <3 AB x &unknown; &#0; &#1114112;");
  });
  it("collapses runs of spaces and blank lines", () => {
    expect(htmlToText("<p>a   b</p>\n\n\n\n<p>c</p>")).toBe("a b\n\nc");
  });
  it("only ever produces text: tags with attributes are removed, not interpreted", () => {
    expect(htmlToText('<a href="javascript:alert(1)" onclick="x()">link</a><img src=x onerror=alert(1)>')).toBe("link");
  });
  it("handles empty and plain text input", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText("just text")).toBe("just text");
  });
});

describe("stripQuotedForScoring", () => {
  it("keeps everything when nothing is quoted", () => {
    expect(stripQuotedForScoring("Please quote 5 laptops.\nThanks")).toBe("Please quote 5 laptops.\nThanks");
  });
  it("cuts a quoted earlier message, so it cannot raise the score", () => {
    const text = "Please quote 5 laptops.\n\nOn Mon, 21 Sep 2026 at 10:00, Sales <sales@example.test> wrote:\n> price list attached\n> supply of monitors";
    const kept = stripQuotedForScoring(text);
    expect(kept).toContain("Please quote 5 laptops.");
    expect(kept).not.toContain("price list attached");
  });
});
