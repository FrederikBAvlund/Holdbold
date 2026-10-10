CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE');

ALTER TABLE "Membership"
ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "Membership_teamId_status_idx" ON "Membership"("teamId", "status");
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");
