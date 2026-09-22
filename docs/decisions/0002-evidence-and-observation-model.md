# 0002. Evidence and observation model

**Status:** Accepted (2026-09-20)

## Context
Supplier prices and stock change constantly and arrive as informal text. The business must be able to answer "why do we believe this price?" and must never lose or silently overwrite what a supplier said.

## Decision
- **Prices and stock are observations**: product + supplier + value + `observed_at` + evidence. No price or stock column on `Product`.
- **`EvidenceSource` is a separate, generic, immutable table** (raw text, hash, channel, `observed_at`). `Broadcast` is the mutable workflow wrapper. Observations reference evidence with a NOT NULL FK.
- **`observed_at` is the supplier's time**, not our entry time. Freshness and "latest" use it.
- **Parser output is a proposal.** `BroadcastItem.extracted_data` holds the original (write-once); typed columns hold the current reviewed values; `AuditLog` records field diffs. Observations are created only when a human confirms.
- **Corrections are retractions.** A wrong confirmation is retracted (kept, excluded from "latest"), never edited or deleted. A trigger enforces that observations change only by one-way retraction.
- Immutability and integrity rules are enforced in PostgreSQL (append-only triggers, CHECKs, partial unique indexes), not only in application code.

## Consequences
- Full price history and provenance for free; later evidence kinds (email, quotations) reuse the same anchor.
- Slightly more machinery than a single price column: "latest per supplier" is a `DISTINCT ON` query, and reopening an item is a retract + re-confirm flow.
- Raw SQL in migrations must be maintained by hand; `prisma db push` is forbidden.
- Cross-supplier "best price" is intentionally not computed (currency and VAT state make prices non-comparable).
