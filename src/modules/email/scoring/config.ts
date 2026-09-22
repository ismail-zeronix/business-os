/**
 * Enquiry scoring configuration: the ONE place to tune it (docs/plans/active/CURRENT.md section 12). Deterministic and readable: every
 * point comes from a named rule, and the rules that fired are stored with each email so a person can see why it scored as it did.
 * Weights and thresholds follow the master plan; tune them here after looking at real mail. Phrase lists are code for now (a
 * database-managed dictionary editor is deferred, see BACKLOG).
 */

export const SCORE_WEIGHTS = {
  /** The subject contains a strong RFQ phrase. */
  subjectRfq: 30,
  /** The new part of the body asks for a quote or supply. */
  intent: 15,
  /** The sender's address is a contact of a known customer. */
  knownCustomer: 15,
  /** A brand from the Brand master is mentioned. */
  knownBrand: 10,
  /** A category from the Category master is mentioned. */
  knownCategory: 10,
  /** A product specification (CPU, RAM, storage...) or a known product family is present. */
  specPattern: 10,
  /** A quantity is stated. */
  quantity: 5,
  /** An attachment filename looks like an RFQ / BOQ. */
  attachmentName: 10,
  marketing: -40,
  recruitment: -40,
  newsletter: -30,
  automatedSender: -30,
  /** The sender is a known supplier: probably a price list or broadcast, not a customer enquiry. */
  knownSupplier: -30,
} as const;

/** Score bands. 70 and above: likely enquiry. 40-69: needs a human look. Below 40: stored, hidden by default. */
export const BAND_THRESHOLDS = { likely: 70, review: 40 } as const;

const phrases = (list: string[]) => new RegExp(String.raw`\b(?:${list.join("|")})\b`, "i");

export const PHRASES = {
  rfqSubject: phrases([
    "request for quotation",
    "request for quote",
    "rfq",
    "quotation",
    "quotation request",
    "quote request",
    "quote for",
    "price request",
    "need quotation",
    "enquiry",
    "inquiry",
    "boq",
    "bill of quantities",
    "please quote",
    "kindly quote",
  ]),
  // Entries are regular-expression fragments, matched as whole phrases.
  intent: phrases([
    "(?:please|pls|kindly)(?: also)? (?:quote|send|share|provide|advise)",
    "quote (?:for|us|me)",
    "quotation for",
    "(?:send|share|provide)(?: us| me)?(?: a| your)? (?:quote|quotation|price|prices|offer)",
    "we (?:require|need)",
    "we are looking for",
    "looking for",
    "requirement",
    "supply of",
    "urgently need",
    "(?:your )?best price",
  ]),
  marketing: phrases(["limited time offer", "click here", "\\d+% off", "special offer", "winner", "act now", "exclusive deal", "free trial"]),
  recruitment: phrases(["resume", "curriculum vitae", "cv", "vacancy", "job opening", "hiring", "job application", "candidate"]),
  newsletter: phrases(["unsubscribe", "view in browser", "newsletter", "webinar", "manage your preferences"]),
  attachmentName: /(?:rfq|boq|bom|quotation|enquiry|inquiry|requirement|tender)/i,
  automatedSender: /(?:no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce)/i,
} as const;
