-- AlterTable
ALTER TABLE "Team"
ADD COLUMN "mobilePayBox" TEXT;

-- CreateTable
CREATE TABLE "FineCollection" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "deadlineAt" TIMESTAMP(3) NOT NULL,
  "intervalHours" INTEGER NOT NULL DEFAULT 24,
  "lastRunAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FineCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FineCollection_teamId_isActive_idx" ON "FineCollection"("teamId", "isActive");

-- CreateIndex
CREATE INDEX "FineCollection_deadlineAt_idx" ON "FineCollection"("deadlineAt");

-- AddForeignKey
ALTER TABLE "FineCollection"
ADD CONSTRAINT "FineCollection_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineCollection"
ADD CONSTRAINT "FineCollection_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "FineTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineCollection"
ADD CONSTRAINT "FineCollection_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
