# syntax=docker/dockerfile:1.7
# Multi-stage build for the local Docker Compose run.
# Targets:
#   migrator -> runs `prisma migrate deploy` + seed, then exits (compose service "migrate")
#   runner   -> Next.js standalone server (compose service "app")

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat \
  && npm install -g pnpm@12.4.2
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm prisma generate && pnpm build

# --- migrator: full toolchain, used once per `docker compose up` ---
FROM deps AS migrator
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
RUN pnpm prisma generate
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm db:seed"]

# --- runner: minimal production image ---
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh && mkdir -p /app/.secrets && chown node:node /app/.secrets

USER node
EXPOSE 3000
ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", "server.js"]
