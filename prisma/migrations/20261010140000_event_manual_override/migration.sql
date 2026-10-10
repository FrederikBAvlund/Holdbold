-- Markerer begivenheder, som en træner/admin selv har rettet, så iCal/xlsx-import ikke overskriver dem.
ALTER TABLE "Event" ADD COLUMN "manualOverride" BOOLEAN NOT NULL DEFAULT false;
