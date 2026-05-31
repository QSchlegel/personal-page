-- Idempotent repair: on the production database, 0_init was adopted as a
-- baseline against a pre-existing (shared) schema that never had the
-- UserProfile table, so `prisma.userProfile.findUnique()` on /account threw
-- P2021 ("table public.UserProfile does not exist") and the page 500'd.
--
-- Recreate UserProfile exactly as 0_init defines it, guarded so it is a no-op
-- on every environment where the table already exists. Mirrors the guarded
-- style of 2_add_newsletter / 5_add_email_verification.

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "headline" TEXT,
    "bio" TEXT,
    "twitterUrl" TEXT,
    "githubUrl" TEXT,
    "websiteUrl" TEXT,
    "emailVisible" BOOLEAN NOT NULL DEFAULT true,
    "socialsVisible" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserProfile_userId_key" ON "public"."UserProfile"("userId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."UserProfile"
        ADD CONSTRAINT "UserProfile_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
