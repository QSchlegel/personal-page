-- Repair schema drift between schema.prisma and the production database.
--
-- Symptoms observed in Railway logs:
--   1. POST /api/auth/sign-up/email -> HTTP 500
--      Prisma P2022: The column `Account.idToken` does not exist
--          at linkAccount (better-auth) → prisma.account.create
--      Root cause of "Could not create session" when the Secure Chat flow
--      tries to bootstrap a session for passkey registration.
--   2. Prisma P2021: The table `public.ProjectCache` does not exist
--      The timeline route falls back to live GitHub, but the table is
--      expected by the cron sync job.
--
-- 0_init declares both, so production was created from an earlier baseline
-- and has been drifting since. Every statement below is idempotent
-- (IF NOT EXISTS), so this is safe to run on environments that are
-- already in sync.

-- Account: ensure every column declared in schema.prisma exists.
ALTER TABLE "public"."Account" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "public"."Account" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "public"."Account" ADD COLUMN IF NOT EXISTS "accessToken" TEXT;
ALTER TABLE "public"."Account" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT;
ALTER TABLE "public"."Account" ADD COLUMN IF NOT EXISTS "idToken" TEXT;
ALTER TABLE "public"."Account" ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "public"."Account" ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "public"."Account" ADD COLUMN IF NOT EXISTS "scope" TEXT;
ALTER TABLE "public"."Account" ADD COLUMN IF NOT EXISTS "password" TEXT;

-- ProjectCache: recreate the cached GitHub project table if missing.
CREATE TABLE IF NOT EXISTS "public"."ProjectCache" (
    "id" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT,
    "homepage" TEXT,
    "htmlUrl" TEXT NOT NULL,
    "createdAtGithub" TIMESTAMP(3) NOT NULL,
    "updatedAtGithub" TIMESTAMP(3) NOT NULL,
    "pushedAtGithub" TIMESTAMP(3),
    "stars" INTEGER NOT NULL DEFAULT 0,
    "isFork" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectCache_repoName_key" ON "public"."ProjectCache"("repoName");
