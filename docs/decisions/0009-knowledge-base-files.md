# 0009. The knowledge base is markdown files in `knowledge/`

Date: 2026-09-27. Status: accepted.

## Context
Zeronix needs one written source of truth about how the business works (the company, its services, the sales team's daily work, procurement rules, how an AI must behave) so that people can read it and any future LLM module plans work from the same instructions.

## Decision
- The knowledge lives as markdown files in the repo's `knowledge/` folder, in numbered folders (01-company, 02-services, 03-sales-team, 04-procurement, 05-ai-instructions) with a `README.md` that holds the rules for any LLM. It is shown in the app on the Knowledge screen, read only, to every signed-in user.
- Files (not the database) because it is simple, versioned in git, and readable by the AI module without a new schema. PostgreSQL still owns all live data (products, prices, stock, enquiries); the knowledge base says how to work, never what the current price is.
- Every page has a `Status` (`TO BE FILLED`, `DRAFT`, `CONFIRMED`). Business facts are never invented: unknown stays `TO BE FILLED`, and a person supplies and confirms each fact. An AI that reads a page must report its status and must not guess what is missing.
- Editing in the app is a later, admin-only, audited slice. Until then admins edit the files in the repo.

## Consequences
- The `knowledge/` folder must ship with the deployment; the app reads it from disk on each request.
- The project's development docs (`docs/`, `PROJECT_PLAN.MD`) are not shown in the app.
- If staff must edit content in the app, or the AI needs search over it, moving the content into PostgreSQL will be revisited then.
