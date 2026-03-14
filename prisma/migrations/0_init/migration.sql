-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ThreadStatus" AS ENUM ('OPEN', 'RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."ThreadKind" AS ENUM ('PRIVATE');

-- CreateEnum
CREATE TYPE "public"."SenderType" AS ENUM ('USER', 'BOT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."BotEventStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "public"."DeliveryStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "providerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Verification" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "identifier" TEXT NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Passkey" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aaguid" TEXT,

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserProfile" (
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

-- CreateTable
CREATE TABLE "public"."ProjectCache" (
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

-- CreateTable
CREATE TABLE "public"."ProjectOverride" (
    "id" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredOrder" INTEGER,
    "label" TEXT,
    "summary" TEXT,
    "iframeUrl" TEXT,
    "hide" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectOverride_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "public"."Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "public"."Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "public"."Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "public"."Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "public"."Verification"("identifier");

-- CreateIndex
CREATE INDEX "Verification_expiresAt_idx" ON "public"."Verification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialID_key" ON "public"."Passkey"("credentialID");

-- CreateIndex
CREATE INDEX "Passkey_userId_idx" ON "public"."Passkey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "public"."UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCache_repoName_key" ON "public"."ProjectCache"("repoName");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectOverride_repoName_key" ON "public"."ProjectOverride"("repoName");

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

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "public"."AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "public"."AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
┌─────────────────────────────────────────────────────────┐
│  Update available 6.16.2 -> 7.5.0                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘

