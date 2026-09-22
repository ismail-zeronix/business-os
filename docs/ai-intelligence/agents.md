# Agents — planned, not built

**Nothing here is implemented.** The scope of the AI milestone is the core and the floating assistant, and that milestone is itself paused (`docs/plans/paused/2026-09-21-ai-intelligence-core.md`). This file records the intended shape so the registries are designed for it. It supersedes nothing in `docs/modules/AGENTS.md`, which holds the longer-term Second Brain notes.

## What an agent is here

A **bounded** unit: a fixed set of tools, a versioned prompt, a defined output. Not a free-running loop, not a super-agent with everything. Each one:
- may use only the tools its definition lists,
- never has more authority than the person invoking it,
- produces proposals, never records,
- logs every execution.

An agent is therefore a named configuration over the existing orchestrator, tool registry and context registry. Adding one adds a definition, its tools and a prompt version.

## Planned agents

| Agent | Does | Needs first |
|---|---|---|
| **Enquiry** | Detect RFQ intent, extract customer, product, quantity, deadline, location; name what is missing; suggest priority; link to existing records; suggest the next action | Enquiry context provider and tools |
| **Product** | Normalise names, match part numbers, detect aliases, compare specifications, separate exact matches from equivalents, flag incompatible products | Richer product specifications |
| **Supplier broadcast** | Read supplier messages and files, extract part number, price, quantity, validity and warranty, draft observations linked to the source, ask when confidence is low | Warranty fields; an LLM extractor behind `BroadcastParser` |
| **Supplier matching** | Rank offers by the deterministic rules, show exact and equivalent separately, explain differences, exclude suppliers without real stock | Ranking module |
| **Procurement** | Recommend suppliers to contact, find coverage gaps, prepare broadcasts, track pending responses, flag expired offers | Supplier history |
| **Quote** | Prepare a draft from validated data, check missing fields, compare margin options, flag price and stock risk | **A quotation module. Blocked.** |
| **Communication** | Draft customer replies, supplier enquiries and follow-ups in the Zeronix style | Nothing sends; drafts only |
| **Follow-up** | Find quotes needing follow-up, offers near expiry, unanswered enquiries; suggest reminders | A task or follow-up table |
| **Intelligence** | Answer business questions from evidence, summarise supplier and customer history, explain wins and losses | History depth |

## Constraints that hold for all of them

Deterministic rules run before the model. Evidence is cited or the answer says unknown. Exact matches are never merged with equivalents. Suppliers without confirmed stock are excluded from recommendations, and the exclusion is stated. Warranty is never invented. Nothing is sent. Nothing is confirmed without a person.
