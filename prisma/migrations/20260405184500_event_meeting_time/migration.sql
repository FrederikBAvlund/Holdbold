ALTER TABLE "Event" ADD COLUMN "meetingTime" TIMESTAMP(3);

UPDATE "Event"
SET "meetingTime" = "date" - INTERVAL '1 hour'
WHERE "source" = 'ICAL' AND "meetingTime" IS NULL;
