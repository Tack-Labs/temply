# syntax=docker/dockerfile:1
FROM oven/bun:1.4.2 AS bun
FROM node:22-bookworm-slim AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

FROM base AS dependencies
COPY package.json bun.lock ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
COPY e2e/package.json e2e/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
# Railway supplies service variables as build args. Only public values are
# baked into the client; Clerk's real secret and the API keys stay at runtime.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_SALES_EMAIL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
RUN test -n "$NEXT_PUBLIC_APP_URL" && test -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
RUN cd client && CLERK_SECRET_KEY=sk_test_placeholder bun run build
RUN cd server && bun run build

FROM base AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up \
    SQLITE_DB_PATH=/data/maily.db BACKUP_DIR=/data/backups
COPY --from=build /app/client/.next/standalone ./
COPY --from=build /app/client/.next/static ./client/.next/static
COPY --from=build /app/client/public ./client/public
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/scripts/backup-db.ts ./server/scripts/backup-db.ts
COPY deploy/railway/start.sh ./deploy/railway/start.sh
EXPOSE 8080
ENTRYPOINT ["tini", "--"]
CMD ["bash", "deploy/railway/start.sh"]
