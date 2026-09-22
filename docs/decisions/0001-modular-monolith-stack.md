# 0001. Modular monolith on Next.js, Prisma and PostgreSQL

**Status:** Accepted (2026-09-20)

## Context
The product is an internal tool for a small team. It needs strong relational integrity and a fast path from idea to a usable procurement workflow. `PROJECT_PLAN.MD` explicitly rules out microservices and premature infrastructure.

## Decision
- One Next.js (App Router) application; business logic in a service layer per module; Prisma over PostgreSQL. React Server Components and Server Actions, no separate API service.
- Tailwind CSS v4 and shadcn/ui primitives, Geist typography, Lucide icons.
- zod for validation, shared between forms and services. `useActionState` for forms (no react-hook-form). URL search params for table state with server-side pagination and filtering (no TanStack Table).
- Vitest for unit and workflow tests.
- **Versions pinned deliberately** (verified against npm on 2026-09-20): Next 16.3.5, React 19.2.8 (the version Next 16.3.5 is scaffolded and tested with), Prisma 7.10 (npm's `latest` is the 8.0 release candidate), TypeScript 5.9 (7.x is not supported by typescript-eslint yet), Tailwind 4.3, zod 4.6, Vitest 5.

## Consequences
- Simple local development: only PostgreSQL in Docker.
- Integrity lives in the database and the service layer; the UI stays thin.
- Fewer dependencies to maintain. If tables outgrow server-side filtering or forms become complex, TanStack Table or react-hook-form can be adopted then, with a reason.
- Upgrading Prisma to 8 or TypeScript to 7 is a deliberate future task.
