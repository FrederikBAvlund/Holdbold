import { prisma } from "../src/lib/prisma";
import { runScheduledJobs } from "../src/lib/runScheduledJobs";
import { PrismaClient } from "@prisma/client";
import { withScheduledJobLock } from "../src/lib/scheduledJobLock";

async function main() {
  const lockClient = new PrismaClient();
  try {
    const result = await withScheduledJobLock(lockClient, runScheduledJobs);
    console.info(JSON.stringify({ timestamp: new Date().toISOString(), ...result }));
  } catch (error) {
    console.error("Scheduled jobs failed", error);
    process.exitCode = 1;
  } finally {
    await Promise.all([prisma.$disconnect(), lockClient.$disconnect()]);
  }
}

void main();
