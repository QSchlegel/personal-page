-- Repair the chat surface on prod.
--
-- On the first attempt this migration failed with:
--   ERROR: column "threadId" does not exist
--     at CREATE INDEX
--   Migration name: 4_repair_chat_schema_drift   (Prisma P3018, 42703)
--
-- That meant one of the chat tables already existed on prod from an earlier
-- partial state but was missing columns the index referenced. `CREATE TABLE
-- IF NOT EXISTS` skips entirely when the table exists, so the broken column
-- set survived the first attempt.
--
-- Since chat has never actually worked on prod (the migrations never landed
-- successfully), there is no chat data to preserve. The safest repair is
-- therefore: drop the chat-feature tables CASCADE if they exist (clears
-- whatever partial state is on prod, plus any dependent indexes / FKs),
-- then recreate everything from scratch in the same shape 0_init declares.
--
-- This file is idempotent on a clean environment too: `DROP TABLE IF EXISTS`
-- is a no-op when the table is missing, and `DO $$ … EXCEPTION` already
-- guards the enum creation. We deliberately do NOT touch tables outside the
-- chat surface — only Thread / ThreadParticipant / Message / BotIdentity /
-- BotApiKey / BotEvent / BotDeliveryAttempt.
--
-- The CMD in the Dockerfile clears this migration's FAILED state on the
-- next boot via `prisma migrate resolve --rolled-back 4_repair_chat_schema_drift`
-- (mirrors the same trick PR #22 used for `2_add_newsletter`).

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."ThreadStatus" AS ENUM ('OPEN', 'RESOLVED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."ThreadKind" AS ENUM ('PRIVATE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."SenderType" AS ENUM ('USER', 'BOT', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."BotEventStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'ACKNOWLEDGED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DeliveryStatus is created by the idempotent 2_add_newsletter migration.

-- DropTable (chat surface only — cascade clears any partial-state indexes / FKs)
DROP TABLE IF EXISTS "public"."BotDeliveryAttempt" CASCADE;
DROP TABLE IF EXISTS "public"."BotEvent" CASCADE;
DROP TABLE IF EXISTS "public"."BotApiKey" CASCADE;
DROP TABLE IF EXISTS "public"."BotIdentity" CASCADE;
DROP TABLE IF EXISTS "public"."Message" CASCADE;
DROP TABLE IF EXISTS "public"."ThreadParticipant" CASCADE;
DROP TABLE IF EXISTS "public"."Thread" CASCADE;

-- CreateTable
CREATE TABLE "public"."Thread" (
    "id" TEXT NOT NULL,
    "kind" "public"."ThreadKind" NOT NULL DEFAULT 'PRIVATE',
    "status" "public"."ThreadStatus" NOT NULL DEFAULT 'OPEN',
    "aiAutoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ThreadParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreadParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderType" "public"."SenderType" NOT NULL,
    "senderUserId" TEXT,
    "senderBotId" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BotIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "relayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "externalBotRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BotApiKey" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botIdentityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyFingerprint" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BotEvent" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "generatedByUserId" TEXT,
    "status" "public"."BotEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BotDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "botEventId" TEXT NOT NULL,
    "status" "public"."DeliveryStatus" NOT NULL,
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Thread_status_idx" ON "public"."Thread"("status");

-- CreateIndex
CREATE INDEX "Thread_updatedAt_idx" ON "public"."Thread"("updatedAt");

-- CreateIndex
CREATE INDEX "ThreadParticipant_userId_idx" ON "public"."ThreadParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadParticipant_threadId_userId_key" ON "public"."ThreadParticipant"("threadId", "userId");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "public"."Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderUserId_idx" ON "public"."Message"("senderUserId");

-- CreateIndex
CREATE INDEX "Message_senderBotId_idx" ON "public"."Message"("senderBotId");

-- CreateIndex
CREATE UNIQUE INDEX "BotIdentity_userId_key" ON "public"."BotIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BotApiKey_keyId_key" ON "public"."BotApiKey"("keyId");

-- CreateIndex
CREATE INDEX "BotApiKey_userId_idx" ON "public"."BotApiKey"("userId");

-- CreateIndex
CREATE INDEX "BotApiKey_botIdentityId_idx" ON "public"."BotApiKey"("botIdentityId");

-- CreateIndex
CREATE INDEX "BotEvent_recipientUserId_status_idx" ON "public"."BotEvent"("recipientUserId", "status");

-- CreateIndex
CREATE INDEX "BotEvent_threadId_idx" ON "public"."BotEvent"("threadId");

-- CreateIndex
CREATE INDEX "BotDeliveryAttempt_botEventId_idx" ON "public"."BotDeliveryAttempt"("botEventId");

-- AddForeignKey
ALTER TABLE "public"."Thread" ADD CONSTRAINT "Thread_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ThreadParticipant" ADD CONSTRAINT "ThreadParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ThreadParticipant" ADD CONSTRAINT "ThreadParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderBotId_fkey" FOREIGN KEY ("senderBotId") REFERENCES "public"."BotIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotIdentity" ADD CONSTRAINT "BotIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotApiKey" ADD CONSTRAINT "BotApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotApiKey" ADD CONSTRAINT "BotApiKey_botIdentityId_fkey" FOREIGN KEY ("botIdentityId") REFERENCES "public"."BotIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotEvent" ADD CONSTRAINT "BotEvent_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotEvent" ADD CONSTRAINT "BotEvent_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotEvent" ADD CONSTRAINT "BotEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotEvent" ADD CONSTRAINT "BotEvent_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotDeliveryAttempt" ADD CONSTRAINT "BotDeliveryAttempt_botEventId_fkey" FOREIGN KEY ("botEventId") REFERENCES "public"."BotEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
