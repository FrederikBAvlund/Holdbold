-- Add new membership role for SoMe users
DO $$
BEGIN
  IF to_regtype('"Role"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum
       WHERE enumlabel = 'SOME'
         AND enumtypid = to_regtype('"Role"')
     ) THEN
    ALTER TYPE "Role" ADD VALUE 'SOME';
  END IF;
END $$;

-- Add event duty assignees (nullable)
ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "thingCarrierId" TEXT,
  ADD COLUMN IF NOT EXISTS "beerCarrierId" TEXT;

-- Foreign keys to users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Event_thingCarrierId_fkey'
  ) THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_thingCarrierId_fkey"
      FOREIGN KEY ("thingCarrierId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Event_beerCarrierId_fkey'
  ) THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_beerCarrierId_fkey"
      FOREIGN KEY ("beerCarrierId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Event_thingCarrierId_idx" ON "Event"("thingCarrierId");
CREATE INDEX IF NOT EXISTS "Event_beerCarrierId_idx" ON "Event"("beerCarrierId");
