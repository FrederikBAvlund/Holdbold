-- CreateEnum
CREATE TYPE "FineAutomationAction" AS ENUM ('MISSED_SIGNUP_AT_DEADLINE', 'STATUS_CHANGE_AFTER_DEADLINE', 'SAME_DAY_WITHDRAWAL');
CREATE TYPE "FineAutomationScope" AS ENUM ('ALL', 'TRAINING', 'MATCH');

-- AlterTable
ALTER TABLE "Fine" ADD COLUMN "automationAction" "FineAutomationAction";

-- CreateTable
CREATE TABLE "FineAutomationSetting" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "action" "FineAutomationAction" NOT NULL,
    "scope" "FineAutomationScope" NOT NULL DEFAULT 'ALL',
    "templateId" TEXT NOT NULL,
    "excludedRoles" "Role"[] NOT NULL DEFAULT ARRAY['SOME']::"Role"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FineAutomationSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FineAutomationSetting_teamId_action_scope_key" ON "FineAutomationSetting"("teamId", "action", "scope");
CREATE INDEX "FineAutomationSetting_teamId_action_idx" ON "FineAutomationSetting"("teamId", "action");

ALTER TABLE "FineAutomationSetting" ADD CONSTRAINT "FineAutomationSetting_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FineAutomationSetting" ADD CONSTRAINT "FineAutomationSetting_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FineTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop legacy FineRule
ALTER TABLE "FineRule" DROP CONSTRAINT IF EXISTS "FineRule_teamId_fkey";
ALTER TABLE "FineRule" DROP CONSTRAINT IF EXISTS "FineRule_createdById_fkey";
DROP TABLE IF EXISTS "FineRule";

DROP TYPE IF EXISTS "FineTrigger";
