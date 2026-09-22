# Module: Products

**Status:** Active (foundation only). Enough product identity to support procurement intelligence; **not** a full specification catalogue.

## Owns
`Brand`, `Category`, `Product`, `ProductAlias`, product matching, product search, and the product procurement view (which reads observations).

## Product identity
- `name` is the canonical display name (required). Brand, category, family, model, part number, manufacturer SKU and description are optional; unknown stays unknown.
- Canonical example: `Lenovo V15 G4 IRU`, part number `83A100SUAK`, with aliases `V15 G4`, `V15 IRU`, `V15G4`, `83A100SUAK`.
- `is_temporary` marks products created from a broadcast that still need curation. Creating one must never block procurement entry.
- Status ACTIVE / INACTIVE / ARCHIVED. Products are never hard-deleted. Merge is deferred.
- Category-specific specifications are deliberately not modelled yet (laptops, servers and network gear need different attributes). The model stays extensible: a future specification structure attaches to `Product` without changing it.

## Normalisation (`lib/normalize`)
- `normalizeName` (brand, category): NFKC, trim, collapse whitespace, lower-case.
- `normalizeCode` (part number, model, alias): NFKC, upper-case, strip non-alphanumerics. `83A100-SUAK` = `83a100 suak` = `83A100SUAK`.

## Uniqueness
`normalized_part_number` is globally unique when present. Creating a product whose part number exists returns a "duplicate product" conflict that points at the existing product. Models are not unique. An alias may map to several products (yielding a *possible* match, never a silent pick).

## Matching layers (`products/matching.ts`, pure)
1. Exact normalised part number (also checks aliases equal to the part number) => basis PART_NUMBER (exact)
2. Exact normalised model, narrowed by brand when known => MODEL (probable)
3. Known alias (exactly one product) => ALIAS (probable); several products => candidates only
4. Manual selection => MANUAL; a new product => NEW_PRODUCT — a person creates it, or, in broadcasts, when an item has zero candidates at all, it is created automatically (see `docs/modules/BROADCASTS.md` "Matching")

Fuzzy and LLM-assisted matching are later layers and are not built now. The function returns ranked candidates with the basis; it never confirms anything.

## Search (`products/queries.ts`)
The query is split into tokens. Every token must match at least one of: name, brand name, category name, family, normalised model, normalised part number, manufacturer SKU, normalised alias. Code-like tokens are normalised first, so `83a100-suak` finds `83A100SUAK`. Server-side pagination; brand/category/temporary/status filters. Case-insensitive `ILIKE` at this scale; trigram/full-text indexes are a later optimisation.

## Procurement search (`modules/search`, `/search`)
`searchProcurement(q)` returns matched products with what every supplier last said about each. Exact and probable hits from `findMatchCandidates` (part number, model, alias) are pinned first and labelled; `searchProducts` word matching supplies the rest; capped at 20 products. Supplier price and stock come from `getProductsIntelligence` (batched: two queries whatever the count; the single-product `getProductIntelligence` delegates to it). Read-only: no schema, no audit. Broadcasts, enquiries and suppliers-by-brand are not search sources yet (BACKLOG).

## Product procurement view
Identity and aliases, then **Supplier Intelligence**: latest price and latest stock per supplier, each with its currency/VAT state, observation age (freshness badge) and an evidence link. "Show history" lists every observation including retracted ones. There is no cross-supplier "best price": currency and VAT state make prices non-comparable.

## Master data (Settings)
Brands and Categories: add, rename, archive. Seeded with 6 brands (Dell, HP, Lenovo, HPE, Cisco, Ubiquiti) and 8 categories (Laptop, Desktop, Workstation, Server, Networking, Storage, Printer, CCTV), which are reference data, not business facts.

## Service functions
`createProduct`, `updateProduct`, `setProductStatus`, `addAlias`, `removeAlias`, `findMatchCandidates`, brand/category CRUD; queries `searchProducts`, `getProductDetail`.

## Audit actions
`product.created|updated|status_changed`, `product_alias.added|removed`, `brand.*`, `category.*`.

## Not in scope now
Specification tables, lifecycle/region/warranty attributes, product merge, fuzzy or semantic matching, images, pricing rules. See `docs/ideas/BACKLOG.md`.
