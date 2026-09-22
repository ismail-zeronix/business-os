# Evidence model for AI answers

The AI layer adds **no new evidence table**. It cites what the application already records. See `docs/decisions/0002-evidence-and-observation-model.md` and `docs/architecture/DATA_MODEL.md`.

## What already exists

| Concept | Table | Guarantee |
|---|---|---|
| Raw artefact | `EvidenceSource` | Immutable (database trigger), content hash, kind, channel, `observedAt`, creator |
| Price fact | `PriceObservation` | Append-only, NOT NULL evidence, retractable but never edited |
| Stock fact | `StockObservation` | Same |
| Extraction | `BroadcastItem.extractedData`, `EnquiryItem` | Write-once, keeps parser name and version |
| Decision | `ProcurementDecision` | Keeps the price and stock the buyer actually saw |
| Change history | `AuditLog` | Append-only, actor and reason |

The prompt's proposed `Evidence` table maps onto these one for one, so adding it would duplicate a working model.

## How an answer cites evidence

Each `EvidenceReference` in the response carries type (`price_observation`, `stock_observation`, `evidence_source`), id, a human source label (for example "Supplier broadcast, 21 Sep 10:20"), supplier, and `observedAt`. The validator checks every reference against the evidence package, so an invented id fails the request rather than reaching the screen.

In the chat panel a reference opens the existing evidence drawer (`?evidence=`), which shows the original untouched message. The person can always read the source behind a sentence.

## Rules that constrain every answer

- **Preserve raw evidence.** Structured data is derived from it; the original is never rewritten.
- **Never overwrite history.** A mistake is retracted, not edited or deleted. The AI never proposes an edit to an observation.
- **Unknown stays unknown.** Missing quantity, VAT, warranty, currency or part number stays NULL or `UNKNOWN`, and the answer says so in `missingInformation`.
- **An offer is not confirmed stock.** A broadcast states availability at a moment; the answer must not upgrade that to a guarantee.
- **Freshness is from `observedAt`.** Age is always stated with a price or stock figure.
- **Never fabricate.** A product, price, stock, supplier or customer detail that is not in the package does not appear in the answer.

## Warranty (later)

Today warranty exists only as free text on `Supplier`. Until structured fields exist, an answer says "Warranty: not recorded" rather than inferring it. The planned model keeps brand warranty separate from supplier warranty, marks grey market, region-restricted, refurbished, open-box and non-branded distinctly, and always shows source, type, duration, verification date and status. That arrives with the broadcast intelligence stage.
