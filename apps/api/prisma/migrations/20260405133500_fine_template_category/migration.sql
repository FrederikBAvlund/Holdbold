CREATE TYPE "FineCategory" AS ENUM ('SOME', 'FAELLES', 'SPILLER', 'DIVERSE');

ALTER TABLE "FineTemplate"
ADD COLUMN "category" "FineCategory" NOT NULL DEFAULT 'DIVERSE';

CREATE INDEX "FineTemplate_teamId_category_idx" ON "FineTemplate"("teamId", "category");
