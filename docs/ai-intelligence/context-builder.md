# Context builder

Builds the evidence package: everything the model may see for one request, and nothing else. `src/modules/ai/context/`.

## Rules

- **Task-relevant only.** Never the whole database, never a whole table. Each provider takes the entity ids the tools returned and fetches the rows for that question.
- **Capped.** Every provider has a row limit and a recency order, so a package cannot grow without bound.
- **Redacted.** Fields are dropped when the actor lacks the capability (`security.md`). Redaction happens in the builder, not in the prompt, and not in the UI.
- **Referenced.** Every fact carries its source: evidence id, observation id, supplier, `observedAt`. Facts without a source are not included.
- **Delimited.** Raw supplier and customer text is wrapped and labelled as untrusted data.
- **Provider-neutral.** The package is a plain object, serialised the same way for every adapter.

## Registry

```ts
type ContextProvider = {
  name: string;
  appliesTo(intent: Intent, input: ContextInput): boolean;
  build(input: ContextInput, ctx: ServiceContext): Promise<ContextFragment>;
};
```

Providers are registered in a list. Adding a table means adding a provider; nothing else in the layer changes.

**Built in Stage 1** (`context/providers.ts`): `product-offers` (products, suppliers, and every latest price and stock observation, all from the `search_products` result, so one provider rather than four) and `business-rules` (supplier cost is not a selling price, the freshness bands, what counts as available stock, warranty and delivery are not recorded). Every fact gets a short reference from a shared allocator (P1 product, S1 supplier, E1 evidence) that the model cites and the validator checks. A recorded price of 0.00 is presented as "no price was given".

**Later:** `EnquiryContextProvider`, `CustomerContextProvider`, `CommunicationContextProvider`, `QuotationContextProvider`, and whatever new modules need.

## What a product question gets today

The requirement as typed; candidate products from `matching.ts` and `searchProcurement`, with match basis (exact part number, model, alias, token) marked per candidate; part numbers and identifying fields; per supplier the latest price observation (amount, currency, VAT state, `observedAt`, evidence id) and the latest stock observation (quantity, status, `observedAt`, evidence id); supplier identity and record status; freshness computed from `observedAt`; and the applicable business rules.

Exact matches and equivalents are kept in separate lists so they can never be merged in an answer.

## What a quotation draft would get (later, when quotations exist)

Customer, approved quotation data, quote items, validated selling prices, delivery and payment terms, warranty information, validity, notes and the Zeronix communication style. Listed here so the shape is planned, not because it is built.

## Freshness and exclusion

Freshness comes from `observedAt` (when the supplier said it), never `createdAt`, reusing the existing freshness helper. Stale observations stay in the package but are labelled, so an answer can warn instead of silently using them. Once ranking exists, suppliers without real available stock are excluded from recommendations and the exclusion is stated. Retracted observations are never included.
