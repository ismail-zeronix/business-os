# AI test plan

**Not executed now.** `CLAUDE.md` defers automated tests to the stabilization phase (`docs/plans/STABILIZATION.md`), and the user confirmed that. This file records what to test so the code is written to be testable and nothing has to be refactored later.

## What keeps it testable while building

- Confidence, ranking, freshness, warranty classification and intent classification are **pure functions** over plain inputs, with no database and no provider.
- Services take `ctx = { actor, db }`, so a test can pass any database and any actor.
- The `AIProvider` interface means a fake provider can return fixed structured output, so everything except the adapters can be tested without a network call or a key.
- Tools, context providers and prompts are registries, so a test can build a registry with one entry.
- Adapters are thin: request mapping in, response mapping out, no business logic to test twice.

## Manual verification during development

Each stage: `npm run typecheck`, `npm run lint`, `prisma migrate status`, then the flow by hand on the project database (anything created labelled `TEST`). Stage 2 also: open the assistant on a product page, ask a real question, check the evidence links open the original message, check a question with no evidence says so, and check a narrow screen.

## Unit tests (stabilization)

Intent classification, including the fallback. Product normalisation and part-number matching, exact separated from equivalent. Stock freshness bands. Supplier ranking order and its explanation. Warranty classification, including unknown. Confidence factors, levels and boundaries (0.59 / 0.60, 0.84 / 0.85). Capability checks per role. Context building: caps respected, redaction applied, references present. Tool input validation, including rejected input. Response validation: an invented evidence id fails, a missing warning fails, a non-empty `proposedChanges` forces `requiresApproval`.

## Integration tests (stabilization)

A question to a validated structured answer with a fake provider. Enquiry to product matching. Supplier message to a stock observation proposal. Product to supplier ranking. A quote draft from validated source data (once quotations exist). An answer with evidence, and an answer with none. The approval and rejection workflow (once suggestions exist). Provider swap: the same question against two fake providers gives the same evidence, the same confidence number and the same structure.

## Security tests (stabilization)

Unauthorised cost access is redacted in the tool, the context and the response. Unauthorised margin access likewise. Prompt injection: instructions inside supplier text are not followed, and no tool outside the intent's list is reached. A malicious supplier message cannot cause a write. Cross-user conversation access is refused. No raw SQL path exists from a model. No unapproved external message can be sent, because no send path exists. A provider key never appears in a response, a log, an audit row or a form echo.

## UI tests (stabilization)

Assistant button renders on authenticated pages and not on `/login` or `/setup`. Open and close, including Escape and focus trap. Narrow-screen layout. Loading, streaming and error states. Evidence expansion opens the original. Confidence display shows number, level and reasons. Permission-based visibility (Settings > AI hidden from Staff). Reduced motion removes the pulse. Keyboard reachable and labelled.

## Calibration (later)

Once feedback history exists: compare predicted confidence against what proved correct, per intent and per provider; report structured-output failure rate per provider; report extraction accuracy against human corrections. These are reports, not automatic rule changes. A change to a matching or confidence rule is reviewed and versioned by a person.
