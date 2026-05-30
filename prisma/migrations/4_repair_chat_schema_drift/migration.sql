-- Repair the rest of the schema drift between schema.prisma and the
-- production database. The whole chat surface from 0_init (Thread,
-- ThreadParticipant, Message, BotIdentity, BotApiKey, BotEvent,
-- BotDeliveryAttempt + four enums + indexes + 14 foreign keys) is
-- missing on prod, observed via Railway logs:
--
--   The table `public.Thread` does not exist in the current database.
--   prisma.thread.findMany invocation → P2021
--
-- Same defensive idempotent pattern as 2_add_newsletter (post-PR #22) and
-- 3_repair_schema_drift: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT
-- EXISTS, CREATE TYPE / ALTER TABLE ADD CONSTRAINT wrapped in
-- DO $$ … EXCEPTION WHEN duplicate_object blocks. No-op on every env that
-- is already in sync, fills in exactly the missing pieces on prod.
--
-- We intentionally do NOT edit 3_repair_schema_drift here — that one is
-- already applied on prod (per Railway logs) and editing it would cause
-- a checksum mismatch on the next deploy.

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

-- DeliveryStatus is intentionally NOT created here — it's already covered
-- by the idempotent 2_add_newsletter migration.

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."Thread" (
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
CREATE TABLE IF NOT EXISTS "public"."ThreadParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreadParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."Message" (
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
CREATE TABLE IF NOT EXISTS "public"."BotIdentity" (
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
CREATE TABLE IF NOT EXISTS "public"."BotApiKey" (
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
CREATE TABLE IF NOT EXISTS "public"."BotEvent" (
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
CREATE TABLE IF NOT EXISTS "public"."BotDeliveryAttempt" (
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
CREATE INDEX IF NOT EXISTS "Thread_status_idx" ON "public"."Thread"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Thread_updatedAt_idx" ON "public"."Thread"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ThreadParticipant_userId_idx" ON "public"."ThreadParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ThreadParticipant_threadId_userId_key" ON "public"."ThreadParticipant"("threadId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_threadId_createdAt_idx" ON "public"."Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_senderUserId_idx" ON "public"."Message"("senderUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_senderBotId_idx" ON "public"."Message"("senderBotId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BotIdentity_userId_key" ON "public"."BotIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BotApiKey_keyId_key" ON "public"."BotApiKey"("keyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BotApiKey_userId_idx" ON "public"."BotApiKey"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BotApiKey_botIdentityId_idx" ON "public"."BotApiKey"("botIdentityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BotEvent_recipientUserId_status_idx" ON "public"."BotEvent"("recipientUserId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BotEvent_threadId_idx" ON "public"."BotEvent"("threadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BotDeliveryAttempt_botEventId_idx" ON "public"."BotDeliveryAttempt"("botEventId");

-- AddForeignKey (ALTER TABLE ADD CONSTRAINT has no IF NOT EXISTS; guard each with DO/EXCEPTION.)
DO $$ BEGIN
    ALTER TABLE "public"."Thread" ADD CONSTRAINT "Thread_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."ThreadParticipant" ADD CONSTRAINT "ThreadParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."ThreadParticipant" ADD CONSTRAINT "ThreadParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderBotId_fkey" FOREIGN KEY ("senderBotId") REFERENCES "public"."BotIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."BotIdentity" ADD CONSTRAINT "BotIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."BotApiKey" ADD CONSTRAINT "BotApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."BotApiKey" ADD CONSTRAINT "BotApiKey_botIdentityId_fkey" FOREIGN KEY ("botIdentityId") REFERENCES "public"."BotIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."BotEvent" ADD CONSTRAINT "BotEvent_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."BotEvent" ADD CONSTRAINT "BotEvent_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."BotEvent" ADD CONSTRAINT "BotEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."BotEvent" ADD CONSTRAINT "BotEvent_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."BotDeliveryAttempt" ADD CONSTRAINT "BotDeliveryAttempt_botEventId_fkey" FOREIGN KEY ("botEventId") REFERENCES "public"."BotEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
