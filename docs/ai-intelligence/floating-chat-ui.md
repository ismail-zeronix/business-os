# Floating assistant

Design v3 applies (`docs/design/UI_SYSTEM.md`): the existing tokens, shadcn parts and Lucide icons. The assistant must look like part of the application, not a bolted-on chat widget. No re-skin, no new font, no gradients, no emoji icons.

## Mounting

Inside `src/app/(workspace)/layout.tsx`, as a sibling after `</SidebarProvider>` but still inside `ShellProvider`, rendered only when `signedIn` is true. That puts it on every authenticated page and nowhere near `/login` and `/setup`, which use the `(auth)` layout.

The layout does not re-run on client navigation, so the assistant's route handler and actions call `requireActor()` or `getServiceContext()` themselves.

## Placement

`fixed bottom-6 right-6`, `z-40`. Two things already live bottom-right: the sonner toaster (mounted in the root layout) and the Next dev indicator. The button sits above the toaster's stack and the panel opens clear of both. The shadcn Sheet overlay is `z-50`, so the button must stay below it.

## Button states

| State | Look |
|---|---|
| `IDLE` | Static mark, thin border, surface background |
| `THINKING` | Soft pulse on a small brand-green dot |
| `RESPONDING` | Same dot, steady |
| `WARNING` | Amber dot |
| `ACTION_REQUIRED` | Small count in a pill |
| `ERROR` | Danger dot |

Animation is a slow opacity pulse only. No bounce, no slide-in, no attention-seeking motion. `prefers-reduced-motion: reduce` removes the pulse and leaves the colour. There is no logo inside the mark; where branding is needed the text is "ZERONIX TECHNOLOGY LLC".

## Panel

A shadcn `Sheet`: a right-side panel on desktop, full height on a narrow screen. It holds the conversation, a new-conversation and a clear action, the current page context, suggested prompts, the input, and per-message actions.

Each answer is laid out as separated blocks, so fact, quality and suggestion are never one paragraph:

```
Answer            Supplier A has the lowest validated cost for 20 units.
Confidence        92% High
Evidence          - Exact part-number match
                  - Stock confirmed today
                  - Supplier message received 10:20
Warning           Stock should be reconfirmed before the customer is told.
Next action       [Request stock confirmation]  [Open product]
```

An evidence line opens the existing evidence drawer (`?evidence=`), which shows the untouched original.

Per message: copy, regenerate, and feedback (useful / not useful, plus a correction note). Approve and reject buttons are **not** in this scope; they arrive with the first module that proposes changes.

## Page context

`usePathname()` and `useSearchParams()` give the route and ids; `useShell()` breadcrumbs give the record type and name already registered by `PageHeader`. The server resolves the entity from the route, so the client never asserts what it is looking at.

Suggested prompts change by route:
- **Product:** find suppliers with real stock, show latest price observations, compare equivalents, show quotation history (when it exists).
- **Supplier:** summarise this supplier, show recent stock accuracy, best product categories.
- **Enquiry:** what information is missing, find matching products, start sourcing.
- **Elsewhere:** search a product, check a price, check stock.

Prompts for tools that are not built yet are not shown. No fake screens for future modules.

## Components

Reuse `FreshnessBadge`, `StockBadge`, `SoftPill`, `EmptyState`, `ErrorState`, `LoadingState`, `Unknown`, `Sheet`, `Button`, `Textarea`, `Skeleton`, `sonner`. The existing `ConfidenceBadge` takes the `ExtractionConfidence` enum, so it does not fit a 0-to-1 AI score; the AI layer adds a small `AiConfidence` block that shows the percentage, the level and the reason list, built from the same tokens.

## Streaming

A route handler at `src/app/api/assistant/route.ts` (`runtime = "nodejs"` for Prisma and pg) returns a streamed `Response`. Server actions are not used for token streaming. Settings, feedback and conversation management stay server actions with `runAction`.

## States

Empty (no conversation yet, with suggested prompts), thinking, streaming, error (a plain sentence: no provider configured, provider unreachable, rate limited, invalid output, permission refused), and no-evidence (the answer says what is missing instead of guessing). Keyboard: the panel traps focus, Escape closes it, the button is reachable by tab and labelled for screen readers.
