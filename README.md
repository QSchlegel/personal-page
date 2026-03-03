# QS Portfolio Platform

A full-stack Next.js portfolio that combines:
- Cinematic landing page with Three.js particle background
- Hybrid GitHub + override project timeline
- Authenticated private comms threads
- Better Auth with GitHub OAuth + Passkeys
- Bot APIs with HMAC authentication and managed relay delivery

## Stack

- Next.js 16 (App Router, SSR)
- React 19
- Prisma + PostgreSQL
- Better Auth + `@better-auth/passkey`
- Three.js via `@react-three/fiber`

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Configure environment

```bash
cp .env.example .env
```

3. Generate Prisma client

```bash
npx prisma generate
```

4. Run migrations (first setup)

```bash
npx prisma migrate dev --name init
```

5. Start development server

```bash
npm run dev
```

## Quick Docker Setup (Local)

1. Optional: create a docker env override file

```bash
cp docker.env.example .env.docker
```

2. Start app + Postgres

```bash
docker compose --env-file .env.docker up --build
```

If `3000` is already in use, pick another host port:

```bash
APP_PORT=3100 docker compose --env-file .env.docker up --build
```

3. Open the app

- App: `http://localhost:3000`
- Postgres: `localhost:5432` (`postgres` / `postgres` by default)

4. Stop services

```bash
docker compose down
```

5. Stop and delete database volume

```bash
docker compose down -v
```

## Required Environment Variables

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `ADMIN_EMAIL_ALLOWLIST`
- `CRON_SECRET`
- `GITHUB_TIMELINE_USER` (default: `QSchlegel`)
- `BOT_RELAY_URL`
- `BOT_RELAY_TOKEN`
- `BOT_HMAC_SECRET_ROTATION_WINDOW_DAYS`
- `NEXT_PUBLIC_SECURE_CHAT_QS_EMAIL` (optional; enables the QS quick-start secure chat button)
- `NEXT_PUBLIC_SECURE_CHAT_QSBOT_EMAIL` (optional; enables the QSBot quick-start secure chat button)

## API Surfaces

### Auth
- `GET|POST /api/auth/[...all]`

### Timeline
- `GET /api/timeline/projects`
- `POST /api/internal/cron/timeline-sync` (`x-cron-secret`)

### Comms
- `GET|POST /api/comms/threads`
- `GET|POST /api/comms/threads/:threadId/messages`

### Admin
- `GET /api/admin/inbox/threads`
- `PATCH /api/admin/inbox/threads/:threadId`

### Bot
- `GET|POST /api/bot/keys`
- `DELETE /api/bot/keys/:keyId`
- `POST /api/bot/messages`
- `GET /api/bot/events`
- `POST /api/bot/events/:eventId/ack`
- `POST /api/bot/relay/deliver`

## HMAC Contract for `/api/bot/*`

Headers:
- `x-bot-key-id`
- `x-bot-timestamp` (unix seconds)
- `x-bot-signature`

Canonical string:

```text
{timestamp}.{METHOD}.{pathname}.{rawBody}
```

Signature:

```text
HMAC_SHA256(keyFingerprint, canonical)
```

Where `keyFingerprint = sha256(secret)` stored server-side.

## Railway Deployment Notes

- Deploy as a Next.js SSR service.
- Use Railway PostgreSQL for `DATABASE_URL`.
- The included [`railway.json`](./railway.json) runs `npm ci --include=dev` during build to ensure dependencies used by the UI and TypeScript build are always installed from lockfile.
- Configure cron at `0 0 * * *` (UTC) to call:
  - `POST /api/internal/cron/timeline-sync`
  - Header: `x-cron-secret: $CRON_SECRET`

## Routes

- `/` portfolio landing
- `/comms` authenticated private thread UI
- `/admin/inbox` admin controls
- `/settings/bot` bot key management
