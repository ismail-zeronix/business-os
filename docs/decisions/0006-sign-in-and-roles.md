# 0006. Sign-in and two roles

**Status:** Accepted (2026-09-21). Supersedes the "no authentication" part of [0004](0004-no-auth-dev-actor-seam.md); the actor seam it introduced is exactly where this plugs in.

## Context
The application holds real customer email, supplier prices and margins. Until now anyone who could reach it could read and change everything (0004). It is a small team, so the solution should be simple, need no outside service, and add no dependency.

## Decision
- **Email and password.** Passwords are hashed with **scrypt** from Node's built-in `crypto` (N=2^15, r=8, p=3, a random 16-byte salt each; stored as `scrypt$N$r$p$salt$hash`, so the cost can rise later) and compared in constant time. At least 10 characters, never equal to the email.
- **Database sessions.** The cookie `zx_session` holds a random 32-byte token; the `sessions` table stores only its SHA-256 hash, so a copy of the database cannot be used to sign in. `httpOnly`, `SameSite=Lax`, `Secure` in production, 7 days fixed. Signing out, a password change (other sessions), an admin reset and deactivation delete the person's sessions.
- **Two fixed roles.** `ADMIN` does everything and also manages users, mailbox connections and brand / category settings. `STAFF` does the daily work. Enforced at the **service boundary** (`assertAdmin(ctx)`, `core/permissions/roles.ts`) and mirrored on screens (`requireAdmin()` sends Staff to `/forbidden`; the Settings menu is hidden).
- **Checks live next to the data, not in a layout** (Next.js authentication guide: layouts are not re-run on client navigation). `requireActor()` is the first line of every page and route handler; the layout also asks first, so nothing is drawn for a stranger; every server action gets its actor from `getServiceContext()`, which throws when there is no valid session. There is no `proxy.ts`: it can only check that a cookie exists, and database work in it is discouraged.
- **No lockout during rollout.** Sign-in is enforced only once an **active admin has a password**. Before that the development user acts, with admin rights, and a banner links to **/setup**. /setup takes over the existing (development) user account (the same id, so every earlier audit row and `created_by` stays with the same person), makes it ADMIN, sets the password and signs in; it stops working as soon as an admin has a password. It is serialised with a PostgreSQL advisory lock so two people cannot both claim it.
- **Brute-force protection in the database:** 5 wrong passwords in a row lock the account for 15 minutes (`failed_login_count`, `locked_until`). Every failure says the same sentence ("Email or password is not correct, or the account is temporarily locked."), takes as long for an unknown email as for a known one (a dummy hash is always computed), and a locked account rejects even the right password.
- **Never lock everyone out:** the database (`guard_last_admin` trigger) refuses to demote or deactivate the last active admin; the service and screens also refuse it, and you cannot demote or deactivate yourself.
- **Scripts** (the mailbox sync) act as a **system identity** (`getSystemContext()`, no Next.js imports): the user named by `DEV_ACTOR_EMAIL`, or the oldest active admin once that account has been taken over.
- A password is **never** sent back to the browser, not even to refill a form after an error: server actions echo only the named non-secret fields.

## Consequences
- Every audit row already names a person, now a real one. Sign-ins are audited (`user.signed_in`); failed attempts are not (they would be noise and an easy way to fill the log).
- **Still true:** the build is meant for a trusted network. Serve it over HTTPS in production (the cookie is `Secure` only on the production build), keep Postgres off the network, and complete /setup before exposing it: until an admin has a password, whoever reaches /setup first can claim the admin account.
- Deliberately not built: password reset by email (an admin resets it), two-factor authentication, single sign-on, more than two roles, per-record permissions, remote sign-out screens. See `docs/ideas/BACKLOG.md`.
- The test-support helper creates an ADMIN actor; the pure-logic checks and the browser checks used for this decision are listed in `docs/plans/completed/` once the milestone is archived.
