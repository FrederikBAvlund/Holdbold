/*
  Warnings:

  - You are about to drop the column `time` on the `EventSeries` table. All the data in the column will be lost.
  - You are about to drop the column `weekday` on the `EventSeries` table. All the data in the column will be lost.
  - Added the required column `recurrence` to the `EventSeries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `EventSeries` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "EventSeries" DROP COLUMN "time",
DROP COLUMN "weekday",
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "interval" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "recurrence" "Recurrence" NOT NULL,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "themePreset" TEXT NOT NULL DEFAULT 'atlantic';
