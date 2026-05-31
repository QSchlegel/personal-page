FROM node:20.19.0-alpine AS base

# ── Stage 1: Install all dependencies (for build) ──
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# ── Stage 2: Build ──
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate && npm run build

# ── Stage 3: Production runner ──
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install full prod runtime deps. We can't rely on Next.js standalone tracing
# for the Prisma CLI (it isn't imported by app code), and prisma 6.19+ pulls
# in a tangle of transitives (effect, c12, deepmerge-ts, empathic, jiti,
# fast-check, …) that don't fit cherry-picking. `npm ci --omit=dev` resolves
# them correctly — the prisma CLI is in `dependencies` so it's included.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Next.js standalone bundle pieces — only the parts that aren't node_modules
# (we already installed those above).
COPY --from=builder /app/.next/standalone/server.js ./
COPY --from=builder /app/.next/standalone/.next ./.next
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Overlay the generated Prisma client (`prisma generate` ran in builder).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Ensure the runtime user can write Next's ISR / Image-Optimization cache.
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Migration startup:
# - One-time `resolve --rolled-back …` cleanups for migrations that have been
#   stuck in FAILED state on the prod database. Each harmlessly errors on
#   every other env where the migration is not in failed state (hence
#   `|| true`). After the failed row is gone, `migrate deploy` re-applies the
#   (now idempotent / repaired) migration in order.
#     - 2_add_newsletter: failed because the DeliveryStatus enum from 0_init
#       had drifted off the prod schema (fixed in PR #22).
#     - 4_repair_chat_schema_drift: failed because one of the chat tables
#       existed on prod with the wrong columns and `CREATE INDEX` couldn't
#       find a column it expected. The migration was rewritten to DROP the
#       chat tables CASCADE before recreating them, which is safe because no
#       chat data has ever been written on prod.
# - `migrate deploy` then applies the migrations in order.
# - The server starts regardless of migration outcome so the runtime is
#   self-recovering on flaky DB starts.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate resolve --rolled-back 2_add_newsletter 2>/dev/null || true; node node_modules/prisma/build/index.js migrate resolve --rolled-back 4_repair_chat_schema_drift 2>/dev/null || true; node node_modules/prisma/build/index.js migrate deploy; node server.js"]
