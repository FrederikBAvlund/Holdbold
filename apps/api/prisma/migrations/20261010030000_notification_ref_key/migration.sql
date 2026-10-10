-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "refKey" TEXT;

-- CreateIndex
CREATE INDEX "Notification_refKey_idx" ON "Notification"("refKey");
