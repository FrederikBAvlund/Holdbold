-- CreateEnum
CREATE TYPE "EventLogType" AS ENUM ('SIGNUP', 'CANCEL', 'REOPEN');

-- CreateEnum
CREATE TYPE "FineTemplateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "FineTemplate" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "status" "FineTemplateStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "EventLogType" NOT NULL DEFAULT 'SIGNUP',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventLog_eventId_createdAt_idx" ON "EventLog"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "FineTemplate_teamId_status_idx" ON "FineTemplate"("teamId", "status");

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineTemplate" ADD CONSTRAINT "FineTemplate_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineTemplate" ADD CONSTRAINT "FineTemplate_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
