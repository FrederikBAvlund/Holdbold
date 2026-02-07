-- AlterTable
ALTER TABLE "Signup" ADD COLUMN     "reason" TEXT;

-- CreateTable
CREATE TABLE "SignupLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SignupStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signupId" TEXT NOT NULL,

    CONSTRAINT "SignupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignupLog_eventId_createdAt_idx" ON "SignupLog"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "SignupLog_userId_createdAt_idx" ON "SignupLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SignupLog_signupId_idx" ON "SignupLog"("signupId");

-- AddForeignKey
ALTER TABLE "SignupLog" ADD CONSTRAINT "SignupLog_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "Signup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupLog" ADD CONSTRAINT "SignupLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupLog" ADD CONSTRAINT "SignupLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
