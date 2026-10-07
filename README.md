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
Customer enquiries can arrive by email. Add the mailbox in **Settings > Email accounts** (IMAP; Hostinger's server, port 993 and SSL/TLS are pre-filled and editable), press **Test connection**, then sync from **Enquiries > Email** (`Sync now`), run `npm run mail:sync` (add `-- --watch` to keep syncing), or - in production - let the `mail-cron` compose service trigger it automatically.

- **Setup.** Generate a key once and put it in `.env` as `APP_SECRET_KEY=...`:
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
  It encrypts the stored mailbox password (AES-256-GCM). **Keep it safe: if it is lost or changed, re-enter the password.** A `db:backup` dump does not contain it.
- **Read-only.** The mailbox is opened read-only: mail is never marked as read, moved or deleted. Only messages on or after the account's *sync from* date are read, at most 200 per run, oldest first.
- **Automatic in production.** The `mail-cron` service (`compose.yaml`) calls `POST /api/cron/mail-sync` every `MAIL_SYNC_INTERVAL_MINUTES`, entirely inside the internal Docker network, authorized by `MAIL_CRON_SECRET` (generate it the same way as `APP_SECRET_KEY`; the route refuses every request until it is set). Not used in local dev - there, use `Sync now` or `npm run mail:sync`.
- **Nothing is automatic about becoming an enquiry.** Each email is stored as immutable evidence and scored. A person decides whether to create an enquiry or dismiss it (Enquiries > Email); only the fetch itself is automatic in production.
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

## Production deployment

Docker + Docker Compose, behind an existing Caddy instance. This is separate from local development (above): `compose.yaml` (not `docker-compose.yml`), a different `.env`, no host ports. Caddy and the `proxy-net` network are managed outside this repo.

**One-time, on the server** (Ubuntu 24.04, path `/srv/docker/zeronix`):
```bash
git clone <this repo> /srv/docker/zeronix   # or rsync a release tarball; see "no Git push" note below
cd /srv/docker/zeronix
cp .env.example .env
# edit .env: ZI_DB_PASSWORD (generate, do not reuse the dev password), APP_SECRET_KEY (generate, back it up outside
# the database), MAIL_CRON_SECRET (generate the same way - required, the app container will not start without it),
# SETUP_TOKEN (recommended - see below). See the "Production (Docker Compose)" section of .env.example.
docker network inspect proxy-net >/dev/null 2>&1 || docker network create proxy-net   # only if Caddy has not already made it
```

**Build and start:**
```bash
docker compose build                        # builds zeronix-app (target: runner) and the migrate image (target: migrator)
docker compose up -d postgres                # start the database first and wait for it to be healthy
docker compose run --rm migrate              # apply migrations (safe: `prisma migrate deploy`, additive only, never resets)
docker compose up -d zeronix-app mail-cron   # start the app and its mail-sync scheduler (or: docker compose up -d, which
                                              #  starts postgres + zeronix-app + mail-cron; `migrate` has profile "tools"
                                              #  so it is never started by `up` on its own)
```

**Every later deploy** (new image, same database):
```bash
git pull   # or re-sync the release
docker compose build zeronix-app migrate
docker compose run --rm migrate
docker compose up -d zeronix-app mail-cron
```

**First admin:** open `https://<your domain>/setup` right after the first deploy and create the admin account - it is open to whoever reaches it first until that happens. Set `SETUP_TOKEN` in `.env` beforehand to require a code there.

**Point Caddy at it** (in Caddy's own Caddyfile, not part of this repo):
```
your-domain.example { reverse_proxy zeronix-app:3000 }
```
Caddy's own compose/container must already join the external `proxy-net` network for the hostname `zeronix-app` to resolve.

**Health:** `GET /api/health` (also the container's own Docker healthcheck) - `200 {"status":"ok"}` when the app and the database both answer, `503` otherwise.

**Backups in production:** the same idea as local (`scripts/db-backup.ts`), pointed at the `zeronix-bi-prod-postgres` container instead of `zeronix-bi-postgres`:
```bash
docker exec zeronix-bi-prod-postgres pg_dump -U <ZI_DB_USER> -d <ZI_DB_NAME> -Fc --no-owner > backup.dump
```
Automate this (cron + off-box copy) before real data accumulates; it is not wired up by `compose.yaml` itself.
