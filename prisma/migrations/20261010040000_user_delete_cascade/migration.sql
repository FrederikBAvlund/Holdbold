-- Brugere skal kunne slettes helt (GDPR): data, der hører til brugeren, følger med i sletningen.

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_userId_fkey";
ALTER TABLE "EventSeries" DROP CONSTRAINT "EventSeries_createdById_fkey";
ALTER TABLE "Signup" DROP CONSTRAINT "Signup_userId_fkey";
ALTER TABLE "Absence" DROP CONSTRAINT "Absence_userId_fkey";
ALTER TABLE "SignupLog" DROP CONSTRAINT "SignupLog_signupId_fkey";
ALTER TABLE "SignupLog" DROP CONSTRAINT "SignupLog_userId_fkey";
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";
ALTER TABLE "Fine" DROP CONSTRAINT "Fine_userId_fkey";
ALTER TABLE "FineCollection" DROP CONSTRAINT "FineCollection_createdById_fkey";

-- AlterTable
ALTER TABLE "EventSeries" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "FineCollection" ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventSeries" ADD CONSTRAINT "EventSeries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Signup" ADD CONSTRAINT "Signup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignupLog" ADD CONSTRAINT "SignupLog_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "Signup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignupLog" ADD CONSTRAINT "SignupLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FineCollection" ADD CONSTRAINT "FineCollection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
