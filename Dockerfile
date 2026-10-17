# syntax=docker/dockerfile:1.7
# Multi-stage build: deps → builder → (migrator | runner | worker).
# Every runtime stage runs as the unprivileged "node" user.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@12.4.2 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
# Build-time env: no secrets needed, the build never touches the database.
ENV APP_ENV=build SKIP_ENV_VALIDATION=1
RUN pnpm build

# ── migrator: applies SQL migrations then (optionally) seeds demo data ────────
FROM deps AS migrator
COPY tsconfig.json drizzle.config.ts ./
COPY src/db ./src/db
COPY src/lib ./src/lib
COPY src/modules ./src/modules
COPY scripts ./scripts
USER node
CMD ["sh", "-c", "pnpm db:migrate && if [ \"$SEED_DEMO\" = \"true\" ]; then pnpm db:seed; fi"]

# ── worker: BullMQ consumers ─────────────────────────────────────────────────
FROM deps AS worker
COPY tsconfig.json ./
COPY src ./src
RUN mkdir -p /app/.secrets && chown node:node /app/.secrets
USER node
CMD ["pnpm", "worker"]

# ── runner: Next.js standalone server ────────────────────────────────────────
FROM node:22-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN mkdir -p /app/.secrets && chown node:node /app/.secrets
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
