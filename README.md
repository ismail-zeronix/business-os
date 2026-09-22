# Zeronix Intelligence

Internal procurement-intelligence application for Zeronix Technology LLC. Current milestone: see `docs/plans/active/`; customer **Quotation** is next. The **AI Intelligence layer** is designed but paused after its documentation stage (`docs/ai-intelligence/`, `docs/plans/paused/`). Earlier milestones (Supplier & Broadcast Intelligence, Enquiry Intelligence, Procurement Search, Sourcing, Sign-in and Roles) are complete (`docs/plans/completed/`).

Development rules: `CLAUDE.md`. Long-term vision: `PROJECT_PLAN.MD`. Architecture: `docs/architecture/`.

## Prerequisites
Node 22.12+ (developed on Node 26), npm, Docker Desktop.

## First-time setup
```bash
npm install
cp .env.example .env        # local-only defaults; never commit .env
                            # then set APP_SECRET_KEY (see "Email" below) before adding a mailbox
npm run db:up               # PostgreSQL 17 in Docker on 127.0.0.1:5442 (waits until healthy)
npm run db:generate         # generate the Prisma client into src/generated (git-ignored)
npm run db:deploy           # apply migrations
npm run db:seed             # 1 dev user, 6 brands, 8 categories (reference data only)
npm run dev                 # http://127.0.0.1:3000
```

## Everyday commands
| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js (bound to 127.0.0.1) |
| `npm run typecheck` / `lint` / `test` | Verification |
| `npm run db:up` / `db:down` | Start / stop the local database (data is kept in the `zeronix_bi_pgdata` volume) |
| `npm run db:migrate` | Create/apply a migration during development |
| `npm run db:generate` | Regenerate the Prisma client after a schema change (**restart `npm run dev` afterwards**: the dev server caches the old client) |
| `npm run mail:sync` | Sync every active email account once. `-- --watch` repeats every `MAIL_SYNC_INTERVAL_MINUTES` (default 5). See "Email". |

## Email
Customer enquiries can arrive by email. Add the mailbox in **Settings > Email accounts** (IMAP; Hostinger's server, port 993 and SSL/TLS are pre-filled and editable), press **Test connection**, then sync from **Enquiries > Email** (`Sync now`) or run `npm run mail:sync` (add `-- --watch` to keep syncing).

- **Setup.** Generate a key once and put it in `.env` as `APP_SECRET_KEY=...`:
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
  It encrypts the stored mailbox password (AES-256-GCM). **Keep it safe: if it is lost or changed, re-enter the password.** A `db:backup` dump does not contain it.
- **Read-only.** The mailbox is opened read-only: mail is never marked as read, moved or deleted. Only messages on or after the account's *sync from* date are read, at most 200 per run, oldest first.
- **Nothing is automatic.** Each email is stored as immutable evidence and scored. A person decides whether to create an enquiry or dismiss it (Enquiries > Email).
- The password is write-only in the UI and never appears in logs, errors or the audit trail. Real customer email is stored in the database and therefore in backups. See `docs/decisions/0005-email-account-secrets.md`.

## Backups
Your data lives in the Docker volume `zeronix_bi_pgdata`. Back it up regularly; a backup contains real business data, so keep the files safe (the `backups/` folder is git-ignored).

| Command | What it does |
|---|---|
| `npm run db:backup` | Writes `backups/zeronix_bi-<UTC timestamp>.dump` (compressed), proves it is readable, keeps the newest 14 (`-- --keep 30` to change). Read-only for the database. |
| `npm run db:restore -- <file> <new_db_name>` | Restores into a **new** database so you can inspect it. Refuses the live database and any existing name. |

**Recovering the live database** is deliberately manual, because it replaces data. Take a fresh backup first, then:
1. Stop the app (and anything else connected).
2. `docker exec zeronix-bi-postgres psql -U zeronix_bi -d postgres -c "DROP DATABASE zeronix_bi"` (destructive) then `... -c "CREATE DATABASE zeronix_bi"`.
3. `docker exec -i zeronix-bi-postgres pg_restore -U zeronix_bi -d zeronix_bi --no-owner < backups/<file>.dump`
4. Start the app. Never run `docker compose down -v` or `prisma migrate reset` on data that matters: they delete the database.

## Things to know
- The database is on **port 5442** and you must connect with **`127.0.0.1`**, not `localhost` (see `docs/decisions/0003-local-postgres-isolation.md`).
- Migrations only. Never `prisma db push`. Do not run `prisma migrate reset` or `docker compose down -v` on data that matters.
- Sign-in is built (email and password, sessions, ADMIN and STAFF roles; `docs/decisions/0006-sign-in-and-roles.md`). It is enforced once an active admin has a password; on a fresh install a banner links to `/setup`. Still do not expose the dev server or database to a network, and **serve over HTTPS before anyone uses it over a network.**
