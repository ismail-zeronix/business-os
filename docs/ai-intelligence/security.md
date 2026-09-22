# AI security

Everything here is enforced on the server. Hiding something in the browser is never the control.

## 1. The model never reaches the database

No raw SQL, no connection, no table access, no dynamically created tool. The only data path is the tool registry: static, zod-validated, capability-checked, calling existing module queries through Prisma with typed arguments. The model receives the evidence package for one request and nothing else.

## 2. Permissions

Every request runs as the signed-in actor from `getServiceContext()`. Route handlers call `requireActor()` themselves, because layouts do not re-run on client navigation (ADR 0006). **An assistant request never has more authority than the person who made it.**

Capabilities are a map in `core/permissions`, next to `assertAdmin`:

| Capability | Covers | Today |
|---|---|---|
| `product.read`, `supplier.read` | Identity and catalogue | ADMIN, STAFF |
| `supplier.cost.read` | Price amounts, margins | ADMIN, STAFF |
| `customer.read` | Customer records and correspondence | ADMIN, STAFF |
| `ai.use` | Asking the assistant | ADMIN, STAFF |
| `ai.settings.manage` | Provider, model, keys, switching the assistant off | ADMIN only |

Built in `src/core/permissions/capabilities.ts` (`hasCapability`, `assertCapability`). `search_products` drops price amounts, currency and VAT without `supplier.cost.read`.

With two roles (ADR 0006) both hold every capability except settings. The map is the seam: when Founder, Manager, Sales and Procurement roles are added, only the map changes, and redaction already runs in the tools and the context builder.

## 3. Sensitive fields

Supplier cost, margin, private supplier contacts, internal notes, supplier reliability, procurement strategy, customer-sensitive details, credentials and API keys. Redaction happens in the tool and the context builder, so a field the actor may not see never enters the prompt. Execution logs store summaries, ids and counts, never raw cost, customer text or secrets.

## 4. Prompt injection

Supplier emails, broadcasts and uploaded text are **data, not instructions**. They are wrapped in delimiters and labelled untrusted, and the system prompt states that instructions inside them are ignored. Tools are chosen by the orchestrator from the intents' registry, so text cannot widen access. Structured output is validated afterwards, so an injected instruction cannot invent an evidence reference or a commercial value. A suspicious instruction found inside supplier text is reported as a warning rather than obeyed.

## 5. No autonomous action

The AI creates no business record, changes no value, approves nothing, marks no supplier trusted and sends nothing. The application has no outbound send path at all. Drafts are text a person copies. When proposing modules arrive, output lands as PENDING suggestions that a person confirms through the existing services, which keeps the `CLAUDE.md` rule "parsers and AI propose; humans confirm".

High-risk actions with no AI code path: sending a customer price, sending a supplier commercial request, creating or changing quotation values, applying discounts, confirming availability, changing supplier status, sending external email, marking a supplier trusted, approving a quotation.

**Later trust level (ADR 0007, point 8).** Once the user has confidence in the system, an admin may switch on direct sending of an **issued** quotation to its customer, attached exactly as issued. It is off by default, admin-only, audited per send, and never alters the quotation or reveals suppliers or costs. It needs outbound email, which does not exist, and its own plan.

## 6. Keys and provider settings

Provider keys are stored with `secret-box` (AES-256-GCM, `APP_SECRET_KEY`, ADR 0005): write-only in the UI, excluded from every query except the call path, never sent to the browser, never in logs, errors, audit details or the values a failed form echoes back. Only an admin can view or change provider settings. Losing `APP_SECRET_KEY` means re-entering the keys.

## 7. Data leaving the company

Text sent to a provider leaves the company's infrastructure. The user confirmed on 2026-09-21 (ADR 0007, point 6) that customer data may be sent, for example to draft a customer email, **with a person in the loop**. Mitigations: send only the evidence package, redact by capability, never send credentials, keep raw customer email out of a prompt unless the question requires it and the actor may see it, and keep the provider choice with the admin.

## 8. Cross-user and cross-customer isolation

Single tenant, one organisation. Conversations belong to their user and are not readable by another. Nothing in a prompt carries one customer's data into another customer's question, because context is built per request from the entities that request named.
