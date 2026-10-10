-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('TRAINING', 'MATCH');

-- AlterTable
ALTER TABLE "EventSeries" ADD COLUMN "kind" "EventKind" NOT NULL DEFAULT 'TRAINING';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "kind" "EventKind" NOT NULL DEFAULT 'TRAINING';
ALTER TABLE "Event" ADD COLUMN "matchHomeGoals" INTEGER;
ALTER TABLE "Event" ADD COLUMN "matchAwayGoals" INTEGER;

UPDATE "Event" SET "kind" = 'MATCH' WHERE "source" = 'ICAL';

-- CreateTable
CREATE TABLE "EventMatchPlayerStat" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventMatchPlayerStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventMatchPlayerStat_eventId_userId_key" ON "EventMatchPlayerStat"("eventId", "userId");

CREATE INDEX "EventMatchPlayerStat_eventId_idx" ON "EventMatchPlayerStat"("eventId");

CREATE INDEX "EventMatchPlayerStat_userId_idx" ON "EventMatchPlayerStat"("userId");

CREATE INDEX "Event_teamId_kind_date_idx" ON "Event"("teamId", "kind", "date");

ALTER TABLE "EventMatchPlayerStat" ADD CONSTRAINT "EventMatchPlayerStat_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventMatchPlayerStat" ADD CONSTRAINT "EventMatchPlayerStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
