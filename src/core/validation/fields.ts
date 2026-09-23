import { z } from "zod";

/**
 * Reusable zod field builders for forms and services. Rules they enforce:
 *  - strings are trimmed; an empty string means "not provided" and becomes null (unknown stays unknown, never "")
 *  - optional fields are never required just to complete a form
 */

const blankToNull = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/** Required, trimmed, non-empty text. */
export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

/** Optional text: blank or missing becomes null. */
export const optionalText = (max = 500) =>
  z
    .preprocess(blankToNull, z.string().max(max, `Must be at most ${max} characters`).nullable().optional())
    .transform((value) => value ?? null);

/** Optional email address; validated only when supplied. */
export const optionalEmail = () =>
  z
    .preprocess(blankToNull, z.email("Enter a valid email address").max(254).nullable().optional())
    .transform((value) => value ?? null);

/**
 * Optional website. A bare domain ("abc.ae") is accepted and stored as https://abc.ae. Only http(s) is allowed:
 * a "javascript:" or other scheme would be a stored-XSS risk wherever the URL is rendered as a link.
 */
export const optionalUrl = () =>
  z
    .preprocess((value) => {
      const cleaned = blankToNull(value);
      if (typeof cleaned !== "string") return cleaned;
      return /^[a-z][a-z0-9+.-]*:/i.test(cleaned) ? cleaned : `https://${cleaned}`;
    }, z.url("Enter a valid website address").max(500).refine((url) => /^https?:\/\//i.test(url), "Website must start with http:// or https://").nullable().optional())
    .transform((value) => value ?? null);

/** Optional value from a fixed list (an enum). Blank means unknown. */
export const optionalEnum = <const T extends readonly [string, ...string[]]>(values: T, label = "Value") =>
  z
    .preprocess(blankToNull, z.enum(values, { error: `Choose a valid ${label.toLowerCase()}` }).nullable().optional())
    .transform((value) => value ?? null);

/** Required value from a fixed list. */
export const requiredEnum = <const T extends readonly [string, ...string[]]>(values: T, label = "Value") =>
  z.enum(values, { error: `Choose a valid ${label.toLowerCase()}` });

/** A list of ids from repeated form fields. Absent => empty. A single value is accepted as a one-item list. Duplicates are removed. */
export const idList = () =>
  z
    .preprocess(
      (value) => (value == null || value === "" ? [] : Array.isArray(value) ? value : [value]),
      z.array(z.uuid("Invalid selection")).default([]),
    )
    .transform((ids) => [...new Set(ids)]);

/**
 * A list of raw strings from repeated form fields, always an array even for a single row (HTML form submission collapses a
 * single repeated field to one value, same as `idList` handles for uuids). Used by the bulk review table, where every column
 * is submitted as one repeated field, one entry per table row, all arrays the same length.
 */
export const stringArray = () => z.preprocess((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]), z.array(z.string()));

/** Optional reference to another record by id (e.g. a brand). Blank means "not set". */
export const optionalUuid = (message = "Invalid selection") =>
  z
    .preprocess(blankToNull, z.uuid(message).nullable().optional())
    .transform((value) => value ?? null);

/** HTML checkbox: present ("on") means true, absent means false. */
export const checkbox = () => z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());

/** Optional non-negative whole number (quantities). Blank => null. */
export const optionalQuantity = () =>
  z
    .preprocess(blankToNull, z.coerce.number({ error: "Enter a whole number" }).int("Enter a whole number").min(0, "Cannot be negative").nullable().optional())
    .transform((value) => value ?? null);

/** Optional positive whole number (e.g. warranty months). Blank => null. Zero and negative are rejected. */
export const optionalPositiveInt = (label: string, max = 999) =>
  z
    .preprocess(blankToNull, z.coerce.number({ error: `Enter a whole number` }).int(`Enter a whole number`).min(1, `${label} must be at least 1`).max(max, `${label} is too large`).nullable().optional())
    .transform((value) => value ?? null);

/** ISO currency code from an allow-list (extend deliberately). */
export const SUPPORTED_CURRENCIES = ["AED", "USD", "EUR", "GBP", "SAR", "INR", "CNY"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

/** Optional money amount as a decimal string ("2450" or "2,450.50"), at most 2 decimals, never negative. Blank => null (price unknown). */
export const optionalMoney = () =>
  z
    .preprocess((value) => {
      const cleaned = blankToNull(value);
      return typeof cleaned === "string" ? cleaned.replace(/,/g, "") : cleaned;
    }, z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Enter an amount such as 2450 or 2450.50").nullable().optional())
    .transform((value) => value ?? null);

/** Enum whose blank/missing value means a named "unknown" member rather than null. */
export const enumOrUnknown = <const T extends readonly [string, ...string[]]>(values: T, unknown: T[number], label = "Value") =>
  z
    .preprocess(blankToNull, z.enum(values, { error: `Choose a valid ${label.toLowerCase()}` }).nullable().optional())
    .transform((value) => (value ?? unknown) as T[number]);
