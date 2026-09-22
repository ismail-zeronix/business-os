# Current Development Plan

## Project

**Zeronix Intelligence**

## Active Milestone

**Sign-in and Roles** (roadmap: Platform prerequisite, ADR 0004 revisited). Customer **Quotation** follows as the next milestone.

## Status

**Built and verified 2026-09-21.** Final typecheck and ESLint are clean, `next build` is clean (every data route dynamic; `/login`, `/setup` and `/forbidden` added), the existing pure tests pass (8 files, 51 tests), and `prisma migrate status` says the database is up to date. Sign-in is **on**: the first admin was created at the user's request (name "Ismail", `ismail@zeronix.ae`) by taking over the development user, and every session was ended, so the login screen is the only way in. `TEST Staff` (`test-staff@example.com`) was created for the checks and left **deactivated**.

What was verified, against the project database:
- **Database**: the last-admin trigger and the non-negative counter (8 checks, rolled back).
- **Sign-in logic**, in rolled-back transactions (about 50 checks): scrypt hashes with a fresh salt and no password inside; only the token's hash stored; 7-day expiry; audit; one message for wrong password / unknown email / locked / inactive / no password and equal timing; lockout after 5 and unlock after the lock passes; sign-out; change password (other sessions end, this one stays); first-time setup takes over the existing user, refuses a second run and a taken email; the user services; Staff refused by every admin-only service (users, mailbox accounts, brands, categories: 9 services); the last admin cannot be demoted or deactivated, in the service and in the database.
- **In a real browser** (44 checks): every one of the 25 routes redirects to /login without a session and none shows data; /setup closes; wrong password and unknown email show the same message and keep the email; the session cookie is httpOnly and SameSite=Lax and unreadable by page scripts; the account menu and Settings > Users; no Deactivate on your own row and a fixed role; a short password is refused; Staff have no Settings anywhere and are sent to the "Only an admin" page from every settings address; Staff can do the daily work; change password (wrong current, mismatch, success, the session stays); sign-out; the old password stops working; lockout with the right password refused; an admin reset unlocks; deactivating ends a live session immediately; after signing out the admin area is closed.
- One real bug found and fixed: setup renames the development user, so the mailbox script lost its identity; scripts now fall back to the oldest active admin, and the seed no longer adds a second development user to a set-up database.

**Not verified yet** (also in `docs/plans/STABILIZATION.md`): a 200-character password, unusual Unicode passwords, a session expiring while a page is open, two browsers as the same person, the narrow-screen layout, and everything about HTTPS / `Secure` cookies (they apply to the production build, not the dev server).

Previous milestones are archived in `docs/plans/completed/`: Supplier & Broadcast Intelligence MVP, Enquiry Intelligence MVP, Procurement Search, Sourcing Requests, Compare and Choose Supplier. Their rules, data model and screens stay in force. Also built outside a milestone at the user's request (2026-09-21): broadcast parser version 2, `@` mentions and automatic reading of `SUPPLIER :` / `CONTACT :` lines, the Lenovo P16v G3 added under First Option General Trading. (An Overview refactor into `src/modules/overview/` is being done separately and is not part of this plan.)

## Purpose

Until now anyone who could reach the app could read and change everything (ADR 0004). The app now holds real customer email, supplier prices and margins. This milestone adds real people: each signs in, every change is recorded under their name, and only an admin can manage users and settings.

## Decisions (2026-09-21)

1. **Email and password.** No outside service. Passwords are stored hashed with scrypt from Node's built-in `crypto` (**no new dependency**), salted per password, compared in constant time.
2. **Two fixed roles: ADMIN and STAFF.** Admin: everything, plus users, mailbox connections and brand / category settings. Staff: all daily work (enquiries, customers, broadcasts, suppliers, products, sourcing, choosing suppliers, later quotations) but no users and no settings. Checked at the **service boundary** (`assertAdmin(ctx)`), and the Settings menu is hidden from Staff. The role list can grow later.
3. **Database sessions.** The cookie holds a random token; the database holds only its SHA-256 hash, the user, and an expiry. Cookie: `httpOnly`, `SameSite=Lax`, `Secure` in production, 7 days, fixed (sign in again weekly). Signing out, a password change or reset, and deactivating a user delete that user's sessions.
4. **Checks live next to the data, not in a layout** (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`: layouts do not re-check on navigation). `requireActor()` is called at the top of every page and route handler, and every server action already gets its actor from `getServiceContext()`. No `proxy.ts`: it can only do cookie-presence checks, and the docs advise against database work there.
5. **No lockout during rollout.** Sign-in is **off until an admin has a password**. While off, the app behaves as today (the development user acts, with admin rights) and shows a banner "Sign-in is not set up: anyone who can reach this app has full access" linking to **/setup**. **/setup** is a one-time screen (name, email, password): it takes over the existing development user (keeping every earlier record attributed to the same person), makes it ADMIN and signs in. It stops working once an admin has a password. From then on every page needs sign-in.
6. **Brute-force protection in the database:** 5 wrong passwords lock that account for 15 minutes. The message never says whether the email exists.
7. **Never lock everyone out:** the database refuses to deactivate or demote the last active admin, and the screen does not let you deactivate or demote yourself.
8. Scripts (the mailbox sync) act as a **system identity** (`DEV_ACTOR_EMAIL`), not a browser session.
9. Development-first testing still applies (`CLAUDE.md`): typecheck, lint, manual verification, no new test suites. Everything created for checks is labelled `TEST`.

## Data (one additive migration, not destructive)

`users` gains: `password_hash` (nullable: text `scrypt$N$r$p$salt$hash`), `role` (`ADMIN` | `STAFF`, default `STAFF`), `last_login_at`, `failed_login_count` (default 0), `locked_until`. New `sessions`: `id`, `user_id` (Restrict), `token_hash` (unique), `created_at`, `expires_at`, `last_used_at`. Guard trigger: an UPDATE that would leave no **active admin** is refused.

No existing row is changed by the migration. Role and password are set by /setup.

## Behaviour

- **/login**: email and password, inline error, "Email or password is not correct", `?next=` (only same-site paths). If sign-in is not set up yet it goes to /setup; if already signed in it goes to the app.
- **/setup**: only while no active admin has a password (otherwise it redirects). Name, email, password (at least 10 characters, not the email), confirm.
- **Account menu** (sidebar footer): name, email, role; **Change password** (drawer: current, new, confirm); **Sign out**.
- **Settings > Users** (admin only): table (name, email, role, status, last sign-in), **Add user** (name, email, role, an initial password the admin gives them), **Edit** (name, email, role), **Reset password**, **Deactivate / Reactivate**. Deactivated users cannot sign in and keep their history.
- Admin-only services and pages: users, mailbox accounts (create, edit, password, status), brands and categories. Staff get a clear "Only an admin can do this" (a 403-style message), never a crash.
- Audit: `user.created|updated|password_changed|password_reset|status_changed|signed_in`, entity `User`.

## Structure

```text
prisma/schema.prisma + migration            UserRole, users columns, Session, last-admin trigger
src/core/auth/password.ts                   hashPassword, verifyPassword (scrypt)
src/core/auth/session.ts                    token, hash, cookie name and options, session lifetime
src/core/permissions/actor.ts               getCurrentActor (session or, while sign-in is off, the dev user), requireActor, requireAdmin, assertAdmin, signInEnabled
src/core/permissions/system-actor.ts        getSystemContext for scripts
src/modules/users/                          service (create, update, reset, status, change password), auth.service (sign in, out, setup), schemas, actions, queries, components
src/app/(auth)/login, setup                 the two public screens
src/app/(workspace)/settings/users          admin user management
every src/app/(workspace)/**/page.tsx       requireActor() at the top; settings pages requireAdmin()
src/components/application/sidebar.tsx      account menu, hidden Settings for Staff, banner
scripts/mail-sync.ts                        getSystemContext
```

## Out of scope

Password reset by email ("forgot password": an admin resets it), two-factor authentication, single sign-on, more than two roles, per-record permissions, an audit page for sign-in failures, IP-based rate limiting, "remember me" options, session listing or remote sign-out screens. Ideas go to `docs/ideas/BACKLOG.md`.

## Definition of Done

Verified by hand once, in a browser, using the project database. Everything created is labelled `TEST`.
1. While no admin has a password: the app works as before, the banner shows, /setup works, and **nothing is locked**.
2. /setup takes over the development user, makes it admin and signs in; afterwards /setup redirects, and **every page and route redirects to /login without a session** (checked across the whole route list, including the raw-email download).
3. Sign in works; wrong password shows the generic error; five wrong passwords lock the account; `?next=` only follows same-site paths; signing out ends the session.
4. Change password works and signs other sessions out. A deactivated user's session stops working.
5. A Staff user does not see Settings, is refused the admin pages and admin-only actions with a plain message, and can do daily work.
6. Users page: add, edit, reset password, deactivate and reactivate; the last active admin cannot be deactivated or demoted (database and screen).
7. The mailbox sync script still runs. Typecheck, lint and `next build` are clean; existing tests still pass. Migration additive, applied with `prisma migrate` only.
8. Docs updated (ADR 0006, OVERVIEW, SCREENS, the settings notes).

## Documentation to update as built

`docs/decisions/0006-sign-in-and-roles.md` (new, supersedes the "no authentication" part of 0004), `docs/architecture/OVERVIEW.md`, `docs/architecture/DATA_MODEL.md` (section 14), `docs/design/SCREENS.md`, `docs/plans/ROADMAP.md`, `docs/ideas/BACKLOG.md`, `docs/plans/STABILIZATION.md`.

## Implementation order

1. Schema, migration, guard trigger; check in a rolled-back transaction.
2. `core/auth`, actor changes, system actor, admin checks; check the pure parts in a script.
3. Users module: services, actions, screens; login, setup, account menu, Settings > Users.
4. Add `requireActor()` to every page and route; `requireAdmin()` and `assertAdmin` where decided.
5. Verify in a browser while sign-in is still off (TEST staff user, roles, lockout, users page), then ask the user to complete /setup, then verify enforcement across every route.
6. Docs, final typecheck / lint / build.
