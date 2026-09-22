# Data Model — Supplier & Broadcast Intelligence MVP

**Status:** PROPOSAL, awaiting review. Not yet migrated.
**Source of truth for columns:** [`prisma/schema.prisma`](../../prisma/schema.prisma). This file explains *why*, and holds the hand-written SQL Prisma cannot express.
**Scope:** only tables the current milestone needs (`docs/plans/active/CURRENT.md`). Future tables are listed at the end, not built.

## 1. Principles the schema enforces

| Principle | How |
|---|---|
| Price and stock are observations | No `Product.price` / `Product.stock`. `PriceObservation` / `StockObservation` = product + supplier + value + `observed_at` + evidence. |
| Raw evidence is preserved | `EvidenceSource.raw_text` is immutable (trigger). Every observation has a NOT NULL `evidence_source_id`. |
| History is never overwritten | Observations are append-only; the only permitted UPDATE is a one-way **retraction** (trigger). |
| Unknown is valid | Optional columns are NULL; `VatState` and `StockStatus` have an explicit `UNKNOWN`. No defaults invent facts (no default currency, no default VAT). |
| Humans confirm | Parser output lives in `BroadcastItem` as a proposal (`review_status = PENDING`). Observations exist only after a human confirms. |
| No hard deletes of business data | `RecordStatus` / `archived_at` / retraction. FKs on business tables are `Restrict`. |
| PostgreSQL is the source of truth | Integrity is enforced in the database (FKs, unique, CHECK, triggers), not only in application code. |

## 2. Entities and relationships (17 tables)

```
User ──< (created_by / confirmed_by / retracted_by / actor on the tables below)

Brand ──< SupplierBrand >── Supplier ──< SupplierContact >──< SupplierContactBrand >── Brand
Category ──< SupplierCategory >── Supplier                    SupplierContact >──< SupplierContactCategory >── Category

Brand ──< Product >── Category          Product ──< ProductAlias

EvidenceSource ──1:1── Broadcast >── Supplier          Broadcast >── SupplierContact (optional)
Broadcast ──< BroadcastItem >── Product (optional link)

PriceObservation / StockObservation >── Product, Supplier, SupplierContact(opt), EvidenceSource, BroadcastItem(opt)

AuditLog >── User (optional actor)
```

| Relationship | Cardinality | On delete |
|---|---|---|
| Supplier → SupplierContact | 1 : many | Restrict |
| Supplier ↔ Brand / Category | many : many via join table | Cascade (association metadata only) |
| SupplierContact ↔ Brand / Category | many : many via join table | Cascade |
| Brand / Category → Product | 1 : many, **optional** on Product (unknown is valid) | Restrict |
| Product → ProductAlias | 1 : many | Cascade (aliases are naming metadata; removal is audited) |
| EvidenceSource ↔ Broadcast | 1 : 1 (`evidence_source_id` unique) | Restrict |
| Supplier → Broadcast | 1 : many | Restrict |
| Broadcast → BroadcastItem | 1 : many | Restrict |
| BroadcastItem → Product | many : 1, optional until reviewed | Restrict |
| Observations → Product / Supplier / EvidenceSource / BroadcastItem | many : 1 | Restrict |

## 3. Why the shape looks like this

**EvidenceSource is separate from Broadcast.** `EvidenceSource` is the immutable raw artefact (text, hash, channel, `observed_at`). `Broadcast` is the mutable workflow wrapper (supplier, contact, notes, archive). Observations point at `EvidenceSource`, so when email, quotations or spreadsheets arrive in later milestones they become new `kind`s of evidence with **no change** to the observation tables.

**Two different clocks.** `EvidenceSource.observed_at` is when the supplier stated the information (user-entered, defaults to now). `created_at` is when we recorded it. Freshness and "latest" use `observed_at`, so entering an older broadcast late does not make old data look new. `observed_at` is copied onto each observation (immutable at the source) purely so "latest per supplier" is a single indexed query.

**Broadcast review status is derived, not stored.** "Needs review", "n confirmed / m pending" are computed from `BroadcastItem.review_status`. A stored status would be redundant state that can drift.

**Corrections without extra tables.** `BroadcastItem.extracted_data` is the parser's original proposal (write-once trigger): `{ parser, version, reasons[], hints{}, fields{} }`, where `fields` snapshots the originally extracted values (used by the evidence view to show original vs corrected). The typed columns are the current, possibly corrected values. A correction is the difference between the two, and every edit or re-link also writes an `AuditLog` row with `{field: {from, to}}`. That satisfies "keep original interpretation and corrected value" and "retain previous match history" without `ProductMatch`/`Correction` tables. Those can be added later if querying history becomes hot.

**Product identity.**
- `normalized_part_number` is **globally unique** when present (NULLs allowed). Manufacturer part numbers identify a product across brands in practice; a collision surfaces as a "duplicate product" error and the user resolves it. Products may have no part number.
- `normalized_model` is indexed, **not** unique (a model like "5440" can legitimately map to several products), so matching can return several candidates.
- `ProductAlias` is unique per `(product, normalized_alias)` only. One alias may point at several products; that produces a "possible match" for a human and is never resolved silently.
- Brand and category are optional on `Product` so a temporary product can be created from a broadcast without inventing them. `is_temporary` marks records awaiting curation. Merge is deferred (an additive `merged_into_id` later).

**Contact-level brands/categories** are relational join tables (CURRENT.md §6), never comma-separated strings.

**Supplier name uniqueness** (`normalized_name`, all statuses). It prevents accidental duplicates, including re-creating an archived supplier. If two real branches share a name, distinguish them ("ABC Computers - Sharjah"). This can be relaxed later.

## 4. Behaviours the model is built for

**Confirm item** (one transaction, in the service layer): requires a linked ACTIVE product; if a price exists a currency must be present; creates a `PriceObservation` only when a price exists and a `StockObservation` only when quantity or status is known (never an all-unknown row); both take the evidence's `observed_at`; sets `CONFIRMED` + `confirmed_at/by`; writes audit rows.

**Retract / reopen.** Reopening a confirmed item retracts its observations (`retracted_at/by/reason`). They remain visible in history (struck-through) and are excluded from "latest". Retraction is one-way; a fix is a new confirmation, which creates new observations. The partial unique indexes below allow at most one *active* observation per item.

**Latest per supplier** (product page):
```sql
SELECT DISTINCT ON (supplier_id) *
FROM price_observations
WHERE product_id = $1 AND retracted_at IS NULL
ORDER BY supplier_id, observed_at DESC, created_at DESC;
```
Stock is the same query on `stock_observations`. Price and stock "latest" are independent (a supplier's newest price and newest stock may come from different broadcasts).

**No cross-supplier "best price".** Prices differ in currency and VAT state and are not comparable without that context. The UI shows each latest observation as stated.

**Matching** (service layer, `products/matching`): exact normalised part number, then normalised model (+brand when known), then alias, then manual. A single strong hit *pre-links* the item (`match_basis` recorded) but it stays `PENDING` until a human confirms; several hits are shown as candidates and never auto-picked.

**Normalisation** (in `lib/normalize`, unit-tested):
- `normalizeName` (brand, category, supplier): Unicode NFKC, trim, collapse whitespace, lower-case.
- `normalizeCode` (part number, model, alias): NFKC, upper-case, strip every non-alphanumeric. `83A100-SUAK` and `83a100 suak` both become `83A100SUAK`.

## 5. Hand-written SQL (appended to the first migration)

Prisma cannot model these. They are part of the migration history, so a fresh `prisma migrate deploy` produces them. **Never use `prisma db push`.**

```sql
-- CHECK constraints ----------------------------------------------------------
ALTER TABLE price_observations
  ADD CONSTRAINT price_observations_amount_nonneg CHECK (amount >= 0),
  ADD CONSTRAINT price_observations_currency_fmt CHECK (currency_code ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT price_observations_retraction_all_or_none
    CHECK ((retracted_at IS NULL) = (retracted_by_id IS NULL));

ALTER TABLE stock_observations
  ADD CONSTRAINT stock_observations_quantity_nonneg CHECK (quantity IS NULL OR quantity >= 0),
  ADD CONSTRAINT stock_observations_not_all_unknown CHECK (quantity IS NOT NULL OR status <> 'UNKNOWN'),
  ADD CONSTRAINT stock_observations_retraction_all_or_none
    CHECK ((retracted_at IS NULL) = (retracted_by_id IS NULL));

ALTER TABLE broadcast_items
  ADD CONSTRAINT broadcast_items_quantity_nonneg CHECK (quantity IS NULL OR quantity >= 0),
  ADD CONSTRAINT broadcast_items_price_nonneg CHECK (price_amount IS NULL OR price_amount >= 0),
  ADD CONSTRAINT broadcast_items_currency_fmt CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT broadcast_items_source_lines
    CHECK (source_line_start IS NULL OR source_line_end IS NULL OR source_line_end >= source_line_start),
  ADD CONSTRAINT broadcast_items_confirmed_has_product
    CHECK (review_status <> 'CONFIRMED' OR product_id IS NOT NULL),
  ADD CONSTRAINT broadcast_items_confirmed_price_has_currency
    CHECK (review_status <> 'CONFIRMED' OR price_amount IS NULL OR currency_code IS NOT NULL);

-- At most one ACTIVE observation per broadcast item ---------------------------
CREATE UNIQUE INDEX price_observations_one_active_per_item
  ON price_observations (broadcast_item_id)
  WHERE broadcast_item_id IS NOT NULL AND retracted_at IS NULL;
CREATE UNIQUE INDEX stock_observations_one_active_per_item
  ON stock_observations (broadcast_item_id)
  WHERE broadcast_item_id IS NOT NULL AND retracted_at IS NULL;

-- Append-only tables ---------------------------------------------------------
CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER evidence_sources_append_only
  BEFORE UPDATE OR DELETE ON evidence_sources FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Observations: immutable except one-way retraction ---------------------------
CREATE FUNCTION guard_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DELETE on % is not allowed: observations are retracted, never deleted', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.retracted_at IS NOT NULL THEN
    RAISE EXCEPTION 'observation % is already retracted and cannot change', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - 'retracted_at' - 'retracted_by_id' - 'retraction_reason')
     IS DISTINCT FROM (to_jsonb(OLD) - 'retracted_at' - 'retracted_by_id' - 'retraction_reason') THEN
    RAISE EXCEPTION 'only the retraction columns of % may be updated', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER price_observations_guard
  BEFORE UPDATE OR DELETE ON price_observations FOR EACH ROW EXECUTE FUNCTION guard_observation();
CREATE TRIGGER stock_observations_guard
  BEFORE UPDATE OR DELETE ON stock_observations FOR EACH ROW EXECUTE FUNCTION guard_observation();

-- Parser output is write-once --------------------------------------------------
CREATE FUNCTION guard_item_extracted_data() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.extracted_data IS NOT NULL AND NEW.extracted_data IS DISTINCT FROM OLD.extracted_data THEN
    RAISE EXCEPTION 'broadcast_items.extracted_data is write-once' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER broadcast_items_extracted_data_guard
  BEFORE UPDATE ON broadcast_items FOR EACH ROW EXECUTE FUNCTION guard_item_extracted_data();
```

Notes: row-level triggers do not block `TRUNCATE`, so test-database cleanup works. Dev reset uses `prisma migrate reset` (drops and recreates the schema). Both are explicit, destructive dev-only actions and must never be pointed at data that matters.

## 6. Deletion and archive strategy

| Data | Strategy |
|---|---|
| Supplier, contact, product, brand, category | `status` ACTIVE / INACTIVE / ARCHIVED. Never hard-deleted. Archived rows are hidden from pickers and lists by default but keep their history. |
| Broadcast | `archived_at`. Never hard-deleted. |
| Broadcast item | Reviewed via `review_status` (PENDING / CONFIRMED / IGNORED). Never deleted. |
| Evidence source, audit log | Append-only (trigger). |
| Price / stock observation | Append-only, retraction only (trigger). |
| Product alias | Hard-deletable (naming metadata); the removal is audited with the before-value. |
| Association rows (supplier-brand etc.) | Hard-deletable (metadata); changes are audited. |

## 7. Audit conventions

`AuditLog(actor_id, action, entity_type, entity_id, scope_type, scope_id, details, created_at)`.
- `action` is a namespaced string defined in one code file (typed union), e.g. `supplier.created`, `supplier.updated`, `supplier_contact.archived`, `product.created`, `product_alias.added`, `broadcast.created`, `broadcast_item.updated|linked|confirmed|ignored|reopened`, `observation.created|retracted`.
- `details` carries `{ field: { from, to } }` diffs plus reasons. Enough for correction and match history now; richer snapshots can be added without a schema change.
- `scope_*` names the owning aggregate so an entity's Activity tab includes its children (a contact edit has scope = its Supplier; an item confirmation has scope = its Broadcast). Query: `(entity_type, entity_id) = X OR (scope_type, scope_id) = X`.
- Audit rows are written **in the same transaction** as the change, by an explicit `writeAudit(tx, ...)` call (no hidden ORM middleware).

## 8. Compatibility with the master plan (`PROJECT_PLAN.MD` §81)

| Future area | Fit |
|---|---|
| Customer, Enquiry, EnquiryItem, EmailMessage/Attachment | New tables. Email/enquiry evidence adds a new `EvidenceKind`; nothing existing changes. |
| ProductMatch, ProductSpecification, SupplierTerm | Additive tables. Current match history is in `AuditLog` and `match_basis`. |
| Product merge | Additive `Product.merged_into_id`. |
| Sourcing, RFQ, ProcurementDecision, Quotation | Reference `Product`, `Supplier`, `PriceObservation`, `EvidenceSource` by FK. Decision snapshots can freeze observation ids. |
| Role, Permission, real auth | `User` gains credentials and roles. Services already take an `actor`. |
| Memory / KnowledgeEntry / EntityRelationship | Reference any row by `(entity_type, entity_id)`. `EvidenceSource` is the provenance anchor. |
| pgvector | A column or table added by migration when semantic retrieval is active. Nothing needed now. |
| Agents (actor type) | `AuditLog.actor_id` gains an `actor_type` when agents exist. |
| Observation extras (condition, market, warranty, lead time, MOQ) | Additive nullable columns (see `docs/ideas/BACKLOG.md`). |

## 9. Deliberately not modelled yet

Roles/permissions, sessions/credentials, dictionaries (scoring phrase lists are code, section 11), spec attributes, supplier term history, attachments (metadata only for email, section 11), jobs, LLM/agent/memory tables, category hierarchy. (Customers, enquiries and email were added on 2026-09-20: section 11.)

## 10. Review focus (please check these first)

1. **Global-unique `normalized_part_number`** on Product. Alternative: unique `(brand_id, normalized_part_number)`, which does not protect products with no brand.
2. **Supplier `normalized_name` unique across all statuses.** Blocks same-named branches unless the names are distinguished.
3. **Retraction** as the correction path, and the **observation guard trigger** that makes observations immutable except for retraction.
4. **`AuditLog.scope_*` columns**, added beyond the original entity list so Activity tabs work without JSON queries.
5. **Contact-level brand/category join tables** (two extra tables, required by CURRENT.md §6).
6. **Currency is never defaulted in the database.** The review form pre-selects AED visibly and a human confirms.
7. **`is_temporary` product flag** vs. a richer product lifecycle.
8. **Procurement profile as free text on `Supplier`** (payment/credit/warranty/delivery). Numeric credit limit/period and term history are deferred.

## 11. Enquiry Intelligence additions (2026-09-20)

Migration `20260920120000_enquiry_email_intelligence`. Additive only: six tables, six enums, two `EvidenceKind` values (`CUSTOMER_ENQUIRY`, `CUSTOMER_EMAIL`). Nothing existing was altered. Plan: `docs/plans/active/CURRENT.md`.

```
Customer ──< CustomerContact
Enquiry >── Customer (optional)      Enquiry >── CustomerContact (optional)      Enquiry >── User (assignee, optional)
EvidenceSource ──1:1── Enquiry ──< EnquiryItem >── Product (optional link)
EmailAccount ──< EmailMessage ──1:1── EvidenceSource          EmailMessage ──0..1:1── Enquiry (when an enquiry was created from it)
```

| Table | Notes |
|---|---|
| `customers`, `customer_contacts` | Modelled on suppliers, simpler (no brand/category links). Name unique by `normalized_name` across all statuses. `customer_contacts.normalized_email` (lower-cased by the service) is how an email sender is recognised as a known customer. |
| `enquiries` | `number` is a serial shown as `ENQ-00012`. `evidence_source_id` is unique (1:1 with the immutable request). Customer, contact and assignee are optional. `requester_name` / `requester_email` keep an unknown sender as written (no customer is invented); a person can promote them to a customer. `extracted_data` holds the parser's original header suggestions, write-once. `last_activity_at` is maintained by the services and drives inbox ordering. Priority defaults to NORMAL and status to NEW; the 11 statuses are operational and set by people. |
| `enquiry_items` | Mirrors `broadcast_items`: `extracted_data` (write-once) holds `{ parser, version, reasons, hints, fields }`, the typed columns are the current values, `review_status` PENDING / CONFIRMED / IGNORED. Confirming creates **no observations**; a linked product is optional. Detected specs (cpu, ram, storage, os) stay in `extracted_data.hints`. |
| `email_accounts` | `password_encrypted` is AES-256-GCM (`v1:iv:tag:ciphertext`), key in `.env`, never selected except by the sync / test paths. `normalized_key` (host, username, folder lower-cased) makes "already connected" a unique constraint. `uid_validity` and `last_uid` are the sync cursor. `sync_lease_until` is a compare-and-set lease so two syncs cannot overlap. |
| `email_messages` | One row per ingested message. `raw_source` (`bytea`, NULL above 20 MB, then `parse_error` says so), normalised headers and addresses, clean `text_body`, attachment **metadata only**, `score` (0-100), `score_reasons` (every rule that fired) and `band`. `evidence_source_id` is unique: the email's clean text is an `EvidenceSource` (`CUSTOMER_EMAIL`, channel EMAIL, header block then body) whose `observed_at` is the received time. Triage state (`triage_status`, `dismissed_*`, `enquiry_id`) is the only mutable part. |

**Database guards** (in the migration, hand-written):

| Guard | Effect |
|---|---|
| `guard_extracted_data_write_once()` on `enquiries` and `enquiry_items` | The parser's original output cannot change. |
| `guard_email_message()` on `email_messages` | UPDATE may only touch `triage_status`, `dismissed_at`, `dismissed_by_id`, `dismissed_reason`, `enquiry_id`; DELETE is refused. Emails are evidence. |
| CHECK `enquiry_items_quantity_positive`, `..._source_lines`, `..._confirmed_has_identity` | Quantity is > 0 when present; a confirmed item has a description, model or part number. |
| CHECK `email_accounts_port_range`, `email_messages_score_range`, `..._raw_size`, `..._triage_consistency` | `enquiry_id` is set exactly when `triage_status = ENQUIRY_CREATED`; DISMISSED requires a time and a reason. |
| Partial unique `email_messages (account_id, message_id) WHERE message_id IS NOT NULL` | The same message is never stored twice (plus the `(account, folder, uid_validity, uid)` unique). |

**Deliberate choices.**
- An enquiry created from an email **reuses** the email's evidence row (both `evidence_source_id` columns are unique, so an email has at most one enquiry). The MIME stays in `email_messages`, the clean text in the evidence.
- Notes on an enquiry are append-only `enquiry.note_added` audit entries, not a table. The timeline is the audit log scoped to the enquiry.
- A remembered alias from an enquiry item records its provenance in the audit entry only: `product_aliases.source_broadcast_item_id` still points only at broadcast items.
- Scoring bands are stored per message at ingest (so the queue is an indexed query); the thresholds live in `modules/email/scoring/config.ts`. Changing them does not re-score stored mail.

## 12. Sourcing requests (2026-09-21)

Migration `20260920212219_supplier_requests`. Additive only: one table, one enum, one nullable column, two triggers. Nothing existing was altered or dropped. Plan: `docs/plans/completed/2026-09-21-sourcing-requests.md`.

```
Enquiry ──< SupplierRequest >── Supplier         SupplierRequest >── SupplierContact (optional)
SupplierRequest ──< Broadcast   (a supplier's reply is a broadcast with supplier_request_id set)
```

| Item | Notes |
|---|---|
| `supplier_requests` | "We asked this supplier about this enquiry." **Unique `(enquiry_id, supplier_id)`**: one row per supplier per enquiry (a chase is a note, not a second row). `status` is `DRAFT`, `SENT`, `REPLIED`, `NO_STOCK` or `DECLINED`. "Waiting" is `SENT`; how long is read from `sent_at`. `channel` (reuses `PreferredChannel`), `message_text`, `sent_at` and `sent_by_id` are NULL until sent. All FKs are `Restrict`. |
| `broadcasts.supplier_request_id` | Nullable FK (`Restrict`), indexed. Set when a broadcast is a reply to a request. |
| Enum `SupplierRequestStatus` | `DRAFT`, `SENT`, `REPLIED`, `NO_STOCK`, `DECLINED`. `REPLIED` is set only by recording a reply; `NO_STOCK` / `DECLINED` are set by a person and create no observation. |

**Database guards** (in the migration, hand-written):

| Guard | Effect |
|---|---|
| CHECK `supplier_requests_sent_together` | `sent_at`, `message_text` and `sent_by_id` are all NULL or all set. |
| CHECK `supplier_requests_sent_status`, `..._channel_needs_sent`, `..._message_not_blank` | A `SENT` request has a sent time; a channel needs a sent time; the sent text is never blank. |
| `guard_supplier_request()` on `supplier_requests` | Once sent, the message, time, sender and channel cannot change, and the row cannot be deleted. Status and note may still change. A draft may be deleted. |
| `guard_broadcast_request_supplier()` on `broadcasts` | A reply's supplier must be the supplier of the request it points at. |

**Deliberate choices.**
- **A reply is a broadcast.** The existing parser, review workspace, confirm, retraction and evidence drawer are reused unchanged; no new evidence kind. The request page derives what came back from the linked broadcasts.
- The text that was sent is stored on the request itself (subject line, blank line, body). It is our outbound message, not supplier evidence, and is write-once.
- No stored RFQ status beyond the five above, no RFQ number, no per-supplier line selection: every confirmed requirement is in the message, which the buyer may edit before copying. Follow-up dates, comparison and the decision snapshot are in `docs/ideas/BACKLOG.md`.
- The request message is built from confirmed requirements only and its input has no customer field, so the customer's name, email and enquiry reference cannot appear in it.
- Audit: `supplier_request.added|removed|sent|status_changed`, scoped to the enquiry (they appear on its Activity timeline). Recording a reply also writes `broadcast.created` with the request id.

## 13. Procurement decisions (2026-09-21)

Migration `20260920231037_procurement_decisions`. Additive only: one table, two triggers/indexes, nothing existing altered. Plan: `docs/plans/active/CURRENT.md`.

```
EnquiryItem ──< ProcurementDecision >── Supplier
ProcurementDecision >── PriceObservation (optional)      ProcurementDecision >── StockObservation (optional)
```

| Item | Notes |
|---|---|
| `procurement_decisions` | "We chose this supplier for this requirement." `enquiry_item_id`, `supplier_id`, optional `price_observation_id` / `stock_observation_id` (what the buyer saw; NULL = none on record), `note`, `decided_by_id`, `created_at`, and the retraction columns (`retracted_at`, `retracted_by_id`, `retraction_reason`). All FKs `Restrict`. |

**Database guards** (in the migration, hand-written):

| Guard | Effect |
|---|---|
| CHECK `procurement_decisions_retraction_all_or_none` | `retracted_at` and `retracted_by_id` are both set or both NULL. |
| Partial unique index `procurement_decisions_one_active_per_item` | At most one **active** (not retracted) decision per requirement. |
| `guard_procurement_decision()` on INSERT | The supplier must have a `supplier_requests` row on the requirement's enquiry; a price or stock observation must belong to that supplier **and** to the requirement's product. |
| `guard_procurement_decision()` on UPDATE / DELETE | Only the retraction columns may change, a retracted decision is frozen, and a decision is never deleted. |

**Deliberate choices.**
- **The snapshot is a pointer, not a copy.** Observations are immutable (`guard_observation`), so pointing at the price and stock observation the buyer saw freezes what was known at that moment. "When chosen" is read straight from those rows even after the supplier quotes something newer.
- **Replace or clear = retract**, never edit or delete (the same rule as observations). Choosing another supplier retracts the earlier decision in the same transaction; the reason is "Replaced by a new choice".
- **No ranking, no best price.** The comparison is the existing "latest price and stock per supplier" for the enquiry's suppliers; the app records only the person's decision.
- Terms such as warranty, quantity agreed and credit go in the free-text `note`. Numeric terms are in `docs/ideas/BACKLOG.md`.
- Audit: `procurement_decision.chosen|cleared` (entity `ProcurementDecision`), scoped to the enquiry so they appear on its Activity timeline; a replacement is one `chosen` entry that names the supplier it replaced.

## 14. Sign-in and roles (2026-09-21)

Migration `20260921005746_sign_in_and_roles`. Additive: one enum, five columns on `users`, one table. Existing rows only receive the column defaults (role `STAFF`, counters 0, no password); the admin role and password are set by first-time setup. Decision: `docs/decisions/0006-sign-in-and-roles.md`.

| Item | Notes |
|---|---|
| Enum `UserRole` | `ADMIN`, `STAFF`. |
| `users.password_hash` | Nullable. `scrypt$N$r$p$salt$hash`. NULL = cannot sign in. Never selected except by the sign-in and password services; queries return only "has a password". |
| `users.role` | `UserRole`, default `STAFF`. |
| `users.last_login_at`, `failed_login_count`, `locked_until` | Sign-in bookkeeping. 5 consecutive wrong passwords set `locked_until` (15 minutes) and reset the count. |
| `sessions` | `id`, `user_id` (`Cascade`), `token_hash` (**unique**, SHA-256 of the cookie's token; the token itself is never stored), `created_at`, `expires_at`, `last_used_at`. Indexed on `user_id` and `expires_at`. Ended sessions of a person are tidied up when they sign in. |

**Database guards** (in the migration, hand-written):

| Guard | Effect |
|---|---|
| CHECK `users_failed_login_count_nonneg` | The counter never goes negative. |
| `guard_last_admin()` on `users` (BEFORE UPDATE) | An update that would demote or deactivate the last active admin is refused, so nobody can lock everyone out. |

**Deliberate choices.**
- **Sign-in is on once an active admin has a password.** Before that the old development-user behaviour applies. There is no "auth enabled" flag to forget: it is derived from the data.
- **Setup takes over the existing user** (same id), so every `audit_logs.actor_id` and `created_by_id` already written stays with the same person.
- Users are never deleted (every business table points at them with `Restrict`); a person who leaves is deactivated (status `INACTIVE`) and keeps their history.
- Audit: entity `User`, actions `user.created|updated|password_changed|password_reset|status_changed|signed_in`. Details never contain a password or hash.

## 15. Quotations (2026-09-21)

Migration `20260921120000_quotations`. Additive only: one enum, two tables, one partial index, two triggers, CHECKs; nothing existing altered. Plan: `docs/plans/active/CURRENT.md`. Module: `docs/modules/QUOTATIONS.md`.

```
Enquiry ──< Quotation ──< QuotationLine >── EnquiryItem (optional)
Quotation >── Customer (optional)      QuotationLine >── PriceObservation (optional: the cost)
```

| Item | Notes |
|---|---|
| Enum `QuotationStatus` | `DRAFT`, `ISSUED`, `SUPERSEDED`. |
| `quotations` | `number` (serial, internal identity shared by revisions) with `revision` (from 1), unique together; `quote_date` and `quote_seq` (the day it was made in the business timezone and that day's counter), unique with `revision`, which make the reference people see, `QUO-20260921-0001`. `enquiry_id`, optional `customer_id`; text snapshots `customer_name`, `contact_name`; `status`; `currency_code` (default `AED`), `vat_percent` (default 5); `valid_until` (date); `payment_terms`, `delivery_terms`, `notes` (the customer sees these); `issued_at` / `issued_by_id`, `superseded_at`; `created_by_id`, timestamps. All FKs `Restrict`. |
| `quotation_lines` | `quotation_id`, `position` (unique together), optional `enquiry_item_id`, `description`, `part_number`, `quantity`, `unit_price`, `markup_percent`, optional `cost_price_observation_id`. All FKs `Restrict`. |

**Database guards** (in the migration, hand-written):

| Guard | Effect |
|---|---|
| CHECKs on `quotations` | Revision at least 1; currency is three capital letters; VAT 0 to 100; the issue time and issuer go together; a draft has no issue time and every other status has one; only a superseded quotation has `superseded_at`. |
| CHECKs on `quotation_lines` | Quantity above zero; price not negative; markup not below -100; description not blank. |
| Partial unique index `quotations_one_draft_per_enquiry` | At most one draft per enquiry. |
| `guard_quotation()` | Never deleted. Inserted only as a draft. `number`, `revision`, `enquiry_id` and creator never change. A draft may change freely, or become issued: that needs a customer name, a valid-until date, at least one line, and a quantity and a price on every line. An issued quotation can only become superseded (nothing else changes). A superseded one is frozen. |
| `guard_quotation_line()` | A line can be added, changed or removed only while its quotation is a draft; it cannot move to another quotation; its requirement must belong to the quotation's enquiry. |

**Deliberate choices.**
- **Cost is a pointer, not a number.** A line's cost, supplier and VAT state are read through `cost_price_observation_id` (a supplier price observation, immutable), so cost cannot drift and is never typed. NULL means no cost on record. A cost in another currency than the quotation keeps its pointer but has no markup: there is no conversion.
- **What the customer reads is copied**, not linked: customer and contact names, line text, quantity and price live on the quotation, so a later change to the enquiry or customer cannot alter an issued quotation.
- **Markup is stored next to the price** but only when the cost is comparable (same currency). The service recomputes one from the other (`pricing.ts`); the database does not check they agree, so a price typed by hand with a cost is re-derived on save.
- **Issue freezes, Revise is the only way on.** A revision is a new row with the same `number` and `revision + 1`, copied from the issued one, which becomes superseded and stays exactly as it was issued. Quotations are never deleted; draft lines can be (a draft is working state, not what the customer saw), and each removal is audited.
- **The customer's copy is a separate query** (`getQuotationForPrint`) whose select names only customer-visible columns, so supplier, cost, markup and margin cannot reach the print page.
- Audit: `quotation.created|updated|line_added|line_updated|line_removed|issued|revised` (entity `Quotation`), scoped to the quotation, so they show on its own Activity timeline and on the Audit page.

**Addendum, manual quotation and direct confirmation (2026-09-21).** Migration `20260921150000_manual_quotation_and_confirmation`, additive: `EvidenceKind` gains `SUPPLIER_CONFIRMATION` (a supplier's price or stock confirmed directly and typed in by a person; its `raw_text` is a written record of what was entered, with the required note); `EvidenceChannel` gains `PHONE`; `quotations.enquiry_id` becomes nullable (a manual quotation has no enquiry). The one-draft-per-enquiry partial unique index does not apply to a NULL enquiry, and `guard_quotation_line` still refuses a requirement on a quotation with no enquiry. A direct confirmation is stored exactly like other supplier evidence: evidence, a broadcast, a confirmed broadcast item, and the price and stock observations, so it is retracted the same way.

**Addendum, quotation reference by date (2026-09-21).** Migration `20260921170000_quotation_reference_by_date`: `quotations` gains `quote_date` (DATE) and `quote_seq` (INTEGER, at least 1), unique together with `revision`. The reference is `QUO-YYYYMMDD-NNNN` (the date is the day the quotation was created in Asia/Dubai; the counter restarts at 0001 each day; a revision keeps both and shows `rev 2`). The counter is taken inside the creating transaction under an advisory lock (`pg_advisory_xact_lock`), so two people creating at the same moment cannot get the same number. Existing quotations were backfilled from their creation day in the old number order; the issued-quotation guard was paused for that one statement, which set only the two new columns. `number` stays as the internal identity. Audit rows written earlier keep the old wording in their text.

## 16. Outgoing email (2026-09-21)

Migration `20260921190000_outgoing_email`. Additive: one enum, two tables, one column on `users`. Decision: `docs/decisions/0008-outgoing-email-and-pdf.md`.

| Item | Notes |
|---|---|
| `smtp_accounts` | An outgoing mailbox: `label`, `host`, `port`, `security`, `username`, `password_encrypted` (AES-256-GCM, write-only, never selected except by the send and test services), `from_name`, `from_address`, `reply_to`, `default_bcc`, `status`, `last_test_at` / `last_test_status` / `last_test_error`, `created_by_id`. One `ACTIVE` at a time (partial unique index `smtp_accounts_one_active`). |
| `sent_emails` | An email the app sent or tried to send: `smtp_account_id`, optional `quotation_id` and `customer_id`, `to_addresses` / `cc_addresses` / `bcc_addresses` (JSON arrays), `subject`, `body_text`, the attachment (`attachment_name`, `attachment_size`, `attachment_sha256`, `attachment_bytes`), `message_id`, `status` (`SENT`, `FAILED`), `error`, `sent_by_id`. All FKs `Restrict`. |
| `users.email_signature` | Optional plain text under that person's emails. |

**Guards.** CHECKs: port 1 to 65535, a from address with an `@`, at least one recipient, `error` present exactly when `FAILED`, attachment name, hash and bytes all present or all absent. `guard_sent_email()` refuses any UPDATE or DELETE on `sent_emails`.

**Choices.** The exact PDF is stored with the email, so what a customer received can always be opened again (`/sent-emails/[id]/attachment`). Sending writes one audit row (`quotation.emailed` / `quotation.email_failed`, entity Quotation, scope Customer when there is one), so it appears on the quotation's and the customer's Activity.
