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
# - `migrate deploy` applies any pending migrations in order. All migrations
#   are idempotent (guarded CREATE … IF NOT EXISTS / DO-block constraints), so
#   re-running is a no-op on an up-to-date schema.
# - The earlier one-time `migrate resolve --rolled-back 2/4` cleanups were
#   REMOVED on purpose. They ran on every boot and re-marked already-applied
#   migrations as rolled-back — churn that drifts the migration history, and
#   (critically) 4_repair_chat_schema_drift DROPs the chat tables CASCADE, so
#   re-applying it would wipe live secure-chat data. The prod history is now
#   clean (`migrate status` → up to date); these hacks are no longer needed.
# - `&&` (not `;`) before `node server.js`: a failed/incomplete migration must
#   fail the deploy LOUDLY rather than booting the app against a broken schema
#   and serving runtime 500s (e.g. the missing-UserProfile incident). Railway's
#   ON_FAILURE restart policy retries, so a transient DB hiccup still recovers.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
