-- Drop old global URL uniqueness and make iCal feed URL unique per team.
ALTER TABLE "IcalFeed" DROP CONSTRAINT IF EXISTS "IcalFeed_url_key";
ALTER TABLE "IcalFeed" ADD CONSTRAINT "IcalFeed_teamId_url_key" UNIQUE ("teamId", "url");
