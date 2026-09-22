/**
 * An amount written in words, as printed on a quotation: "Five Thousand Six Hundred and Forty-Eight UAE Dirhams and Eighty-Eight Fils Only".
 * Pure, no I/O. English, British style ("and" after the hundreds). Works in whole minor units, so nothing drifts.
 */

const ONES = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

/** 1 to 999 in words. `andAfterHundreds` adds "and" between the hundreds and the rest ("One Hundred and Five"). */
function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest > 0) {
    const restWords = rest < 20 ? ONES[rest]! : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ""}`;
    parts.push(hundreds > 0 ? `and ${restWords}` : restWords);
  }
  return parts.join(" ");
}

/** A whole number from 0 to 999,999,999,999,999 in words. */
export function integerInWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999_999_999) throw new RangeError("Amount out of range");
  if (n === 0) return "Zero";
  const groups: string[] = [];
  let remaining = n;
  for (let scale = 0; remaining > 0; scale += 1) {
    const chunk = remaining % 1000;
    if (chunk > 0) groups.unshift(`${belowThousand(chunk)}${SCALES[scale] ? ` ${SCALES[scale]}` : ""}`);
    remaining = Math.floor(remaining / 1000);
  }
  // "One Thousand Five" reads as "One Thousand and Five": a last group under a hundred gets an "and" when something larger comes before it.
  const last = n % 1000;
  const words = groups.join(" ");
  return groups.length > 1 && last > 0 && last < 100 ? words.replace(/ ([^ ]+(?:-[^ ]+)?)$/, " and $1").replace(/ and and /, " and ") : words;
}

const CURRENCY_NAMES: Record<string, { major: string; minor: string }> = {
  AED: { major: "UAE Dirhams", minor: "Fils" },
  USD: { major: "US Dollars", minor: "Cents" },
  EUR: { major: "Euros", minor: "Cents" },
  GBP: { major: "Pounds Sterling", minor: "Pence" },
  SAR: { major: "Saudi Riyals", minor: "Halalas" },
  INR: { major: "Indian Rupees", minor: "Paise" },
  CNY: { major: "Chinese Yuan", minor: "Fen" },
};

/** "5644.88" and "AED" -> "Five Thousand Six Hundred and Forty-Eight UAE Dirhams and Eighty-Eight Fils Only". An unknown currency uses its code. */
export function amountInWords(amount: string, currencyCode: string): string {
  const cents = Math.round(Number(amount) * 100);
  const whole = Math.floor(cents / 100);
  const minorUnits = cents % 100;
  const names = CURRENCY_NAMES[currencyCode] ?? { major: currencyCode, minor: "" };
  const major = `${integerInWords(whole)} ${names.major}`;
  const minor = minorUnits > 0 ? ` and ${integerInWords(minorUnits)}${names.minor ? ` ${names.minor}` : ""}` : "";
  return `${major}${minor} Only`;
}
