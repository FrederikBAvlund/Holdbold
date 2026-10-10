-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- AlterTable (nullable først, så eksisterende data kan backfilles)
ALTER TABLE "EventSeries" ADD COLUMN "seasonId" TEXT;
ALTER TABLE "Event" ADD COLUMN "seasonId" TEXT;
ALTER TABLE "Fine" ADD COLUMN "seasonId" TEXT;

-- Backfill: én første sæson pr. eksisterende hold
INSERT INTO "Season" ("id", "teamId", "name", "startedAt")
SELECT 'season_' || "id", "id", 'Sæson 1', "createdAt" FROM "Team";

UPDATE "EventSeries" SET "seasonId" = 'season_' || "teamId";
UPDATE "Event" SET "seasonId" = 'season_' || "teamId";
UPDATE "Fine" SET "seasonId" = 'season_' || "teamId";

ALTER TABLE "EventSeries" ALTER COLUMN "seasonId" SET NOT NULL;
ALTER TABLE "Event" ALTER COLUMN "seasonId" SET NOT NULL;
ALTER TABLE "Fine" ALTER COLUMN "seasonId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Season_teamId_closedAt_idx" ON "Season"("teamId", "closedAt");
CREATE INDEX "Event_seasonId_idx" ON "Event"("seasonId");
CREATE INDEX "Fine_teamId_seasonId_idx" ON "Fine"("teamId", "seasonId");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventSeries" ADD CONSTRAINT "EventSeries_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
