-- Hemmelig nøgle til personlig kalenderfeed (iCal-abonnement).
ALTER TABLE "User" ADD COLUMN "calendarToken" TEXT;
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");
