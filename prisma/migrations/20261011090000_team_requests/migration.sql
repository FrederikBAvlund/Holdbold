-- CreateEnum
CREATE TYPE "TeamRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "LoginCode" ADD COLUMN "signupForTeamRequest" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TeamRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "themePreset" TEXT NOT NULL DEFAULT 'graphite',
    "status" "TeamRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "teamId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamRequest_status_createdAt_idx" ON "TeamRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TeamRequest_userId_idx" ON "TeamRequest"("userId");

-- Slug'en er reserveret, mens anmodningen afventer. Godkendt: holdet selv holder koden (Team.slug er unik).
CREATE UNIQUE INDEX "TeamRequest_slug_active_key" ON "TeamRequest"("slug") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "TeamRequest" ADD CONSTRAINT "TeamRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRequest" ADD CONSTRAINT "TeamRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
