-- CreateEnum
CREATE TYPE "GuideStepStatus" AS ENUM ('SEEN', 'DONE', 'SKIPPED');

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "guideDismissedAt" TIMESTAMP(3),
ADD COLUMN     "guideRole" "Role";

-- CreateTable
CREATE TABLE "GuideProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" "GuideStepStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuideProgress_teamId_idx" ON "GuideProgress"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "GuideProgress_userId_teamId_stepId_key" ON "GuideProgress"("userId", "teamId", "stepId");

-- AddForeignKey
ALTER TABLE "GuideProgress" ADD CONSTRAINT "GuideProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideProgress" ADD CONSTRAINT "GuideProgress_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Eksisterende aktive medlemmer kender allerede appen: ingen velkomst, men forfremmelser herfra viser de nye dele
UPDATE "Membership" SET "guideRole" = "role" WHERE "status" = 'ACTIVE';
