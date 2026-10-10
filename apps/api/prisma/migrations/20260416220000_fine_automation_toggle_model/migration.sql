-- Replace scope-based rows with one row per (teamId, action) and træning/kamp toggles + templates.

CREATE TABLE "FineAutomationSetting_new" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "action" "FineAutomationAction" NOT NULL,
    "appliesTraining" BOOLEAN NOT NULL DEFAULT false,
    "appliesMatch" BOOLEAN NOT NULL DEFAULT false,
    "templateTrainingId" TEXT,
    "templateMatchId" TEXT,
    "excludedRoles" "Role"[] NOT NULL DEFAULT ARRAY['SOME']::"Role"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FineAutomationSetting_new_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FineAutomationSetting_teamId_action_key" ON "FineAutomationSetting_new"("teamId", "action");
CREATE INDEX "FineAutomationSetting_new_teamId_action_idx" ON "FineAutomationSetting_new"("teamId", "action");

ALTER TABLE "FineAutomationSetting_new" ADD CONSTRAINT "FineAutomationSetting_new_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FineAutomationSetting_new" ADD CONSTRAINT "FineAutomationSetting_new_templateTrainingId_fkey" FOREIGN KEY ("templateTrainingId") REFERENCES "FineTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FineAutomationSetting_new" ADD CONSTRAINT "FineAutomationSetting_new_templateMatchId_fkey" FOREIGN KEY ("templateMatchId") REFERENCES "FineTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "FineAutomationSetting_new" (
    "id",
    "teamId",
    "action",
    "appliesTraining",
    "appliesMatch",
    "templateTrainingId",
    "templateMatchId",
    "excludedRoles",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    min(s."id"),
    s."teamId",
    s."action",
    bool_or(s."scope" IN ('TRAINING', 'ALL')),
    bool_or(s."scope" IN ('MATCH', 'ALL')),
    COALESCE(
        max(CASE WHEN s."scope" = 'TRAINING' THEN s."templateId" END),
        max(CASE WHEN s."scope" = 'ALL' THEN s."templateId" END)
    ),
    COALESCE(
        max(CASE WHEN s."scope" = 'MATCH' THEN s."templateId" END),
        max(CASE WHEN s."scope" = 'ALL' THEN s."templateId" END)
    ),
    ARRAY['SOME']::"Role"[],
    bool_or(s."isActive"),
    min(s."createdAt"),
    max(s."updatedAt")
FROM "FineAutomationSetting" s
GROUP BY s."teamId", s."action";

DROP TABLE "FineAutomationSetting";

ALTER TABLE "FineAutomationSetting_new" RENAME TO "FineAutomationSetting";

ALTER TABLE "FineAutomationSetting" RENAME CONSTRAINT "FineAutomationSetting_new_pkey" TO "FineAutomationSetting_pkey";
ALTER TABLE "FineAutomationSetting" RENAME CONSTRAINT "FineAutomationSetting_new_teamId_fkey" TO "FineAutomationSetting_teamId_fkey";
ALTER TABLE "FineAutomationSetting" RENAME CONSTRAINT "FineAutomationSetting_new_templateTrainingId_fkey" TO "FineAutomationSetting_templateTrainingId_fkey";
ALTER TABLE "FineAutomationSetting" RENAME CONSTRAINT "FineAutomationSetting_new_templateMatchId_fkey" TO "FineAutomationSetting_templateMatchId_fkey";

UPDATE "FineAutomationSetting" SET "appliesTraining" = false WHERE "templateTrainingId" IS NULL;
UPDATE "FineAutomationSetting" SET "appliesMatch" = false WHERE "templateMatchId" IS NULL;

DROP TYPE IF EXISTS "FineAutomationScope";
