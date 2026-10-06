# Production image for Zeronix Intelligence (Next.js 16 / App Router, Prisma 7 + @prisma/adapter-pg, PostgreSQL).
#
# Targets:
#   runner   (default) - the application server. Standalone Next.js build, non-root, listens on 0.0.0.0:3000.
#   migrator            - `prisma migrate deploy` only. Same source, not part of the runner image. Used by the
#                         one-off `migrate` service in compose.yaml (never auto-run by the app container).
#
# Build (from repo root):
#   docker build --target runner   -t zeronix-app .
#   docker build --target migrator -t zeronix-migrate .
# (compose.yaml does both via `docker compose build`.)

ARG NODE_IMAGE=node:26-bookworm-slim

# ---------------------------------------------------------------------------
# deps: install once, reused by both the build and the migrator stage.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
# The `openssl` CLI must be present before `npm ci`: Prisma's postinstall probes it to pick the matching engine build
# (Debian bookworm ships OpenSSL 3.0). Without it, Prisma silently falls back to an openssl-1.1.x engine that does
# not match this image's libssl, which only breaks later, when `migrate deploy` actually runs it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Full install (incl. devDependencies): `next build` type-checks and needs Tailwind/PostCSS, and `prisma generate`/
# `migrate deploy` need the Prisma CLI. None of this ships in the runner image (see "runner" below).
RUN npm ci

# ---------------------------------------------------------------------------
# builder: generate the Prisma client and produce the Next.js standalone build.
# ---------------------------------------------------------------------------
FROM deps AS builder
WORKDIR /app
COPY . .
# A connection string is required by prisma.config.ts to load, but no database needs to be reachable at build time
# (`prisma generate` only reads the schema; no migration runs here).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run build

# ---------------------------------------------------------------------------
# migrator: applies migrations only. Full node_modules (Prisma CLI + schema engine), not the runtime image.
# ---------------------------------------------------------------------------
FROM builder AS migrator
WORKDIR /app
ENV NODE_ENV=production
ENTRYPOINT ["npx", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------
# runner: the application server. Only the standalone trace output + static assets, non-root, no build tools,
# no secrets baked in (all configuration arrives as environment variables at `docker run`/compose time).
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

# Headless Chromium for the quotation PDF (src/modules/quotations/pdf.ts): no browser ships inside a container
# image, so one is installed here and pointed to explicitly. ca-certificates for outbound TLS (IMAP/SMTP sync,
# AI provider APIs).
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    PDF_BROWSER_PATH=/usr/bin/chromium \
    PDF_NO_SANDBOX=1

# `node` (uid 1000) already exists in the official image; the app runs as that user, not root.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Static reference content read from disk at runtime (src/modules/knowledge), relative to process.cwd(); not
# picked up by Next's file-tracing because the path is built at runtime, not statically imported.
COPY --from=builder --chown=node:node /app/knowledge ./knowledge

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
