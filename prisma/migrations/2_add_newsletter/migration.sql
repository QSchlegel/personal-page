-- Idempotent migration: every statement guards against a partial-apply on
-- environments that have drifted from 0_init (production was created from an
-- earlier baseline that's missing some 0_init-era objects, including the
-- DeliveryStatus enum this migration references).

-- CreateEnum: DeliveryStatus is declared in 0_init but missing on drifted
-- environments. Recreate-if-missing so this migration can reference it.
DO $$ BEGIN
    CREATE TYPE "public"."DeliveryStatus" AS ENUM ('SUCCESS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."SubscriberStatus" AS ENUM ('PENDING', 'CONFIRMED', 'UNSUBSCRIBED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."BroadcastStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" "public"."SubscriberStatus" NOT NULL DEFAULT 'PENDING',
    "confirmToken" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "unsubscribeToken" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),
    "consentText" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "source" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."DownloadLead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ipAddress" TEXT,
    "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."NewsletterBroadcast" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "pagerSlug" TEXT,
    "status" "public"."BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "createdByEmail" TEXT,
    "recipientCount" INTEGER,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."NewsletterSend" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "public"."DeliveryStatus" NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Subscriber_email_key" ON "public"."Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Subscriber_confirmToken_key" ON "public"."Subscriber"("confirmToken");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Subscriber_unsubscribeToken_key" ON "public"."Subscriber"("unsubscribeToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscriber_status_idx" ON "public"."Subscriber"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DownloadLead_email_idx" ON "public"."DownloadLead"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DownloadLead_slug_idx" ON "public"."DownloadLead"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NewsletterBroadcast_status_idx" ON "public"."NewsletterBroadcast"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NewsletterBroadcast_createdAt_idx" ON "public"."NewsletterBroadcast"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NewsletterSend_broadcastId_idx" ON "public"."NewsletterSend"("broadcastId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NewsletterSend_subscriberId_idx" ON "public"."NewsletterSend"("subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterSend_broadcastId_subscriberId_key" ON "public"."NewsletterSend"("broadcastId", "subscriberId");

-- AddForeignKey (ALTER TABLE ADD CONSTRAINT has no IF NOT EXISTS; guard with DO block.)
DO $$ BEGIN
    ALTER TABLE "public"."NewsletterSend" ADD CONSTRAINT "NewsletterSend_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "public"."NewsletterBroadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."NewsletterSend" ADD CONSTRAINT "NewsletterSend_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "public"."Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
