import type { PrismaClient } from "@prisma/client";

/** Use a separate client so the held lock cannot exhaust the job's DB pool. */
export async function withScheduledJobLock<T>(client: PrismaClient, job: () => Promise<T>) {
  return client.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(721834, 1) AS acquired
    `;
    if (!lock?.acquired) return { ok: true, skipped: true, reason: "job-already-running" };
    return job();
  }, { timeout: 30 * 60 * 1000, maxWait: 5000 });
}
