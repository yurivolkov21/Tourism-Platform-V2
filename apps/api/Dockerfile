# syntax=docker/dockerfile:1
# Build context = REPO ROOT (monorepo): docker build -f apps/api/Dockerfile .
# Image này kiêm luôn artifact deploy (Render/Railway/VPS) — ADR-0001 mục Docker.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── deps: cache install theo lockfile ────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY libs/shared/contract/package.json libs/shared/contract/
COPY libs/shared/tokens/package.json libs/shared/tokens/
COPY libs/shared/i18n/package.json libs/shared/i18n/
RUN pnpm install --frozen-lockfile

# ── build: generate Prisma client + build api và workspace deps ──────────────
FROM deps AS build
COPY . .
RUN pnpm --filter @tourism/api db:generate \
  && pnpm turbo run build --filter=@tourism/api... \
  && pnpm --filter=@tourism/api --prod deploy --legacy /out

# ── runner: slim, chỉ prod deps + dist ───────────────────────────────────────
FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
EXPOSE 3001
# Worker dùng chung image: override command thành `node dist/worker.js`
CMD ["node", "dist/main.js"]
