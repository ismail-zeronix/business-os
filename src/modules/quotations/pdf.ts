import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { InvariantError } from "../../core/errors";
import { signRenderToken } from "../../core/security/render-token";

/**
 * Turns the customer's copy of a quotation into a real PDF file (bytes), for the Download PDF button and the email attachment.
 * A headless Chrome or Edge that is already installed opens the same print page a person sees, so the PDF is exactly the screen version and
 * there is only one layout to maintain. Nothing is downloaded: the browser is found on this machine (or named in PDF_BROWSER_PATH).
 * The page is opened by this server on its own address with a short-lived signed token, never through a person's session.
 */

const CANDIDATES = [
  process.env.PDF_BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

/** The first Chrome, Chromium or Edge found, or null. */
export function findPdfBrowser(): string | null {
  return CANDIDATES.find((path): path is string => Boolean(path) && existsSync(path as string)) ?? null;
}

/** Where this server can reach itself. Never taken from the request's Host header, so a forged header cannot send the signed token elsewhere. */
export function internalBaseUrl(): string {
  return (process.env.APP_INTERNAL_URL?.trim() || `http://127.0.0.1:${process.env.PORT || 3000}`).replace(/\/$/, "");
}

/** "Quotation-QUO-20260921-0001.pdf" (with "-rev-2" from the second revision), from the label "QUO-20260921-0001 rev 2". */
export const pdfFileName = (label: string): string => `Quotation-${label.replace(/\s+rev\s+/i, "-rev-")}.pdf`;

export async function renderQuotationPdf(quotationId: string): Promise<Buffer> {
  const executablePath = findPdfBrowser();
  if (!executablePath) throw new InvariantError("No Chrome or Edge was found to make the PDF. Install one, or set PDF_BROWSER_PATH in .env to its full path.");

  const url = `${internalBaseUrl()}/quotations/${quotationId}/print?render=${encodeURIComponent(signRenderToken(quotationId))}`;
  const browser = await chromium.launch({ executablePath, headless: true, timeout: 30_000 });
  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    if (!response || !response.ok()) throw new InvariantError("The quotation page could not be opened to make the PDF. Check that the application is running and try again.");
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
