# 0004. No authentication in the first milestone; a dev-actor seam instead

**Status:** Accepted (2026-09-20). **Superseded on 2026-09-21 by [0006](0006-sign-in-and-roles.md)** (sign-in and two roles). What follows records the earlier arrangement, which still applies until an admin sets a password.

## Context
`CURRENT.md` says a sophisticated role system is not required yet, but the architecture must not assume every future user has full access. Authentication and user administration are a separate body of work.

## Decision
- No login, sessions or roles in this milestone.
- `core/permissions/getCurrentActor()` is the single place that decides "who is acting". It returns the seeded development user (`DEV_ACTOR_EMAIL`).
- Every mutating service takes `ctx = { actor, db }` and every audit row and `created_by` column records the actor, so real authentication only replaces `getCurrentActor()` and adds permission checks at the service boundary.
- The dev server binds to localhost and PostgreSQL to `127.0.0.1`.

## Consequences
- Audit trails are already shaped for real users.
- **Anyone who can reach the dev server can read and write everything.** This build must not be exposed to a network.
- The `User` table has no credentials yet; adding auth means new columns/tables and a migration.
