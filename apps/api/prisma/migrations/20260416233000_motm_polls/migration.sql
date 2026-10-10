-- CreateEnum
CREATE TYPE "EventMotmPollStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "matchMotmUserId" TEXT;

-- CreateTable
CREATE TABLE "EventMotmPoll" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "EventMotmPollStatus" NOT NULL DEFAULT 'OPEN',
    "votesPerVoter" INTEGER NOT NULL,
    "revealCount" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMotmPoll_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventMotmBallot" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMotmBallot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventMotmVote" (
    "id" TEXT NOT NULL,
    "ballotId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "EventMotmVote_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Event_matchMotmUserId_idx" ON "Event"("matchMotmUserId");
CREATE UNIQUE INDEX "EventMotmPoll_eventId_key" ON "EventMotmPoll"("eventId");
CREATE INDEX "EventMotmPoll_status_idx" ON "EventMotmPoll"("status");
CREATE UNIQUE INDEX "EventMotmBallot_pollId_voterId_key" ON "EventMotmBallot"("pollId", "voterId");
CREATE INDEX "EventMotmBallot_pollId_idx" ON "EventMotmBallot"("pollId");
CREATE INDEX "EventMotmBallot_voterId_idx" ON "EventMotmBallot"("voterId");
CREATE INDEX "EventMotmVote_ballotId_idx" ON "EventMotmVote"("ballotId");
CREATE INDEX "EventMotmVote_targetUserId_idx" ON "EventMotmVote"("targetUserId");

-- Foreign Keys
ALTER TABLE "Event" ADD CONSTRAINT "Event_matchMotmUserId_fkey" FOREIGN KEY ("matchMotmUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventMotmPoll" ADD CONSTRAINT "EventMotmPoll_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMotmPoll" ADD CONSTRAINT "EventMotmPoll_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMotmBallot" ADD CONSTRAINT "EventMotmBallot_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "EventMotmPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMotmBallot" ADD CONSTRAINT "EventMotmBallot_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMotmVote" ADD CONSTRAINT "EventMotmVote_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "EventMotmBallot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMotmVote" ADD CONSTRAINT "EventMotmVote_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
