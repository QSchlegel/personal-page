-- AlterTable: add image column to User
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "image" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."ProjectOverride" (
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

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectOverride_repoName_key" ON "public"."ProjectOverride"("repoName");
