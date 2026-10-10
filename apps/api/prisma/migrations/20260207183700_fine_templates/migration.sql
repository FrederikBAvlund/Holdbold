-- DropForeignKey
ALTER TABLE "Fine" DROP CONSTRAINT "Fine_createdById_fkey";

-- AlterTable
ALTER TABLE "Fine" ADD COLUMN     "createdByLabel" TEXT,
ADD COLUMN     "templateId" TEXT,
ALTER COLUMN "createdById" DROP NOT NULL;

-- CreateTable
CREATE TABLE "FineTemplate" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FineTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FineTemplate_teamId_idx" ON "FineTemplate"("teamId");

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FineTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineTemplate" ADD CONSTRAINT "FineTemplate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineTemplate" ADD CONSTRAINT "FineTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
