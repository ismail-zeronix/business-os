# Current Development Plan

## Project

**Zeronix Intelligence**

## Active Milestone

**Stabilization** (before any production use). The main modules are built. The previous milestone (Customer Quotation, email quotations, broadcast bulk confirm and review table, AI enquiry intake chat) is archived in `docs/plans/completed/2026-09-26-quotations-email-and-ai-enquiry-chat.md`; its rules and its "not verified" lists stay in force. The full test checklist is `docs/plans/STABILIZATION.md`.

**Knowledge screen (2026-09-27, not part of the stabilization steps):** a read-only Knowledge screen (`/knowledge`, all signed-in users) shows the markdown files in `knowledge/` (company, services, sales team, procurement, AI instructions). The pages are a skeleton to be filled with real business facts from the owner; see `docs/decisions/0009-knowledge-base-files.md`. The AI module stays paused.

**Right dock and contact notes (2026-09-27, not part of the stabilization steps):** a slim icon rail on the right edge of every signed-in screen opens tool panels. The first tool is **Supplier contacts**: paste rough contact text, save it as a free-floating note (not linked to a supplier) with name, company, phones and emails read from the text by rules and confirmed by the person, plus a typed description; search, edit, remove (archive). Built as a registry so later tools are one entry each. Module doc: `docs/modules/CONTACT_NOTES.md`. Verified so far: typecheck, lint, and the service against the project database; the screen itself still needs a signed-in browser check.

**Structured requirements and specification matching (2026-09-27, approved scope change, on branch `feature/enquiry-requirements`):** upgrades how enquiry requirements are represented and how products are matched, underneath the unchanged workflow (enquiry -> evidence -> parser -> item -> matching -> review -> sourcing -> decision -> quotation). Plan in phases, each shippable:
1. **Structured enquiry requirements** (built, see Status below): `enquiry_requirements`, pure spec normalizers in `src/modules/specs`, extraction on create, human edit with retraction, chips in the item row. No matching change.
2. **Product attributes** (built, see Status below): `product_attributes`, `products.model_key` (Gen 7 = G7), extraction from product data on create, dry-run backfill script (writing to existing products needs the owner's go-ahead), category set on auto-created products. Human correction of product attributes (edit UI) comes with phase 3.
3. **Compare and explain, shadow mode** (built, see Status below): structured candidate search, per-requirement verdicts (EXACT, COMPATIBLE, UPGRADE, PARTIAL, MISMATCH, UNKNOWN), ranking and explanation in the candidate list. Auto-link unchanged.
4. **Auto-link gating** (built, see Status below): `pickAutoLink` redefined so conflicts and unknown must-have specifications force human review.
5. Broadcast side uses the same attributes so model-only lines no longer collapse two configurations into one product.
6. Other categories (server, switch) and AI-proposed requirements.
Parked, not in this scope: supplier ranking, stock-status inference, `match_feedback`. `product_variants` is deliberately not added: `Product` acts as the sellable variant.

## Steps, in order

1. **Browser verification pass (no new features).** Clear the "not verified in a browser" items by hand on the project database, with `TEST` data:
   - Enquiry-made quotation: create, issue while incomplete, revise, superseded view.
   - Outgoing email tab, compose drawer, Emails sent section.
   - Customer note and call logging on the Activity tab.
   - AI chat panel: chat a `TEST` request through to Create enquiry draft, open the enquiry.
   Fix what breaks; record results here and in `STABILIZATION.md`.
2. **Security items before real exposure.** HTTPS and the `Secure` cookie, the `/setup` window on a fresh deployment, CSRF behind a proxy, and the decision on the re-recorded checksum of migration `20260923004256_broadcast_category_warranty`.
3. **Automated tests** (explicitly started by the user's approval of this plan), in this order: Vitest on pure logic (quotation pricing, parsers, `secret-box`, render token, password helpers); database-constraint checks for the guard triggers; service integration tests; Playwright for critical journeys only.
4. **Performance and production readiness.** Search query plans, backups, logging, final review.

## Status

**Step 1 run 2026-09-26** (Chrome via Playwright, project database, temporary user `TEST Verify Admin`, `test.verify@example.test`; deactivate it when done).

Verified in a browser:
- Enquiry-made quotation (QUO-20260923-0001): Revise created rev 2 as a draft; a price edit followed to the total and survived a reload; Issue refused a line with no quantity with a plain message; Issue then froze it; rev 1 shows "Replaced by a newer revision" and is unchanged; the print page has no supplier, cost, markup or margin; `/pdf` returns a real PDF.
- Outgoing tab shows the account, signature box and Send test email. The compose drawer opens with From, To, subject, message, signature and the PDF attached; an invalid Cc is refused inline and a valid one becomes a chip. Not sent (nothing outward was sent).
- Customer Activity: a `TEST` note and a `TEST` call were logged and show at the top of the timeline with the right labels, author and time.

**Not verified: AI chat panel.** The panel opens and shows the provider failure as a plain message, but Gemini (`gemini-3.8-flash`) answered with a server error (`UNAVAILABLE`) on every try in this session, so a chat through to Create enquiry draft could not be run. Retry when the provider is up.

Also verified: **Send email** from the drawer (26 Sep 2026, 06:01, to ismail@zeronix.ae). The `sent_emails` row is SENT with a Message-ID and the 118 KB PDF, and the quotation shows it under Emails sent. Also verified: **Send test email** from Settings > Email accounts > Outgoing (to ismail@zeronix.ae; the row shows "Sent just now"). **Narrow screen (390 px):** quotations list, quotation page, enquiries and customer page have no sideways page scroll; the compose drawer fits. **Fixed:** the top bar had a fixed height and pushed page buttons (Download PDF, Send by email, Revise) off the right edge on a phone; it now wraps (`components/application/topbar.tsx`), desktop unchanged. Minor, not fixed: on a phone the breadcrumb "Quotations" and the reference overlap slightly. Not yet done: a quotation with a confirmation line on a narrow screen, hundreds of suppliers in the confirmation drawer.

Left behind: rev 2 of QUO-20260923-0001 (issued), a `TEST` note and call on the customer IBRAHIM MOHAMMAD, five failed `CAPTURE_ENQUIRY` executions.

Observation: in `next dev` the Next.js dev badge sits over the assistant button (bottom-right) and blocks clicks; production builds do not show it.

## Step 2 findings (2026-09-26, read from code, not run)

- **Secure cookie:** set when `NODE_ENV=production` (`src/core/auth/session.ts`), so production must be served over HTTPS or sign-in will not stick.
- **CSRF on server actions:** Next compares `Origin` with `Host` / `X-Forwarded-Host`. Behind a proxy, forward `X-Forwarded-Host` or set `serverActions.allowedOrigins` in `next.config.ts` (not set today).
- **/setup window:** closed on this database (an admin with a password exists). On a fresh deployment it is open to anyone who reaches the URL first; complete it immediately, or add a one-time setup token (not built).
- **Migration checksum:** `20260923004256_broadcast_category_warranty` was edited after it was applied. `prisma migrate diff` shows the live schema matches `schema.prisma` exactly, so only the recorded checksum is stale (DB `fc63ce12...`, file `1d71deb1...`). Fix = a one-row update of `_prisma_migrations.checksum`. Not applied: the change was blocked as a shared-resource edit and needs the owner's go-ahead. A fresh database applies the file as it is and is not affected.

### Step 2 built (2026-09-26)

- **Setup code:** optional `SETUP_TOKEN` in `.env`. When set, `/setup` asks for it and `setupFirstAdmin` refuses a missing or wrong code (constant-time compare, field error, nothing changed). Unset = unchanged behaviour. `core/auth/setup-token.ts`, tests in `setup-token.test.ts` and `auth.service.test.ts`. Not seen in a browser: /setup is closed on this database.
- **Server actions behind a proxy:** optional `APP_ALLOWED_ORIGINS` (comma-separated hosts) feeds `serverActions.allowedOrigins` in `next.config.ts`; needed only when the proxy does not forward `X-Forwarded-Host`. Not run against a real proxy.
- **Still the owner's to do at deploy:** serve over HTTPS (the session cookie is `Secure` in production), set `SETUP_TOKEN`, and complete `/setup` first. The migration checksum update is still pending the owner's go-ahead.

## Step 3 progress (2026-09-26)

Started with the user's approval. Typecheck, ESLint clean; `vitest run` 441 tests pass (was 142).

Added, all on pure logic or the `*_test` database (the existing test harness):
- `quotations/pricing.test.ts`, `lib/number-words.test.ts`, `quotations/email.test.ts` (money maths, amount in words, email body and signature).
- `core/security/render-token.test.ts`, `core/security/secret-box.test.ts`, `core/auth/auth-helpers.test.ts` (token, encryption, password hashing, `safeNextPath`, session helpers).
- `email/error-text.test.ts` (`describeSmtpError`, `describeImapError`: fixed text, never the raw error), `broadcasts/readiness.test.ts`.
- `broadcasts/parsing/rules-parser.test.ts`, `enquiries/parsing/enquiry-parser.test.ts` (real broadcast and enquiry line formats, no supplier or customer details).
- `core/database/guards.test.ts`: `guard_quotation`, `guard_quotation_line`, `guard_sent_email`, `guard_last_admin`, the quotation, line, sent-email and SMTP CHECKs, the one-active-account index, unique session token. Prisma reports a trigger refusal as a generic foreign-key error (P2003); the test helper reads the database's own message from `meta.driverAdapterError`.

Second slice (same day), service integration tests on the `*_test` database:
- `quotations/service.test.ts` (29): manual and enquiry-made quotations, typed and confirmation lines, markup and price following each other, currency change, issue lists every problem, revise (rev 2 and 3, original untouched), one draft per enquiry, archived enquiry blocks everything. It found one small defect, fixed in `service.ts`: saving a line with unchanged values wrote an audit row ("100" to "100.00"); stored decimals are now compared as two-decimal text.
- `quotations/email.service.test.ts` (17): send an issued quotation with the SMTP server and headless Chrome stubbed (no real mail): the exact PDF and its hash are stored, failure stored with a plain reason, only ISSUED sends, needs an active account and the key, customer Activity scope; the outgoing account service (admin only, password encrypted and never in audit, one active account, copy-login without decrypting, test-send result), own signature.
- `users/auth.service.test.ts` (23): sign-in (hash-only session token, identical message for every failure, lockout after 5 and its release), first-admin setup (takes over the first user, refuses a second run, two simultaneous runs give one winner), change own password (other sessions end), user management (admin only, last admin, self-protection, deactivate ends sessions, admin reset).
- `sourcing/sourcing.test.ts` (26): request state machine, reply linking rules, write-once and reply-supplier guards, choose and clear a supplier (one active choice, replaced choice retracted, another supplier's or product's or retracted price refused), and a quotation costing from the choice (refresh follows a new choice, cleared choice, another currency).

Third slice: pure-logic tests for `buildRequestMessage` / `describeLine` / `composeSentText`, `htmlToText` / `stripQuotedForScoring`, `scoreEmail`, and the quotation reference and Asia/Dubai date helpers (midnight and year boundaries).

Still to do in Step 3: guard and service tests for the enquiry and email-sync tables (`ingestMessage`, `syncAccount`, triage, enquiry item confirm rules, `createEnquiry` from email), `normalizeEmail`; and Playwright, which needs `@playwright/test` (a new dev dependency, so it needs a go-ahead) and a sign-in for the browser. `docs/plans/STABILIZATION.md` lists each. The 2026-09-26 manual browser pass (above) covers the same journeys by hand.

## Structured requirements, phase 1 status (2026-09-27)

Built and verified on the project database with a `TEST` enquiry (ENQ-00004, archived): 12 requirements proposed for two lines (CPU, RAM, storage, type, screen, keyboard, resolution, OS read correctly from the E14 and Latitude wording); a human edit retracted the parsed row and wrote a `HUMAN` row (both kept); "Read again" left human rows alone; a duplicate, an unreadable CPU, a bad range and a wrong operator were refused with plain messages; the database refused an UPDATE of a value, a DELETE, and a BETWEEN with no upper value; four audit rows and `requirements: 12` on `enquiry.created`. Typecheck and ESLint clean; migration `20260927100000_enquiry_requirements` applied with `migrate deploy` (additive).

**Not verified in a browser** (sign-in is required and no bypass was used): the chips, the Add and Edit popovers, and the read-only view on a reviewed item. Known limits of the reader: an unit-less capacity ("512 NVMe") is read as GB with MEDIUM confidence; "FHD+" is not read as FHD; Wi-Fi, GPU, panel and touch are not extracted yet; a requirement written only in an attachment is not seen.

## Structured requirements, phase 2 status (2026-09-27)

Built: migration `20260927140000_product_attributes` (applied, additive), `product_attributes` and `products.model_key`, `canonicalModelKey`, product-attribute extraction on `createProduct`, `model_key` kept current on update, category resolved on auto-created products, a read-only "Specifications" panel on the product page, and `npm run specs:backfill`. Typecheck and ESLint clean. Verified with a `TEST` product: key `E14G7`, six attributes read, the key follows an edit of the model, and the database refused an attribute update, a delete and a row with two values.

**Backfill dry run on the project database (nothing written):** 139 products; 123 would get a model key, 131 would gain attributes (619 values: cpu 85, os 86, ram 115, resolution 39, screen 92, storage 116, storage type 86), 27 would get a category (112 have no category text on any of their lines, so they stay unknown). **Applied on 2026-09-27 with the owner's go-ahead** (`--apply`, then `--apply-categories`): 123 model keys, 619 attribute values, 27 categories; a re-run finds nothing left to write.

Known limits: the model key still differs when the model text includes the family word; a platform code such as "LNL" stays in the key; the product-attribute edit UI is not built; the product page panel was not seen in a browser (sign-in required).

## Structured requirements, phases 3-4 implementation plan (2026-09-29, built — see status below)

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add spec-aware candidate ranking/explanation to the enquiry product picker (phase 3, display-only, auto-link unchanged), then use the same comparison to stop auto-link from picking a product that conflicts with or leaves unknown a MUST-have requirement (phase 4).

**Architecture:** One new pure module (`src/modules/specs/verdict.ts`) compares a requirement (operator + importance) against a product attribute (a fact) and returns a graded verdict (EXACT/COMPATIBLE/UPGRADE/PARTIAL/MISMATCH/UNKNOWN). A batched loader reads a set of candidate products' active attributes in one query. Phase 3 wires the verdict into the existing candidate picker (`EnquiryProductLinker`) purely for display and ranking. Phase 4 adds `pickAutoLinkWithSpecs`, a thin wrapper around the existing `pickAutoLink` that vetoes its pick when a MUST requirement comes back MISMATCH or UNKNOWN, and swaps it in at the two enquiry-side call sites. No schema or migration changes: everything reads the `enquiry_requirements` and `product_attributes` tables added in phases 1-2.

**Tech Stack:** Next.js server components/actions, Prisma 7.10, PostgreSQL, TypeScript 5.9 — matches the rest of the module, no new dependency.

**Spec:** This section (phases 3 and 4 of the plan paragraph above, this file lines 15-22). The two phases' full scope text, verbatim: phase 3 — "Compare and explain (shadow mode): structured candidate search, per-requirement verdicts (EXACT, COMPATIBLE, UPGRADE, PARTIAL, MISMATCH, UNKNOWN), ranking and explanation in the candidate list. Auto-link unchanged." Phase 4 — "Auto-link gating: `pickAutoLink` redefined so conflicts and unknown must-have specifications force human review." Neither phase has a separate acceptance-criteria appendix anywhere in the docs; the verdict taxonomy, gating precedence and ranking algorithm below are originated by this plan (confirmed via `docs/architecture/DATA_MODEL.md`, `docs/modules/ENQUIRIES.md`, `docs/modules/PRODUCTS.md`, `docs/ideas/BACKLOG.md` and `docs/decisions/*` — none define them).

## Global Constraints

- **No automated tests this phase** (CLAUDE.md, development-first rule): do not write Vitest/unit tests for this work. Each task below substitutes the skill's usual "write a failing test" steps with the project's own established verification pattern from the phase 1/2 status sections above: a `TEST`-labelled record or a rolled-back transaction against the **project database** (`127.0.0.1:5442`), with exact reported counts/values, plus `tsc`/`eslint` clean as a baseline. Do not create a separate test/scratch database.
- Keep TypeScript and ESLint clean (`npx tsc --noEmit`, `npx eslint <files>`) after every task — this is not optional even though tests are deferred.
- **No schema or migration changes** in this plan: every read is against `enquiry_requirements` and `product_attributes`, both already migrated (phases 1-2). If a task seems to need a new column, stop and flag it rather than writing a migration.
- **Deterministic rules only** (CLAUDE.md): no LLM/AI call anywhere in this comparison. Phase 6 ("AI-proposed requirements") is explicitly later scope.
- **Unknown stays unknown**: a product with no row for an attribute is UNKNOWN, never assumed equal or assumed absent-therefore-fine.
- Timestamps/currency/locale conventions are irrelevant to this plan (no dates or money involved).
- Prisma pinned at 7.10, TypeScript at 5.9 — use existing patterns only, no new packages.
- Broadcasts are **out of scope**: `src/modules/broadcasts/*` has no structured customer-requirement model to compare against and must not be touched by this plan.

## Review Focus

- A candidate product with zero `product_attributes` rows (never backfilled, or created after the phase-2 backfill ran) must show UNKNOWN for every requirement, never crash, and must block auto-link when the item has a MUST requirement pointed at that key — covered in Task 4's verification.
- A BETWEEN requirement (e.g. `screen_in`) whose candidate value sits just outside the exact range but inside the near-miss band must read COMPATIBLE, not silently EXACT and not overly harsh MISMATCH — covered in Task 1's verification.
- A TEXT EQUALS requirement (cpu/os) where the candidate's value is a *broader* family than what was asked (e.g. requirement wants `windows-11-pro`, product only states `windows-11`) must read PARTIAL, not COMPATIBLE — the direction of the prefix match matters and is easy to get backwards. Covered in Task 1's verification.
- An item with zero active requirements (parser found nothing, or a non-laptop category) must make `pickAutoLinkWithSpecs` behave byte-for-byte like the old `pickAutoLink` — no accidental blocking of every plain enquiry. Covered in Task 4's verification.
- When `pickAutoLink` itself already returns `null` (ambiguous text match, unrelated to specs), `pickAutoLinkWithSpecs` must short-circuit before touching the database at all — no wasted `product_attributes` query, no null-pointer access on a missing candidate. Covered in Task 4's verification.

---

### Task 1: Spec verdict engine

**Files:**
- Create: `src/modules/specs/verdict.ts`
- Modify: none

**Interfaces:**
- Consumes: `RequirementOperator`, `RequirementImportance` from `./types` (existing, unchanged).
- Produces (consumed by Tasks 2-4): `SpecVerdict`, `RequirementInput`, `AttributeInput`, `RequirementVerdict`, `PersistedRequirement`, `verdictForRequirement(requirement: RequirementInput, attribute: AttributeInput | null): SpecVerdict`, `compareRequirementsToProduct(requirements: readonly RequirementInput[], attributes: readonly AttributeInput[]): RequirementVerdict[]`, `overallVerdict(perRequirement: readonly { importance: RequirementImportance; verdict: SpecVerdict }[]): SpecVerdict`, `toRequirementInput(r: PersistedRequirement): RequirementInput`, `SPEC_VERDICT_SEVERITY: Record<SpecVerdict, number>`.

- [ ] **Step 1: Write `src/modules/specs/verdict.ts`**

```ts
import type { Prisma } from "../../generated/prisma/client";
import type { RequirementImportance, RequirementOperator } from "./types";

/**
 * How well a product's own specification (`product_attributes`: what it IS, no operator or importance) satisfies one customer
 * requirement (`enquiry_requirements`: what they asked for, with an operator and MUST/SHOULD/NICE). The counterpart of
 * `compare.ts`'s `compareAttributes` (which only checks whether two flat attribute sets agree, with no operator or direction) —
 * this module is operator-aware and direction-aware, so "at least 16GB, product has 32GB" reads UPGRADE, not just "agree".
 *
 * EXACT = satisfies the requirement precisely. UPGRADE = satisfies it and exceeds it (more RAM/storage than asked, a lower
 * price/weight ceiling than the maximum asked). COMPATIBLE = satisfies it via a looser match (a more specific CPU/OS edition
 * than asked, or a BETWEEN value just outside the stated range). PARTIAL = satisfies some but not all of a multi-value
 * requirement (some but not all requested keyboard languages), or the product is a broader family than the specific thing
 * asked for. MISMATCH = contradicts the requirement. UNKNOWN = the product has no value on record for that attribute.
 */

export type SpecVerdict = "EXACT" | "COMPATIBLE" | "UPGRADE" | "PARTIAL" | "MISMATCH" | "UNKNOWN";

/** Best to worst, used both to rank candidates and to decide the worst verdict among a set (e.g. every MUST requirement). */
export const SPEC_VERDICT_SEVERITY: Record<SpecVerdict, number> = {
  UPGRADE: 5,
  EXACT: 4,
  COMPATIBLE: 3,
  PARTIAL: 2,
  UNKNOWN: 1,
  MISMATCH: 0,
};

/** One `enquiry_requirements` row's comparable shape (Decimal fields already converted to plain numbers by the caller). */
export type RequirementInput = {
  attributeKey: string;
  operator: RequirementOperator;
  importance: RequirementImportance;
  valueText: string | null;
  valueNum: number | null;
  valueNumMax: number | null;
  valueList: string[] | null;
};

/** One `product_attributes` row's comparable shape. */
export type AttributeInput = { attributeKey: string; valueText: string | null; valueNum: number | null; valueList: string[] };

export type RequirementVerdict = { attributeKey: string; importance: RequirementImportance; verdict: SpecVerdict };

/** The raw Prisma shape of an active `EnquiryRequirement` row (valueNum/valueNumMax as Decimal), for `toRequirementInput`. */
export type PersistedRequirement = {
  attributeKey: string;
  operator: RequirementOperator;
  importance: RequirementImportance;
  valueText: string | null;
  valueNum: Prisma.Decimal | null;
  valueNumMax: Prisma.Decimal | null;
  valueList: string[];
};

export function toRequirementInput(r: PersistedRequirement): RequirementInput {
  return {
    attributeKey: r.attributeKey,
    operator: r.operator,
    importance: r.importance,
    valueText: r.valueText,
    valueNum: r.valueNum === null ? null : Number(r.valueNum),
    valueNumMax: r.valueNumMax === null ? null : Number(r.valueNumMax),
    valueList: r.valueList,
  };
}

/** Numeric equality tolerance, matching `compare.ts`'s existing epsilon for the same reason (rounding in stored decimals). */
const NUMBER_TOLERANCE = 0.5;

/** Attributes where a shorter value is a less specific form of a longer one — same constant/logic as `compare.ts`. */
const PREFIX_KEYS = new Set(["cpu", "os"]);

type TextRelation = "equal" | "attribute-more-specific" | "attribute-broader" | "different";

function textRelation(requirementValue: string, attributeValue: string): TextRelation {
  if (requirementValue === attributeValue) return "equal";
  if (attributeValue.startsWith(`${requirementValue}/`) || attributeValue.startsWith(`${requirementValue}-`)) return "attribute-more-specific";
  if (requirementValue.startsWith(`${attributeValue}/`) || requirementValue.startsWith(`${attributeValue}-`)) return "attribute-broader";
  return "different";
}

/** One requirement against one candidate's attribute (or `null` when the product has no value for that key: always UNKNOWN). */
export function verdictForRequirement(requirement: RequirementInput, attribute: AttributeInput | null): SpecVerdict {
  if (!attribute) return "UNKNOWN";

  switch (requirement.operator) {
    case "EQUALS": {
      if (requirement.valueNum !== null) {
        if (attribute.valueNum === null) return "UNKNOWN";
        return Math.abs(attribute.valueNum - requirement.valueNum) < NUMBER_TOLERANCE ? "EXACT" : "MISMATCH";
      }
      if (requirement.valueText !== null) {
        if (attribute.valueText === null) return "UNKNOWN";
        if (!PREFIX_KEYS.has(requirement.attributeKey)) return requirement.valueText === attribute.valueText ? "EXACT" : "MISMATCH";
        const relation = textRelation(requirement.valueText, attribute.valueText);
        if (relation === "equal") return "EXACT";
        if (relation === "attribute-more-specific") return "COMPATIBLE"; // e.g. asked "windows-11", product states "windows-11-pro"
        if (relation === "attribute-broader") return "PARTIAL"; // e.g. asked "windows-11-pro", product only states "windows-11"
        return "MISMATCH";
      }
      return "UNKNOWN";
    }
    case "GREATER_THAN_OR_EQUAL": {
      if (requirement.valueNum === null || attribute.valueNum === null) return "UNKNOWN";
      if (attribute.valueNum > requirement.valueNum + NUMBER_TOLERANCE) return "UPGRADE";
      if (attribute.valueNum >= requirement.valueNum - NUMBER_TOLERANCE) return "EXACT";
      return "MISMATCH";
    }
    case "LESS_THAN_OR_EQUAL": {
      if (requirement.valueNum === null || attribute.valueNum === null) return "UNKNOWN";
      if (attribute.valueNum < requirement.valueNum - NUMBER_TOLERANCE) return "UPGRADE";
      if (attribute.valueNum <= requirement.valueNum + NUMBER_TOLERANCE) return "EXACT";
      return "MISMATCH";
    }
    case "BETWEEN": {
      if (requirement.valueNum === null || requirement.valueNumMax === null || attribute.valueNum === null) return "UNKNOWN";
      const lower = requirement.valueNum;
      const upper = requirement.valueNumMax;
      if (attribute.valueNum >= lower - NUMBER_TOLERANCE && attribute.valueNum <= upper + NUMBER_TOLERANCE) return "EXACT";
      // A near miss within one requested span's width beyond either edge (floored at 0.1 so a degenerate zero-width
      // range still has a real near-miss band) is worth a person's look, on top of the rounding tolerance above.
      const nearMiss = Math.max(upper - lower, 0.1);
      if (attribute.valueNum >= lower - NUMBER_TOLERANCE - nearMiss && attribute.valueNum <= upper + NUMBER_TOLERANCE + nearMiss) return "COMPATIBLE";
      return "MISMATCH";
    }
    case "IN": {
      const wanted = requirement.valueList ?? [];
      if (wanted.length === 0 || attribute.valueList.length === 0) return "UNKNOWN";
      const have = new Set(attribute.valueList);
      const covered = wanted.filter((v) => have.has(v));
      if (covered.length === wanted.length) return "EXACT";
      if (covered.length > 0) return "PARTIAL";
      return "MISMATCH";
    }
    case "CONTAINS": {
      if (requirement.valueText === null || attribute.valueText === null) return "UNKNOWN";
      return attribute.valueText.toLowerCase().includes(requirement.valueText.toLowerCase()) ? "EXACT" : "MISMATCH";
    }
  }
}

/** Every active requirement against one candidate product's active attributes. Missing attributes yield UNKNOWN, never skipped. */
export function compareRequirementsToProduct(requirements: readonly RequirementInput[], attributes: readonly AttributeInput[]): RequirementVerdict[] {
  const byKey = new Map(attributes.map((a) => [a.attributeKey, a]));
  return requirements.map((r) => ({ attributeKey: r.attributeKey, importance: r.importance, verdict: verdictForRequirement(r, byKey.get(r.attributeKey) ?? null) }));
}

/**
 * One verdict for a candidate: the worst verdict among its MUST requirements (a SHOULD/NICE mismatch never blocks or drags down
 * the headline verdict). Falls back to the worst among all requirements only when there are no MUST rows at all.
 */
export function overallVerdict(perRequirement: readonly { importance: RequirementImportance; verdict: SpecVerdict }[]): SpecVerdict {
  const musts = perRequirement.filter((p) => p.importance === "MUST");
  const pool = musts.length > 0 ? musts : perRequirement;
  if (pool.length === 0) return "UNKNOWN";
  return pool.reduce((worst, p) => (SPEC_VERDICT_SEVERITY[p.verdict] < SPEC_VERDICT_SEVERITY[worst] ? p.verdict : worst), pool[0]!.verdict);
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit` and `npx eslint src/modules/specs/verdict.ts`
Expected: both clean (no output / no errors).

- [ ] **Step 3: Verify the verdict table by hand**

Create a scratch file (not committed) `scratchpad/verify-verdict.ts`:

```ts
import { verdictForRequirement, overallVerdict, type RequirementInput, type AttributeInput } from "../src/modules/specs/verdict";

const req = (over: Partial<RequirementInput>): RequirementInput => ({ attributeKey: "ram_gb", operator: "EQUALS", importance: "MUST", valueText: null, valueNum: null, valueNumMax: null, valueList: null, ...over });
const attr = (over: Partial<AttributeInput>): AttributeInput => ({ attributeKey: "ram_gb", valueText: null, valueNum: null, valueList: [], ...over });

// GTE: asked >=16GB, product has 32GB -> UPGRADE
console.log("gte-upgrade", verdictForRequirement(req({ operator: "GREATER_THAN_OR_EQUAL", valueNum: 16 }), attr({ valueNum: 32 })));
// GTE: asked >=16GB, product has 16GB -> EXACT
console.log("gte-exact", verdictForRequirement(req({ operator: "GREATER_THAN_OR_EQUAL", valueNum: 16 }), attr({ valueNum: 16 })));
// GTE: asked >=16GB, product has 8GB -> MISMATCH
console.log("gte-mismatch", verdictForRequirement(req({ operator: "GREATER_THAN_OR_EQUAL", valueNum: 16 }), attr({ valueNum: 8 })));
// No attribute row at all -> UNKNOWN
console.log("unknown", verdictForRequirement(req({ operator: "GREATER_THAN_OR_EQUAL", valueNum: 16 }), null));
// BETWEEN: asked 15.3-15.9in (EXACT band 14.8-16.4 with the 0.5 rounding tolerance), product 16.7in
// (past EXACT's 16.4 but within the near-miss band out to 16.4+nearMiss(0.6)=17.0) -> COMPATIBLE
console.log("between-compatible", verdictForRequirement(req({ attributeKey: "screen_in", operator: "BETWEEN", valueNum: 15.3, valueNumMax: 15.9 }), attr({ attributeKey: "screen_in", valueNum: 16.7 })));
// BETWEEN: asked 15.3-15.9in, product 17.3in (past the 17.0 near-miss edge) -> MISMATCH
console.log("between-mismatch", verdictForRequirement(req({ attributeKey: "screen_in", operator: "BETWEEN", valueNum: 15.3, valueNumMax: 15.9 }), attr({ attributeKey: "screen_in", valueNum: 17.3 })));
// EQUALS text, prefix pair: asked "windows-11", product "windows-11-pro" -> COMPATIBLE (product more specific)
console.log("os-compatible", verdictForRequirement(req({ attributeKey: "os", operator: "EQUALS", valueText: "windows-11" }), attr({ attributeKey: "os", valueText: "windows-11-pro" })));
// EQUALS text, reversed: asked "windows-11-pro", product only "windows-11" -> PARTIAL (product broader than asked)
console.log("os-partial", verdictForRequirement(req({ attributeKey: "os", operator: "EQUALS", valueText: "windows-11-pro" }), attr({ attributeKey: "os", valueText: "windows-11" })));
// IN: asked ["ar","en"], product only ["en"] -> PARTIAL
console.log("kb-partial", verdictForRequirement(req({ attributeKey: "keyboard_lang", operator: "IN", valueList: ["ar", "en"] }), attr({ attributeKey: "keyboard_lang", valueList: ["en"] })));
// overall: one EXACT MUST + one MISMATCH MUST -> MISMATCH wins (worst of the MUSTs)
console.log("overall-mismatch", overallVerdict([{ importance: "MUST", verdict: "EXACT" }, { importance: "MUST", verdict: "MISMATCH" }]));
// overall: a SHOULD mismatch never drags down a candidate with only-EXACT MUSTs
console.log("overall-ignores-should", overallVerdict([{ importance: "MUST", verdict: "EXACT" }, { importance: "SHOULD", verdict: "MISMATCH" }]));
```

Run: `npx tsx scratchpad/verify-verdict.ts`
Expected output, in order: `gte-upgrade UPGRADE`, `gte-exact EXACT`, `gte-mismatch MISMATCH`, `unknown UNKNOWN`, `between-compatible COMPATIBLE`, `between-mismatch MISMATCH`, `os-compatible COMPATIBLE`, `os-partial PARTIAL`, `kb-partial PARTIAL`, `overall-mismatch MISMATCH`, `overall-ignores-should EXACT`. Fix `verdict.ts` if any line disagrees, re-run until all match, then delete the scratch file (do not commit it).

- [ ] **Step 4: Commit**

```bash
git add src/modules/specs/verdict.ts
git commit -m "feat: spec-aware requirement-vs-attribute verdict engine"
```

---

### Task 2: Batched product-attribute loader

**Files:**
- Modify: `src/modules/products/attributes.service.ts`

**Interfaces:**
- Consumes: `AttributeInput` from `../specs/verdict` (Task 1), `Db` from `../../core/database/tx` (existing).
- Produces (consumed by Tasks 3-4): `loadActiveAttributes(db: Db, productIds: readonly string[]): Promise<Map<string, AttributeInput[]>>`.

- [ ] **Step 1: Add `loadActiveAttributes` to `attributes.service.ts`**

Add this import to the top of the file (alongside the existing `ServiceContext` import) and this function after `createParsedProductAttributes`:

```ts
import type { Db, ServiceContext } from "../../core/database/tx";
import type { AttributeInput } from "../specs/verdict";
```

```ts
/** Every listed product's active attributes, batched into one query — the "what does it actually have" side of a spec-verdict comparison. Products with no rows are simply absent from the map (read as UNKNOWN by the caller). */
export async function loadActiveAttributes(db: Db, productIds: readonly string[]): Promise<Map<string, AttributeInput[]>> {
  const result = new Map<string, AttributeInput[]>();
  if (productIds.length === 0) return result;
  const rows = await db.productAttribute.findMany({
    where: { productId: { in: [...productIds] }, retractedAt: null },
    select: { productId: true, attributeKey: true, valueText: true, valueNum: true, valueList: true },
  });
  for (const row of rows) {
    const list = result.get(row.productId) ?? [];
    list.push({ attributeKey: row.attributeKey, valueText: row.valueText, valueNum: row.valueNum === null ? null : Number(row.valueNum), valueList: row.valueList });
    result.set(row.productId, list);
  }
  return result;
}
```

(The existing `import type { ServiceContext } from "../../core/database/tx";` line becomes `import type { Db, ServiceContext } from "../../core/database/tx";` — a one-line edit, not a new import block.)

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit` and `npx eslint src/modules/products/attributes.service.ts`
Expected: both clean.

- [ ] **Step 3: Verify against the project database**

Create scratch file `scratchpad/verify-loader.ts` (not committed):

```ts
import { db } from "../src/core/database/client";
import { loadActiveAttributes } from "../src/modules/products/attributes.service";

async function main() {
  // Use the phase-2 TEST product (key E14G7, six attributes) plus one arbitrary other active product, and one made-up id (no rows).
  const testProduct = await db.product.findFirst({ where: { modelKey: "E14G7" }, select: { id: true, name: true } });
  if (!testProduct) throw new Error("TEST product with modelKey E14G7 not found — check phase 2 status section for the current TEST product name.");
  const other = await db.product.findFirst({ where: { id: { not: testProduct.id }, status: "ACTIVE" }, select: { id: true } });
  const ids = [testProduct.id, other!.id, "00000000-0000-0000-0000-000000000000"];
  const map = await loadActiveAttributes(db, ids);
  console.log("testProduct", testProduct.name, "attributeCount", map.get(testProduct.id)?.length ?? 0);
  console.log("otherProduct attributeCount", map.get(other!.id)?.length ?? 0);
  console.log("madeUpId present?", map.has("00000000-0000-0000-0000-000000000000"));
}
main().finally(() => db.$disconnect());
```

Run: `npx tsx scratchpad/verify-loader.ts`
Expected: `testProduct <name> attributeCount 6` (matches the phase-2 status section's "six attributes read"), `otherProduct attributeCount` some number ≥ 0, `madeUpId present? false` (confirms products with zero rows are simply absent from the map, not present with an empty array — the caller's `?? []` fallback in Task 1/3 code handles this). Delete the scratch file after (do not commit it).

- [ ] **Step 4: Commit**

```bash
git add src/modules/products/attributes.service.ts
git commit -m "feat: batched active-attribute loader for candidate verdicts"
```

---

### Task 3: Verdict display in the candidate picker (phase 3 — shippable, auto-link unchanged)

**Files:**
- Modify: `src/modules/enquiries/queries.ts` (`getEnquiryItemCandidates`)
- Modify: `src/lib/labels.ts` (add `SPEC_VERDICT_LABEL`)
- Modify: `src/components/application/status-badges.tsx` (add `SPEC_VERDICT_TONE`, `SpecVerdictPill`)
- Modify: `src/modules/enquiries/components/item-row.tsx` (candidate prop type only)
- Modify: `src/modules/enquiries/components/product-linker.tsx` (render the verdict)

**Interfaces:**
- Consumes: `SpecVerdict`, `RequirementVerdict`, `PersistedRequirement`, `compareRequirementsToProduct`, `overallVerdict`, `toRequirementInput`, `SPEC_VERDICT_SEVERITY` from `../specs/verdict` (Task 1); `loadActiveAttributes` from `../products/attributes.service` (Task 2).
- Produces (consumed by page.tsx, no changes needed there beyond one call-site argument): `CandidateWithVerdict = MatchCandidate & { overall: SpecVerdict | null; perRequirement: RequirementVerdict[] }`, `getEnquiryItemCandidates(item, requirements: readonly PersistedRequirement[]): Promise<CandidateWithVerdict[]>`.

- [ ] **Step 1: Add `SPEC_VERDICT_LABEL` to `src/lib/labels.ts`**

Add this import and this export, following the file's existing pattern exactly (one `Record<Enum, string>` per vocabulary):

```ts
import type { SpecVerdict } from "../modules/specs/verdict";
```

```ts
export const SPEC_VERDICT_LABEL: Record<SpecVerdict, string> = {
  EXACT: "Matches",
  UPGRADE: "Exceeds",
  COMPATIBLE: "Compatible",
  PARTIAL: "Partial match",
  MISMATCH: "Does not match",
  UNKNOWN: "Unknown",
};
```

- [ ] **Step 2: Add `SPEC_VERDICT_TONE` and `SpecVerdictPill` to `status-badges.tsx`**

Add `SpecVerdict` to the existing top-of-file `import type { ... } from "@/generated/prisma/enums";`? No — `SpecVerdict` is not a Prisma enum, so add a second type-only import line instead, and add `SPEC_VERDICT_LABEL` to the existing `@/lib/labels` import list:

```ts
import type { SpecVerdict } from "@/modules/specs/verdict";
```

(add `SPEC_VERDICT_LABEL` into the existing multi-line `import { ... } from "@/lib/labels";` block, alphabetically between `SUPPLIER_REQUEST_STATUS_LABEL` and `VAT_STATE_LABEL`)

Add, right after `MatchBadge` (after line 41):

```ts
/** How well a candidate product's own specification satisfies a requirement's MUST attributes (src/modules/specs/verdict.ts). */
export const SPEC_VERDICT_TONE: Record<SpecVerdict, PillTone> = {
  EXACT: "green",
  UPGRADE: "sky",
  COMPATIBLE: "teal",
  PARTIAL: "amber",
  MISMATCH: "rose",
  UNKNOWN: "neutral",
};

export function SpecVerdictPill({ verdict, title }: { verdict: SpecVerdict; title?: string }) {
  return (
    <SoftPill tone={SPEC_VERDICT_TONE[verdict]} dot={verdict !== "UNKNOWN"} title={title}>
      {SPEC_VERDICT_LABEL[verdict]}
    </SoftPill>
  );
}
```

- [ ] **Step 3: Extend `getEnquiryItemCandidates` in `src/modules/enquiries/queries.ts`**

Add imports:

```ts
import { compareRequirementsToProduct, overallVerdict, toRequirementInput, SPEC_VERDICT_SEVERITY, type PersistedRequirement, type RequirementVerdict, type SpecVerdict } from "../specs/verdict";
import { loadActiveAttributes } from "../products/attributes.service";
```

Replace the existing function (currently just `return findMatchCandidates(db, {...});`) with:

```ts
export type CandidateWithVerdict = MatchCandidate & { overall: SpecVerdict | null; perRequirement: RequirementVerdict[] };

export async function getEnquiryItemCandidates(
  item: { partNumber: string | null; modelText: string | null; brandText: string | null; description: string | null },
  requirements: readonly PersistedRequirement[],
): Promise<CandidateWithVerdict[]> {
  const candidates = await findMatchCandidates(db, { partNumber: item.partNumber, model: item.modelText, brandText: item.brandText, description: item.description });
  if (candidates.length === 0 || requirements.length === 0) return candidates.map((c) => ({ ...c, overall: null, perRequirement: [] }));

  const inputs = requirements.map(toRequirementInput);
  const attributesByProduct = await loadActiveAttributes(db, candidates.map((c) => c.productId));
  const withVerdicts = candidates.map((c) => {
    const perRequirement = compareRequirementsToProduct(inputs, attributesByProduct.get(c.productId) ?? []);
    return { ...c, overall: overallVerdict(perRequirement), perRequirement };
  });
  // Ranking: best spec verdict first (phase 3's "ranking ... in the candidate list"); ties keep findMatchCandidates' own text-strength order.
  return withVerdicts.sort((a, b) => SPEC_VERDICT_SEVERITY[b.overall] - SPEC_VERDICT_SEVERITY[a.overall]);
}
```

`MatchCandidate` is already imported in this file (used by the existing function signature).

- [ ] **Step 4: Update the one call site — `src/app/(workspace)/enquiries/[id]/page.tsx`**

Change:

```ts
selected && selected.reviewStatus === "PENDING" ? getEnquiryItemCandidates(selected) : Promise.resolve([])
```

to:

```ts
selected && selected.reviewStatus === "PENDING" ? getEnquiryItemCandidates(selected, selected.requirements) : Promise.resolve([])
```

`selected.requirements` already exists on `EnquiryDetail`'s item shape (the active requirements `getEnquiry`'s Prisma `include` already loads) — no new query.

- [ ] **Step 5: Update `item-row.tsx`'s prop type**

Change the import and prop type:

```ts
import type { MatchCandidate } from "@/modules/products/matching";
```
becomes
```ts
import type { CandidateWithVerdict } from "../queries";
```

and `candidates: MatchCandidate[];` (in the destructured props type) becomes `candidates: CandidateWithVerdict[];`. The JSX itself (`candidates={candidates}` passed into `EnquiryProductLinker`) does not change.

- [ ] **Step 6: Render the verdict in `product-linker.tsx`**

Add imports:

```ts
import { SpecVerdictPill } from "@/components/application/status-badges";
import { requirementLabel } from "@/modules/specs/format";
import { SPEC_VERDICT_LABEL } from "@/lib/labels";
import type { CandidateWithVerdict } from "../queries";
import type { RequirementVerdict } from "@/modules/specs/verdict";
```

Change the `candidates` prop type from `MatchCandidate[]` to `CandidateWithVerdict[]` (both in the destructuring signature and the inline type block).

Change the `Row` type:

```ts
type Row = { id: string; name: string; partNumber: string | null; brandName: string | null; badge?: MatchCandidate["strength"]; overall?: SpecVerdict | null; perRequirement?: RequirementVerdict[] };
```

(add `import type { SpecVerdict } from "@/modules/specs/verdict";` alongside the other new imports — or fold it into the `RequirementVerdict` import line as `import type { RequirementVerdict, SpecVerdict } from "@/modules/specs/verdict";`)

Add this helper above the component:

```ts
const specExplanation = (perRequirement: RequirementVerdict[]): string | undefined =>
  perRequirement.length ? perRequirement.map((p) => `${requirementLabel(p.attributeKey)}: ${SPEC_VERDICT_LABEL[p.verdict]}`).join(" · ") : undefined;
```

Change the `rows` construction:

```ts
const rows: Row[] = [
  ...candidates.map((c) => ({ id: c.productId, name: c.name, partNumber: c.partNumber, brandName: c.brandName, badge: c.strength, overall: c.overall, perRequirement: c.perRequirement })),
  ...results.filter((r) => !candidates.some((c) => c.productId === r.id)),
].filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i && r.id !== current?.id);
```

Change the candidate row's action cell (currently `<div className="flex shrink-0 items-center gap-2">{row.badge ? ... : null}{linkForm(...)}</div>`) to:

```tsx
<div className="flex shrink-0 items-center gap-2">
  {row.overall ? <SpecVerdictPill verdict={row.overall} title={specExplanation(row.perRequirement ?? [])} /> : null}
  {row.badge ? <Badge variant={STRENGTH_LABEL[row.badge].variant}>{STRENGTH_LABEL[row.badge].label}</Badge> : null}
  {linkForm(row.id, "Link", row.badge === "EXACT" ? "default" : "outline")}
</div>
```

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit` and `npx eslint src/lib/labels.ts src/components/application/status-badges.tsx src/modules/enquiries/queries.ts src/modules/enquiries/components/item-row.tsx src/modules/enquiries/components/product-linker.tsx "src/app/(workspace)/enquiries/[id]/page.tsx"`
Expected: both clean.

- [ ] **Step 8: Verify against the project database (rolled-back transaction)**

Create scratch file `scratchpad/verify-candidates.ts` (not committed):

```ts
import { db } from "../src/core/database/client";
import { getEnquiryItemCandidates } from "../src/modules/enquiries/queries";

async function main() {
  // Reuse the phase-1 TEST enquiry (ENQ-00004) if it still has a PENDING item with requirements; otherwise report and stop.
  const enquiry = await db.enquiry.findFirst({ where: { number: 4 }, select: { id: true, items: { where: { reviewStatus: "PENDING" }, include: { requirements: { where: { retractedAt: null } } } } } });
  if (!enquiry || enquiry.items.length === 0) throw new Error("ENQ-00004 has no PENDING item left — pick another enquiry id with a PENDING item that has requirements and edit this script's `where`.");
  const item = enquiry.items[0]!;
  console.log("item", item.description ?? item.modelText, "requirementCount", item.requirements.length);
  const candidates = await getEnquiryItemCandidates(item, item.requirements);
  for (const c of candidates) console.log(c.name, "strength", c.strength, "overall", c.overall, "perRequirement", c.perRequirement.map((p) => `${p.attributeKey}:${p.verdict}`).join(","));
}
main().finally(() => db.$disconnect());
```

Run: `npx tsx scratchpad/verify-candidates.ts`
Expected: one line per candidate, each showing a plausible `overall` derived from its `perRequirement` list (e.g. a candidate with any MUST `MISMATCH` shows `overall MISMATCH`), and candidates ordered best-`overall`-first. Cross-check two or three lines by hand against the verdict rules from Task 1. Delete the scratch file after (do not commit it).

- [ ] **Step 9: Browser check (flag if blocked, per the project's own "not verified in a browser" convention)**

Sign in, open ENQ-00004 (or another enquiry with a PENDING, requirement-bearing item), expand the item, confirm the picker shows a verdict pill next to the existing Exact/Probable/Possible badge on each candidate, and that hovering it shows the per-requirement breakdown. If sign-in is blocked in this session the way it was for phases 1-2, record that explicitly in the Status write-up below instead of skipping the note.

- [ ] **Step 10: Commit**

```bash
git add src/lib/labels.ts src/components/application/status-badges.tsx src/modules/enquiries/queries.ts "src/app/(workspace)/enquiries/[id]/page.tsx" src/modules/enquiries/components/item-row.tsx src/modules/enquiries/components/product-linker.tsx
git commit -m "feat: rank and explain candidate products by spec match (phase 3, shadow mode)"
```

---

### Task 4: Auto-link gating (phase 4 — changes auto-link behavior)

**Files:**
- Modify: `src/modules/products/matching.ts` (add `pickAutoLinkWithSpecs`)
- Modify: `src/modules/enquiries/service.ts` (`createEnquiry`)
- Modify: `src/modules/enquiries/item.service.ts` (`addManualEnquiryItem`)

**Interfaces:**
- Consumes: `compareRequirementsToProduct`, `overallVerdict`, `RequirementInput` from `../specs/verdict` (Task 1); `loadActiveAttributes` from `./attributes.service` (Task 2); existing `pickAutoLink`, `MatchCandidate` (same file); existing `ProposedRequirement` from `../specs/types` (already used by both call sites today via `requirement.service.ts`'s re-export path — `ProposedRequirement` structurally satisfies `RequirementInput`, no conversion needed).
- Produces: `pickAutoLinkWithSpecs(db: Db, candidates: readonly MatchCandidate[], requirements: readonly RequirementInput[]): Promise<MatchCandidate | null>`.

- [ ] **Step 1: Add `pickAutoLinkWithSpecs` to `src/modules/products/matching.ts`**

Add imports at the top of the file:

```ts
import { compareRequirementsToProduct, overallVerdict, type RequirementInput } from "../specs/verdict";
import { loadActiveAttributes } from "./attributes.service";
```

Add after the existing `pickAutoLink` function:

```ts
/**
 * `pickAutoLink`, redefined for phase 4: the same single-strong-match pick, but vetoed when a MUST requirement comes back
 * MISMATCH or UNKNOWN against the picked candidate's own attributes — "conflicts and unknown must-have specifications force
 * human review" (docs/plans/active/CURRENT.md). An item with no MUST requirements (or no requirements at all) is unaffected:
 * this never queries the database unless `pickAutoLink` already found something to veto.
 */
export async function pickAutoLinkWithSpecs(db: Db, candidates: readonly MatchCandidate[], requirements: readonly RequirementInput[]): Promise<MatchCandidate | null> {
  const link = pickAutoLink(candidates);
  if (!link) return null;
  const musts = requirements.filter((r) => r.importance === "MUST");
  if (musts.length === 0) return link;

  const attributesByProduct = await loadActiveAttributes(db, [link.productId]);
  const perRequirement = compareRequirementsToProduct(musts, attributesByProduct.get(link.productId) ?? []);
  const overall = overallVerdict(perRequirement);
  return overall === "MISMATCH" || overall === "UNKNOWN" ? null : link;
}
```

- [ ] **Step 2: Wire it into `createEnquiry` (`src/modules/enquiries/service.ts`)**

Change the per-item loop (currently: compute `candidates`, then `const link = pickAutoLink(candidates);`, then build `fields`, then create the item, then separately propose requirements from `fields`) to compute the proposed requirements once and reuse them for both the gating check and the requirement rows:

```ts
import { findMatchCandidates, pickAutoLinkWithSpecs } from "../products/matching";
```

(replaces the existing `import { findMatchCandidates, pickAutoLink } from "../products/matching";`)

```ts
for (const item of parsed.items) {
  const candidates = await findMatchCandidates(c.db, { partNumber: item.partNumber, model: item.modelText, brandText: item.brandText, description: item.description });
  const { extractedData, confidence, ...fields } = item;
  const proposedRequirements = proposeRequirementsForItem({ sourceText: fields.sourceText, description: fields.description, specText: fields.specText });
  const link = await pickAutoLinkWithSpecs(c.db, candidates, proposedRequirements);
  // The parser's original values are kept write-once in extracted_data, so the workspace can always show "original vs corrected".
  const original = {
    description: fields.description,
    brandText: fields.brandText,
    familyText: fields.familyText,
    modelText: fields.modelText,
    partNumber: fields.partNumber,
    specText: fields.specText,
    quantity: fields.quantity,
  };
  const created = await c.db.enquiryItem.create({
    data: {
      ...fields,
      enquiryId: enquiry.id,
      origin: "PARSER",
      extractionConfidence: confidence,
      extractedData: { ...extractedData, fields: original } as Prisma.InputJsonValue,
      productId: link?.productId ?? null,
      matchBasis: link?.basis ?? null,
    },
  });
  requirementCount += await createParsedRequirements(c, created.id, proposedRequirements);
}
```

(This is the same loop body as today, reordered so `proposedRequirements` is computed once before `link`, then reused at the bottom instead of calling `proposeRequirementsForItem` a second time.)

- [ ] **Step 3: Wire it into `addManualEnquiryItem` (`src/modules/enquiries/item.service.ts`)**

```ts
import { findMatchCandidates, pickAutoLinkWithSpecs } from "../products/matching";
```

(replaces the existing `import { findMatchCandidates, pickAutoLink } from "../products/matching";`)

Change the function body from:

```ts
const candidates = await findMatchCandidates(c.db, { partNumber: fields.partNumber, model: fields.modelText, brandText: fields.brandText, description: fields.description });
const link = pickAutoLink(candidates);
const item = await c.db.enquiryItem.create({
  data: {
    ...fields,
    enquiryId,
    position: (last._max.position ?? 0) + 1,
    sourceText: sourceText ?? "(added by hand)",
    origin: "MANUAL",
    productId: link?.productId ?? null,
    matchBasis: link?.basis ?? null,
  },
});
const requirements = await createParsedRequirements(c, item.id, proposeRequirementsForItem(item));
```

to:

```ts
const candidates = await findMatchCandidates(c.db, { partNumber: fields.partNumber, model: fields.modelText, brandText: fields.brandText, description: fields.description });
const resolvedSourceText = sourceText ?? "(added by hand)";
const proposedRequirements = proposeRequirementsForItem({ sourceText: resolvedSourceText, description: fields.description, specText: fields.specText });
const link = await pickAutoLinkWithSpecs(c.db, candidates, proposedRequirements);
const item = await c.db.enquiryItem.create({
  data: {
    ...fields,
    enquiryId,
    position: (last._max.position ?? 0) + 1,
    sourceText: resolvedSourceText,
    origin: "MANUAL",
    productId: link?.productId ?? null,
    matchBasis: link?.basis ?? null,
  },
});
const requirements = await createParsedRequirements(c, item.id, proposedRequirements);
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit` and `npx eslint src/modules/products/matching.ts src/modules/enquiries/service.ts src/modules/enquiries/item.service.ts`
Expected: both clean.

- [ ] **Step 5: Verify with a rolled-back transaction against the project database**

Create scratch file `scratchpad/verify-gating.ts` (not committed) — this exercises all five Review Focus cases in one run:

```ts
import { db } from "../src/core/database/client";
import { pickAutoLinkWithSpecs } from "../src/modules/products/matching";
import { pickAutoLink, type MatchCandidate } from "../src/modules/products/matching";
import type { RequirementInput } from "../src/modules/specs/verdict";

async function main() {
  const testProduct = await db.product.findFirst({ where: { modelKey: "E14G7" }, select: { id: true, name: true } });
  if (!testProduct) throw new Error("TEST product with modelKey E14G7 not found.");
  const candidate: MatchCandidate = { productId: testProduct.id, name: testProduct.name, partNumber: null, brandName: null, basis: "MODEL", strength: "EXACT" };

  // Case A: no requirements at all -> behaves exactly like plain pickAutoLink (still returns the candidate).
  const noReqs: RequirementInput[] = [];
  const a = await pickAutoLinkWithSpecs(db, [candidate], noReqs);
  console.log("A: no requirements -> matches plain pickAutoLink?", a?.productId === pickAutoLink([candidate])?.productId);

  // Case B: a MUST requirement the product satisfies (ram_gb GTE 8, product known to have >=8) -> still linked.
  const satisfied: RequirementInput[] = [{ attributeKey: "ram_gb", operator: "GREATER_THAN_OR_EQUAL", importance: "MUST", valueText: null, valueNum: 8, valueNumMax: null, valueList: null }];
  const b = await pickAutoLinkWithSpecs(db, [candidate], satisfied);
  console.log("B: satisfied MUST -> still linked?", b?.productId === testProduct.id);

  // Case C: a MUST requirement the product cannot satisfy (absurdly high RAM) -> blocked (null).
  const impossible: RequirementInput[] = [{ attributeKey: "ram_gb", operator: "GREATER_THAN_OR_EQUAL", importance: "MUST", valueText: null, valueNum: 999999, valueNumMax: null, valueList: null }];
  const c = await pickAutoLinkWithSpecs(db, [candidate], impossible);
  console.log("C: impossible MUST -> blocked?", c === null);

  // Case D: a MUST requirement on an attribute the product has no row for -> blocked (UNKNOWN).
  const unknownKey: RequirementInput[] = [{ attributeKey: "keyboard_lang", operator: "IN", importance: "MUST", valueText: null, valueNum: null, valueNumMax: null, valueList: ["ar"] }];
  const d = await pickAutoLinkWithSpecs(db, [candidate], unknownKey);
  console.log("D: unknown MUST attribute -> blocked?", d === null, "(only true if the TEST product genuinely has no keyboard_lang row — check case output against Task 2's six-attribute list first)");

  // Case E: pickAutoLink already returns null for an ambiguous set (two EXACT candidates) -> never touches the database.
  const ambiguous: MatchCandidate[] = [candidate, { ...candidate, productId: "11111111-1111-1111-1111-111111111111" }];
  const e = await pickAutoLinkWithSpecs(db, ambiguous, satisfied);
  console.log("E: ambiguous text match -> short-circuits to null?", e === null);
}
main().finally(() => db.$disconnect());
```

Run: `npx tsx scratchpad/verify-gating.ts`
Expected: `A: ... true`, `B: ... true`, `C: ... true`, `D: ... true` (or `false` with a note if the TEST product does in fact have a `keyboard_lang` row — check Task 2's Step 3 output first and swap `unknownKey`'s `attributeKey` for one confirmed absent), `E: ... true`. Then separately, run the full real-enquiry flow inside a rolled-back transaction the same way the phase-5 broadcast work verified `resolveProductForItem` (see "Broadcast variant safety, parser v5" above): wrap a call to `createEnquiry` with a real multi-line `TEST` request in `db.$transaction(async (tx) => { ...; throw new RollbackSignal(); })` (or the project's existing rolled-back-transaction helper if `scripts/` already has one — check before writing a new one) and confirm at least one line that would have auto-linked under the old `pickAutoLink` is now left unlinked because of a MUST conflict, with everything else unchanged; nothing is saved. Delete the scratch file after (do not commit it).

- [ ] **Step 6: Commit**

```bash
git add src/modules/products/matching.ts src/modules/enquiries/service.ts src/modules/enquiries/item.service.ts
git commit -m "feat: gate enquiry auto-link on MUST requirement conflicts (phase 4)"
```

---

### Task 5: Update docs and this plan's Status

**Files:**
- Modify: `docs/plans/active/CURRENT.md` (this file: replace phase 3/4 bullets' "not built" framing with a dated Status section, following the exact pattern of the phase 1/2 Status sections above)
- Modify: `docs/modules/ENQUIRIES.md` (the "Phase 1 changes no matching" line, now stale)
- Modify: `docs/modules/PRODUCTS.md` (the "Matching does not use these yet (next phase)" line, now stale)

- [ ] **Step 1: Write the Status section**

After Task 4 is verified, add a new section here (in this file) titled `## Structured requirements, phases 3-4 status (<the actual date>)`, following the phase 1/2 sections' exact style: what was built, the exact verification numbers from Tasks 1-4's Step "Verify" outputs (candidate counts, verdicts observed, the gating cases A-E results), and an explicit "Not verified in a browser" line only if Task 3 Step 9 was in fact blocked.

- [ ] **Step 2: Update `docs/modules/ENQUIRIES.md`**

Change the line "**Phase 1 changes no matching**: `findMatchCandidates` and `pickAutoLink` are untouched. Product attributes, spec-aware candidate comparison and auto-link gating are the next phases (`docs/plans/active/CURRENT.md`)." to reflect that phases 3-4 are now built: candidate comparison via `src/modules/specs/verdict.ts`, ranking and explanation in the picker (`product-linker.tsx`), and `pickAutoLinkWithSpecs` (`products/matching.ts`) gating both enquiry auto-link call sites on MUST-requirement conflicts.

- [ ] **Step 3: Update `docs/modules/PRODUCTS.md`**

Change "**Matching does not use these yet (next phase)**" (end of the "Structured specifications" paragraph) to state that `pickAutoLinkWithSpecs` now uses them for enquiry auto-link gating, with a pointer to `docs/plans/active/CURRENT.md`'s phases 3-4 status section.

- [ ] **Step 4: Typecheck and lint the whole project one more time**

Run: `npx tsc --noEmit` and `npx eslint .`
Expected: both clean — confirms nothing outside the touched files regressed.

- [ ] **Step 5: Commit**

```bash
git add docs/plans/active/CURRENT.md docs/modules/ENQUIRIES.md docs/modules/PRODUCTS.md
git commit -m "docs: record structured requirements phases 3-4 as built"
```

## Structured requirements, phases 3-4 status (2026-09-29)

Built: `src/modules/specs/verdict.ts` (Task 1, six-state `SpecVerdict` — EXACT/COMPATIBLE/UPGRADE/PARTIAL/MISMATCH/UNKNOWN — with `verdictForRequirement`, `compareRequirementsToProduct` and `overallVerdict`, worst-of-MUSTs); `loadActiveAttributes` (Task 2, batched product-attribute loader in `products/attributes.service.ts`); `getEnquiryItemCandidates` returning `CandidateWithVerdict` with a `SpecVerdictPill` on each candidate row in the picker, ranked best-verdict-first (Task 3, phase 3, display-only — the linking logic and the existing `strength` badge are untouched); `pickAutoLinkWithSpecs` (Task 4, phase 4) wired into both enquiry auto-link call sites (`createEnquiry`, `addManualEnquiryItem`), vetoing the plain `pickAutoLink` pick to `null` when any MUST requirement resolves MISMATCH or UNKNOWN against the picked product's own attributes. Typecheck and ESLint clean throughout; no schema or migration changes (reads only `enquiry_requirements` and `product_attributes`, both already migrated in phases 1-2).

Task 1's 11-case verdict table (`verify-verdict.ts`, scratch, deleted) all passed exactly as expected: GTE exceeding by more than tolerance -> UPGRADE, GTE met -> EXACT, GTE short -> MISMATCH, no attribute row -> UNKNOWN, BETWEEN just outside the range but inside the near-miss band -> COMPATIBLE, BETWEEN past that band -> MISMATCH, EQUALS text where the product states a more specific edition ("windows-11" asked, "windows-11-pro" stated) -> COMPATIBLE, the reverse (a more specific ask, a broader product statement) -> PARTIAL, an IN requirement partly covered -> PARTIAL, `overallVerdict` taking the worst of two MUST rows -> MISMATCH, and a SHOULD mismatch never dragging down an all-EXACT-MUST candidate -> EXACT.

Task 2's loader was verified against the project database: the phase-2 TEST product (`modelKey` `E14G7`) returned exactly 6 attributes, a second arbitrary active product returned 5, and a made-up product id was absent from the map entirely (`map.has()` false) rather than present with an empty array, confirming "zero rows" and "product not queried" stay distinguishable for callers.

Task 3 was verified two ways against the project database. First, the brief's own script against ENQ-00004 (`requirementCount 6`) hit the intended `candidates.length === 0` short-circuit: `findMatchCandidates` — pre-existing, untouched by this plan — currently returns zero candidates for every one of the 40 PENDING items in the database (a text/normalized-model key mismatch in the existing matching module, unrelated to this plan). A follow-up read-only script then exercised the ranking/verdict logic directly against three real, already-persisted products as stand-in candidates for the same item's 6 requirements (cpu MUST, ram_gb SHOULD, resolution NICE, screen_in MUST, storage_gb MUST, storage_type SHOULD): the phase-1/2 TEST fixture ranked first at `overall EXACT` (all three MUSTs EXACT), the real "LENOVO THINKPAD E14 GEN 7" and "Lenovo ThinkPad E16 Gen 3" both ranked behind it at `overall MISMATCH` (a CPU code mismatch on both, plus a screen-size mismatch on the E16), each cross-checked by hand against Task 1's rules and confirmed correct.

**Not verified in a browser**: this session had no browser-automation tool, and per the project's own established convention (the same block that applied to phases 1-2), interactive sign-in was not attempted. A person should open a PENDING item with requirements and confirm the picker shows a verdict pill with a per-requirement breakdown on hover — noting that, per the matching-key mismatch above, ENQ-00004 itself will currently show zero candidates regardless of this plan's code.

Task 4's five gating cases (`verify-gating.ts`, scratch, deleted) all passed against the project's real TEST product (six attributes: cpu, ram_gb, storage_gb, storage_type, screen_in, os — confirmed no `keyboard_lang` row before trusting case D): A (no requirements) matched plain `pickAutoLink` exactly; B (a MUST the product satisfies) stayed linked; C (an impossible MUST) was blocked to `null`; D (a MUST on an attribute the product has no row for) was blocked to `null` for the confirmed-genuine reason (no `keyboard_lang` row); E (an already-ambiguous `pickAutoLink` result) short-circuited to `null` without touching the database. A rolled-back `createEnquiry` transaction then ran a real two-line TEST request sharing one part number (an EXACT `PART_NUMBER` candidate for both lines): line 1 asked for 64GB RAM against a product recorded at 32GB (MUST `ram_gb` MISMATCH) and came back unlinked (`productId: null`); line 2, otherwise identical with no RAM wording, stayed auto-linked (`matchBasis: PART_NUMBER`) — 2 items created, 9 requirement rows, 8 of them MUST. A separate dry-run of plain `pickAutoLink` on the same candidates confirmed both lines would have auto-linked under the old logic. Nothing was saved (the enquiry is absent after rollback).

**Known limits:** `keyboard_lang` (keyboard layout, e.g. "Arabic keyboard") defaults to MUST importance in the registry — a phase-1 setting, unchanged by phases 3-4 — but the product-side attribute extractor structurally cannot read keyboard language from a product's catalog name or description, so it has zero coverage across active products in the project database (confirmed: 0 of 302). The practical effect: any enquiry line whose wording mentions a keyboard language is now permanently blocked from auto-linking, forced to human review every time, regardless of how good the actual product match is, because the product side can never supply a satisfying value for that MUST attribute. This is not a bug in what was built — the gating logic does exactly what the plan specifies — but it is a real limitation the owner should know about and may want to address (for example, lowering `keyboard_lang`'s default importance in the registry), outside this plan's scope. Separately, phase 3's ranking and display could not be exercised end-to-end on live PENDING data because the pre-existing matching module returns zero candidates for every current PENDING item (see Task 3 above): the verdict/ranking logic itself is verified correct against real data, but a person doing a browser check today will not see a populated, ranked candidate list on an existing item without first adding a broadcast or enquiry whose model text actually collides with a product's normalized model or part number.

## Broadcast variant safety, parser v5 (2026-09-27)

From the first real Red Data Computer list: parser version 5 (signature block skipped and read, price/currency false positive fixed, glued CPU+RAM split, INCOMING stock, tower category) and variant-safe product resolution for broadcast lines (`resolveProductForItem`). Verified by running the whole list through `createBroadcast` inside a rolled-back transaction on the project database: 6 lines gave 6 distinct products (the three Dell T2 lines sharing FCT2250 stayed three variants); nothing was saved. Existing broadcast, product and lib tests pass (124). This is phase 5 of the plan, built early because real data showed the collapse.

## Broadcast parser v6 and real supplier data (2026-09-27)

Owner-supplied real broadcasts were used to train the rule parser (version 6). Read: pipe-separated, comma-separated and one-line product lists, `|| title ||` + detail lines, a heading with one variant per line ("240GB - SA400S37/240G"), priced one-liners ("@325+vat"), Apple lines that start with a code, sender banners and footers ("SUPP :", "Person :", "CALL @", "Samir - +971..."), Apple / Snapdragon / Core Ultra X9 / Core 7 CPUs, months of warranty, "Last 4 Units" as LIMITED. Memory cards and USB sticks get no laptop attributes; GPU memory is not RAM. Brands added from the lists (Apple, TP-Link, ASUS, LG, MSI, Microsoft, Samsung, Seagate, Hiksemi, SanDisk, Apacer, Kingston, Acer) and 30 brandless products were given the brand their own name states (audited, `via: brand read from the product name`). Seven suppliers and their contacts were created from list signatures and 11 broadcasts were saved (all items PENDING; no observations until a person confirms). Full test suite 441 passed; the parser has no new tests (owner's development-first rule).

**AI layer changes from the same patterns:** search terms no longer treat capacities and speeds ("16GB", "144Hz") as part numbers (`ai/intents.ts`); `searchProcurement` (used by `/search` and the assistant's `search_products`) also lists products that share the canonical model key ("E14 Gen 7" finds "E14 G7") as possible MODEL matches; `search_products` returns each product's active specifications and the evidence package shows them as "specifications read from its name (not verified)"; prompts `answer-v2`, `interpret-v2` (code shapes) and `enquiry-draft-v2` (specification vocabulary, which details to ask for first). No provider or budget change; the model still never writes data and never decides a match.

## Out of scope

New features. Ideas go to `docs/ideas/BACKLOG.md`.
