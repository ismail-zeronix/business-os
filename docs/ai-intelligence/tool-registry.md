# Tool registry

The only way the AI layer reaches data. `src/modules/ai/tools/`.

## Contract

```ts
type AIToolDefinition<I, O> = {
  name: string;
  description: string;
  inputSchema: ZodType<I>;
  requiredCapabilities: Capability[];
  execute: (input: I, ctx: ServiceContext) => Promise<ToolResult<O>>;
};
```

Every tool:
- validates its input with zod before doing anything,
- checks the actor's capabilities and refuses with a typed error,
- returns structured data with an evidence reference for every fact,
- omits fields the actor may not see (redaction happens here and in the context builder, never only in the UI),
- is recorded in `AiExecution`.

## Hard limits

- **No raw SQL from a model.** Tools call the existing module queries and services, which use Prisma with typed arguments.
- **No dynamic tool creation.** The registry is a static list in code. A model can only pick a name from the list the orchestrator offered it for that intent.
- **No write tools in this scope.** When writes arrive they will create PENDING suggestions, never business records, and the existing service performs the change after a person confirms.
- **No tool sends anything.** There is no email, WhatsApp or webhook tool, in this scope or later.

## Tools in this scope

| Tool | Input | Returns | Capability |
|---|---|---|---|
| `search_products` | query text, optional brand, limit (max 20) | Products with match basis, and per supplier the latest price and stock observation with `observedAt`, freshness and evidence id | `product.read`, and `supplier.cost.read` for amounts |

It wraps `searchProcurement` (`src/modules/search/queries.ts`) and `findMatchCandidates` (`src/modules/products/matching.ts`). It adds no logic of its own, so the assistant and `/search` can never disagree.

## Tools reserved for later modules

`get_supplier`, `compare_suppliers`, `get_price_history`, `get_stock_evidence`, `get_enquiry`, `get_customer_history`, `get_supplier_history`, `parse_broadcast`, `draft_supplier_message`, `draft_customer_reply`, `prepare_quotation_draft`, `find_follow_ups`. Each arrives with the module that owns its data, with its own plan and approval.
