-- Et medlem kan nu have flere roller. Eksisterende medlemmer beholder præcis den rolle, de havde.
ALTER TABLE "Membership" ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT ARRAY['SPILLER']::"Role"[];
UPDATE "Membership" SET "roles" = ARRAY["role"];

ALTER TABLE "Membership" ADD COLUMN "guideRoles" "Role"[] NOT NULL DEFAULT ARRAY[]::"Role"[];
UPDATE "Membership" SET "guideRoles" = ARRAY["guideRole"] WHERE "guideRole" IS NOT NULL;

-- DropIndex
DROP INDEX "Membership_teamId_role_idx";

-- AlterTable
ALTER TABLE "Membership" DROP COLUMN "role",
DROP COLUMN "guideRole";
