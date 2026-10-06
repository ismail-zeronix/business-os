# Module: Broadcasts

**Status:** Active (current milestone). This is the highest-value workflow: raw supplier text becomes reviewed, evidence-backed observations.

## Workflow

```
Create broadcast (supplier, optional contact, channel, received-at, raw text)
  -> EvidenceSource (immutable) + Broadcast saved
  -> deterministic parser proposes BroadcastItems        (or items are added manually)
  -> reviewer edits / links product / creates product / ignores
  -> Confirm  ->  PriceObservation and/or StockObservation (evidence-linked)
  -> (mistake?) Reopen -> observations retracted -> fix -> Confirm again
```

Reviewing can start with the **Table** view: every PENDING item in one dense editable table (all fields, including category and
warranty), corrected in bulk with **Apply all**. It only saves field corrections — it never links a product or confirms. The
per-item Review flow below is unchanged and still required to link products and confirm.

Reviewing can also skip the one-by-one loop: **"Confirm N ready items"** confirms every PENDING item already linked to an
ACTIVE product in one click (each item still goes through the same Confirm step and precondition checks above, just in a
loop — see "Confirm preconditions"). Items still needing a product link stay in the individual flow; picking the right
product is the one judgment call that stays manual. This business runs on a single currency (AED), so neither the bulk
action nor the single-item Confirm hold up on price or currency — see below.

## Replies to sourcing requests
A broadcast can be a supplier's **reply to a sourcing request** (`broadcasts.supplier_request_id`, see `docs/modules/ENQUIRIES.md`). It is created from the enquiry's Sourcing tab (**Record reply**), goes through exactly the same parser, review, confirm and retraction, and is marked with a "Reply to ENQ-…" pill. Creating it also sets the request to Replied in the same transaction. The database checks that the reply's supplier is the request's supplier.

## Owns
`Broadcast`, `BroadcastItem`, the parser, and the review workflow. Calls `evidence` (create), `products` (match, create product, alias), `observations` (create, retract), `audit`.

## Item lifecycle

| State | Meaning | Allowed next |
|---|---|---|
| PENDING | Proposal or manual entry awaiting a human | Edit, link/create product, Confirm, Ignore |
| CONFIRMED | Human verified; observations exist | Reopen (retracts observations) |
| IGNORED | Not relevant (`ignored_reason` optional) | Reopen to PENDING |

Confirm preconditions (enforced in the service and backed by CHECKs): a linked ACTIVE product; price and quantity >= 0. There
is always something to record: a price with no currency is recorded in AED (the item's own `currency_code` column is not
touched — only the observation resolves it, so a person can still fill it in later via Reopen), and an item with neither a
price nor an explicit stock signal is recorded with a stock observation of AVAILABLE (quantity stays unknown) rather than
being blocked — a supplier listing a product is itself evidence they carry it. Both defaults are flagged in the confirm audit
row's `inferredDefaults`. A confirmed item is locked: edit it by reopening first.

Progress ("3 pending, 8 confirmed, 1 ignored") is derived from items. There is no stored broadcast status.

## Parser (`modules/broadcasts/parsing`)
Pure functions behind `BroadcastParser { name, version, parse(rawText, { brands }) -> ParsedItem[] }`. Output is a **proposal**; nothing becomes truth until confirmed.

1. Normalise: NFKC, strip WhatsApp markup (`*bold*`, `_italic_`), bullets and emoji; keep original line numbers.
2. Split into blocks by blank lines. If a block has two or more item-like lines (model-ish token and price-ish token), each such line is an item; otherwise the whole block is one item. Example: the six-line `Dell 5440 / i7 16/512 / DOS / 25pc ready / 2450+ / UAE` is one item.
3. Extractors (independent, each records its matched span and a confidence):
   - **brand**: word-boundary match against the Brand master list.
   - **part number**: alphanumeric token with letters and digits, at least 6 characters, after removing recognised spec tokens (CPU, RAM, storage).
   - **quantity**: `25pc`, `25 pcs`, `qty 25`, `x25`. Never confuses `16GB` with a quantity.
   - **price**: currency-marked (`AED 2,450`), `@ 2450`, or a number with a trailing `+`. A bare 3-4 digit token next to a brand/family (a model number such as `5440`) is **not** treated as a price.
   - **VAT**: trailing `+`, `+vat`, `excl` => EXCLUDED; `incl vat` => INCLUDED; otherwise UNKNOWN. (The trailing-`+` rule is a documented market convention and is only a proposal.)
   - **currency**: only when written (AED, USD, $, Dhs). Never assumed by the parser.
   - **stock status**: `ready`/`in stock` => IN_STOCK; `available` => AVAILABLE; `limited`/`few` => LIMITED; `incoming`/`eta`/`in transit` => INCOMING; `on request`/`on order` => ON_REQUEST; `out of stock`/`oos`/`sold out` => OUT_OF_STOCK. Otherwise UNKNOWN.
   - **spec text**: CPU, RAM/storage (including `16/512` shorthand), screen, OS snippets joined into a readable string.
4. Ambiguity leaves the field NULL and lowers `extraction_confidence` (HIGH / MEDIUM / LOW). It never guesses.
5. The original output is stored write-once in `extracted_data`; the typed columns are then free for the reviewer to correct.

**Parser version 2 (2026-09-21), from real supplier messages** (a one-line 700-character Lenovo spec with the price on the next line, and a WhatsApp desktop list with title lines, `|` separators and part numbers at the end). Each rule below was checked against every saved message and the standard formats: nothing else changed.
- **A price on its own line after a blank line** belongs to the item above it when that item has no price (it used to become a separate item with no product). An item that already has a price is never touched.
- **Title line + detail line** (`DELL QCS1250|U5` then `Dell Pro Slim QCS1250|U5 235|16GB|...`): one product, not two. The detail line is read when it names the brand; otherwise the title is kept with it.
- **Model** is the first word with a digit plus up to two model-like words (with a digit, or "Gen"); it stops at a product-type word (desktop, SFF, tiny, TWR...), skips a word repeated from the title, and a `|` ends the product name (`Lenovo P16v G3| Intel Core...` gives `P16v G3`). If the part number sits right after the brand (`DELL QCT1250 DESKTOP`), it is also the model.
- **Not part numbers:** screen resolutions (`1920x1200`), IEEE standards (`802.11be`), memory layouts (`2x16GB`) and any number with a unit (`400nits`, `5.4GHz`, `140W`).
- **Not stock:** "AI-Ready" / "AI Ready" (an NPU feature); "25pc ready" is still ready stock.
- **CPU shorthand:** `U5 235`, `U7-265`, `U7 -265T` (Core Ultra) and `I7- 12700` (space after the hyphen).
- **A number at the very end of a line straight after a part number** (`... QCS1250U516GUAR 2644`) is proposed as the price: low confidence, currency left unknown.
- **`SUPPLIER :` / `CONTACT :` / `COMPANY :` / `ATTN :` / `VENDOR :` lines** say who sent it, not what is for sale: they are read as blank lines. (They stay in the saved text, which is the evidence.) The same lines fill the form's Supplier and Contact when exactly one record has that name (`parsing/header-lines.ts`: `readHeaderNames`, `matchExactlyOne`; the label words live there once and are shared by the parser, the form and the @ mentions). See `docs/design/SCREENS.md`.

**Parser version 3 (2026-09-21), from the Buraqa Star Computer Trading WhatsApp list** (27 Lenovo laptops, one per line, an emoji bullet on each, **no prices and no quantities**, `SUPPLIER :` / `CONTACT:` footer). Checked against all 12 saved supplier broadcasts: only the ThinkPad / Yoga model names, Backlit and `512SSD` changed (older saved items keep their stored values; only new parses use v3).

*Noise removed before matching* (the saved text is never changed, this only affects `clean`): emoji bullets such as 📗 (any pictograph), mathematical-alphabet letters (`𝙱𝚄𝚁𝙰𝚀𝙰` becomes `BURAQA` by NFKC, so the supplier name in the footer still matches a saved supplier), and **inch marks written as two apostrophes or a curly quote** (`14’’`, `14''`, `14”` become `14"`).

*Rules added, all "keep what was written, guess nothing":*
- **Model keeps the series word.** `THINKBOOK 14 G8`, `THINKPAD E16 G3`, `IP3 SLIM`, `Yoga 7i` (series words: ThinkBook, ThinkPad, IdeaPad, ThinkCentre, ThinkStation, Legion, Yoga, LOQ). `SLIM`, `Gen` and Lenovo platform codes (`IRL`, `IAL`, `IRU`, `IAP`, `ITL`, `IAH`, `IRH`, `ABP`, `ARP`) after the size belong to the model (`THINKBOOK 16 G8 IAL`, `V15 G4-IRU`). A series-plus-size token (`THINKBOOK14-G8`, `THINKBOOK-16`) is a model, never a part number.
- **Storage type.** Capacity glued to the drive type with no unit (`512SSD`, `256 SSD`) is spec text as written; the unit (GB) is not assumed. It is no longer a part number.
- **CPU.** `ULTRA7-255H`, `ULTRA 5-225U`, `ULTRA-7 256V`, `Ultra 7 255H` and `I5-1135G7` are read whole.
- **Keyboard and box contents.** `BACKLITE`, `BACKLIT`, `BKLT` = backlit keyboard; `+BAG` = a bag in the box. The words stay in the spec text, and `hints.keyboard = "Backlit"` / `hints.accessories = "Bag"` are kept in the item's extracted data (no typed columns yet).
- **A list with no prices** gives items with no price, no quantity and stock UNKNOWN (confidence LOW). Confirming such an item records a default stock observation of AVAILABLE (see "Confirm preconditions" above) rather than a specific count — it is a record of what the supplier lists, not of a price or of a count.

*Known effect:* the product matcher compares the model exactly, so a product saved earlier as `E16` or `T16 GEN 6` does not auto-link to a new `ThinkPad E16` / `THINKPAD T16 GEN 6` line. The reviewer links it once with "remember this wording" and the alias covers it from then on.

Manual entry is always available ("Add item"), so parser quality never blocks the workflow. An LLM may later implement the same interface as an optional extractor; it would still only propose.

**Parser version 4 (2026-09-23), category and warranty from the real broadcasts already in the database.** Checked against all 13 saved broadcasts (214 items).
- **Category**, resolved against the live Category master list (like brand): the leading word of the item's text wins outright when it matches a known category word (`LAP`, `MONITOR`, `DESK`/`DESKTOP`, `SERVER`, `WORKSTATION`, plus `NOTEBOOK`, `PRINTER`, `CCTV`, `NAS`/`STORAGE`, `SWITCH`/`ROUTER`/`NETWORKING`) — this is what makes "LAP HP MOBILE WORKSTATION ZBook..." file as Laptop, matching the supplier's own tag, even though "workstation" also appears later in the line. Otherwise the rest of the text is scanned once; more than one distinct category found there is left unresolved rather than guessed.
- **Warranty duration**: `1YR`, `3YR`, `1Yr`, `2YR`, `1 Year`, `3YEAR`, `3 Year`, `3 YRS` all read as years x 12 months.
- **Warranty type**, checked in order so the more specific physical descriptor wins when both appear ("Onsite NBD" reads as On-site): On-site (`onsite`, `on-site`), Carry-in (`carry-in`, `carryin`), Return-to-base (`rtb`, `return to base`, `depot`), Next business day (`nbd`, `next business day`). A bare "Warranty" with no duration or recognised type extracts nothing.

## Warranty
Warranty duration (months) and type live on `BroadcastItem` (reviewer-editable while PENDING) and are copied onto `PriceObservation` at Confirm — a term of that specific priced offer, not of stock. An item with warranty wording but no price creates no `PriceObservation`, so nothing structured is recorded for it (the wording stays visible in the raw evidence and the item's spec text). This is independent of `Supplier.warrantyNotes`, which remains the supplier's general free-text policy.

## Matching
After parsing, the matcher runs (`products/matching`): part number, then model (+brand, also by canonical model key since 2026-10-06 — "Gen 7" = "G7"), then alias. A single strong hit pre-links the item and records `match_basis`, but the item stays PENDING. Several hits are shown as candidates and never auto-picked — the reviewer can search, link, or create a product inline (drawer prefilled from the item). **Zero hits** auto-creates a TEMPORARY product from the item's own text (description, or brand + model) and links it (`match_basis` = `NEW_PRODUCT`) instead of waiting for a click — "whatever a supplier pastes is a product." A part-number collision at that instant (e.g. with an archived product) leaves the item unlinked for a person instead of failing the save. Linking (by search, or the drawer) has a "remember this wording as an alias" toggle; the alias stores its source item as provenance.

**Side effect of the 2026-10-06 canonical-key widening:** a line whose model now matches an existing product only by canonical key (not a strong-enough hit for `pickAutoLink` to pre-link alone) moves from "zero hits -> auto-create a new temporary product" to "several/weak hits -> left unlinked for a person to search, link, or create" (`resolveProductForItem`, `src/modules/broadcasts/service.ts`). Intentional and in keeping with "parsers propose; humans confirm" — it avoids creating a duplicate temporary product for a model already in the catalog under a different Gen/G spelling — but it is a real change in which lines get auto-created vs. left pending, not only in which enquiries get a candidate. Existing broadcast tests are unaffected (none of their fixtures collide on a canonical key); watch the auto-create vs. auto-link counts on the next real supplier list.

When several candidates share a name (e.g. multiple "IP3 SLIM" products with different CPU/RAM/display), the picker shows each candidate's own spec text (from its most recently confirmed item) next to the item being reviewed, with tokens that don't appear on the current item flagged — a display aid only, computed from the parser's existing `spec_text`, no dictionary or matching change (`broadcasts/queries.ts:getCandidateSpecs`, `broadcasts/components/product-linker.tsx`). See `docs/ideas/BACKLOG.md` "Products and search" for the larger, deferred spec-dictionary idea this is a smaller step toward.

## Duplicates
Saving computes a hash of the whitespace-normalised text. If the same supplier already has that hash, the user is warned and may proceed. It is never blocked.

## Audit actions
`broadcast.created|archived|bulk_confirmed`, `broadcast_item.created|updated|linked|confirmed|ignored|reopened`, `observation.created|retracted` (scope = the broadcast).

## Evidence view
From any observation: supplier, contact, channel, observed-at, the full raw text with the item's source lines highlighted, extracted vs corrected values, linked product, and retraction details.

## Not in scope now
File attachments (screenshots, PDFs, Excel), scheduled/automated ingestion, WhatsApp API, LLM extraction, product merge, correction-driven learning beyond aliases, bulk import. See `docs/ideas/BACKLOG.md`.

## Parser version 6 (2026-09-27, from real supplier lists)
- **Layouts read** (all deterministic, brand list optional): pipe lists (`Name | CPU | 16GB | ...`), a `|| title ||` line followed by a pipe or comma detail line and a part-number line, comma detail lines under a title ("> Intel Core i5, 16GB, ..."), one product per line with no price (three or more lines, or a line with a capacity), priced one-liners where every line has "@price", a heading with variant lines ("240GB - SA400S37/240G"), and codes at the start of a line (Apple "MDH74 ..." / "Z1MZ00029 - CTO ..."). A first segment that starts with a CPU or size, or is a bare code, marks a detail line, never a product.
- **Fields:** Core Ultra X9, Core 7, Core 5 210H, Snapdragon X2 Elite, Apple M-series; "RTX 5050 8GB GDDR7" is a GPU (not RAM); colour is kept in the spec text; "11 Months ... Warranty"; "Last 4 Units" is LIMITED; "X1" / "Ultra X9" / "1920 x 1200" are not quantities; Wi-Fi speed classes (AC1200) and DDR speeds are not part numbers; `™` / `®` are removed before matching.
- **Sender:** labels `SUPP`, `SUPPLIER`, `COMPANY`, `VENDOR`; contact labels `CONTACT`, `PERSON`, `ATTN`; an empty label takes the next line; banner block at the top ("|| Lapcom Technologies LLC ||", name, phone, "W.T.S"); "CALL @ number"; "Samir - +971 ...". Signature values fill what the labels leave out.
- **Spreadsheet price lists** (`parsing/table-rows.ts`): a header row such as `AED | Model | Description | Others` (tab- or pipe-separated) defines the columns; each row below is one product: price column = price (currency from the header code or written in the cell), model column = model and part number, description + others = name and specification text. A row that names no brand takes the brand its table names everywhere else, only when all named rows agree (flagged in the reasons). Images are not stored (no attachments yet): a screenshot is transcribed to text and the broadcast note says so.
- **Specifications reader:** memory cards, USB sticks and flash drives are not read as laptops (no RAM / storage / CPU / screen attributes).

## Parser version 5 and variant safety (2026-09-27, from a real Red Data Computer list)
- **Signature block** (`readSignature`, `parsing/header-lines.ts`): a last block made only of a company line, an e-mail, a phone number and a person's name is not a product; it is skipped and read as the sender's details (company, contact, e-mail, phone). Nothing is read if the block holds any other kind of line. The company name that heads the message wins over the footer's spelling.
- Fixes: "512GBPC" is no longer read as a price of 512 GBP (a currency code must not run into letters); glued "i7147008GB/512GBPC" is split into CPU, RAM and storage; "COMING NEXT WEEK" is INCOMING stock; tower / twr / SFF / AIO give the Desktop category; "E/A KB" is an English/Arabic keyboard (specification reader).
- **Variant safety** (`resolveProductForItem`, `broadcasts/service.ts`): matching rules are unchanged, but when the matched product's known CPU, RAM, storage, OS, screen or keyboard contradicts the line, the line is not linked to it. It goes to the one sibling variant that agrees (same model key or manufacturer SKU, at least two specifications agreeing), else a new temporary variant is created: it keeps its own part number when free, otherwise the shared code goes in `manufacturer_sku`. Missing specifications are never conflicts. This stops platform codes (Dell "FCT2250" on three different CPU/OS builds) from putting three configurations into one price history. Audit: `variantSplits` on `broadcast.created`.
