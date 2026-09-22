# 0003. Local PostgreSQL: isolated container, port 5442, Debian image

**Status:** Accepted (2026-09-20)

## Context
The development machine already runs other PostgreSQL containers, including one on port 5432 that belongs to a different, earlier scaffold of this product and holds real data. On this machine `localhost` can resolve to `::1`, and `::1:5432` is owned by the WSL relay, so a `localhost` connection string can silently reach the wrong server.

## Decision
- A **new, separate** Docker Compose project `zeronix-bi`: container `zeronix-bi-postgres`, volume `zeronix_bi_pgdata`, database `zeronix_bi`, user `zeronix_bi`.
- **Host port 5442**, published on **loopback only** (`127.0.0.1:${ZI_DB_PORT:-5442}:5432`). 5442 is free, below the Windows dynamic port range (49152+) and outside reserved ranges. One env var, `ZI_DB_PORT`, drives both compose and `DATABASE_URL`.
- `DATABASE_URL` uses **`127.0.0.1`**, never `localhost`.
- Image **`postgres:17` (Debian)**, not Alpine, so a later move to the `pgvector/pgvector:pg17` image keeps the data directory collation-compatible.
- **Updated 2026-09-20:** no extra test, e2e or scratch databases are created during development; manual verification uses the project database `zeronix_bi` (with `TEST`-labelled data, never bulk synthetic data, never a reset). The pre-existing integration tests still use a `zeronix_bi_test` database created on demand by their setup, and the stabilization phase (`docs/plans/STABILIZATION.md`) must decide how to test database behaviour safely without risking project data.
- This repository never references the other project's container, volume, database or port 5432.

## Consequences
- No collision with, and no risk to, the other project's data.
- The database is not reachable from other machines.
- If 5442 is ever taken, change `ZI_DB_PORT` in `.env`.
