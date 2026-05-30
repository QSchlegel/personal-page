-- CreateEnum
CREATE TYPE "public"."SubscriberStatus" AS ENUM ('PENDING', 'CONFIRMED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "public"."BroadcastStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "public"."Subscriber" (
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
CREATE TABLE "public"."DownloadLead" (
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
CREATE TABLE "public"."NewsletterBroadcast" (
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
CREATE TABLE "public"."NewsletterSend" (
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
CREATE UNIQUE INDEX "Subscriber_email_key" ON "public"."Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_confirmToken_key" ON "public"."Subscriber"("confirmToken");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_unsubscribeToken_key" ON "public"."Subscriber"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "Subscriber_status_idx" ON "public"."Subscriber"("status");

-- CreateIndex
CREATE INDEX "DownloadLead_email_idx" ON "public"."DownloadLead"("email");

-- CreateIndex
CREATE INDEX "DownloadLead_slug_idx" ON "public"."DownloadLead"("slug");

-- CreateIndex
CREATE INDEX "NewsletterBroadcast_status_idx" ON "public"."NewsletterBroadcast"("status");

-- CreateIndex
CREATE INDEX "NewsletterBroadcast_createdAt_idx" ON "public"."NewsletterBroadcast"("createdAt");

-- CreateIndex
CREATE INDEX "NewsletterSend_broadcastId_idx" ON "public"."NewsletterSend"("broadcastId");

-- CreateIndex
CREATE INDEX "NewsletterSend_subscriberId_idx" ON "public"."NewsletterSend"("subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSend_broadcastId_subscriberId_key" ON "public"."NewsletterSend"("broadcastId", "subscriberId");

-- AddForeignKey
ALTER TABLE "public"."NewsletterSend" ADD CONSTRAINT "NewsletterSend_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "public"."NewsletterBroadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NewsletterSend" ADD CONSTRAINT "NewsletterSend_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "public"."Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
