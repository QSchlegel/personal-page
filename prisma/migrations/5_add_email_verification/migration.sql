-- Idempotent migration: mirrors the guarded style of 2_add_newsletter so it
-- applies cleanly on environments that may have drifted from the baseline.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."EmailVerificationKind" AS ENUM ('ASSOCIATE', 'CLAIM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."EmailVerificationLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kind" "public"."EmailVerificationKind" NOT NULL,
    "bootstrapUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "email" TEXT NOT NULL,
    "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false,
    "consentText" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationLink_tokenHash_key" ON "public"."EmailVerificationLink"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailVerificationLink_bootstrapUserId_idx" ON "public"."EmailVerificationLink"("bootstrapUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailVerificationLink_expiresAt_idx" ON "public"."EmailVerificationLink"("expiresAt");
