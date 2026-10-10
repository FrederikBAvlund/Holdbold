import type { PrismaClient } from "@prisma/client";
import { expect, it, vi } from "vitest";
import { withScheduledJobLock } from "./scheduledJobLock";

function client(acquired: boolean) {
  const tx = { $queryRaw: vi.fn(async () => [{ acquired }]) };
  return { $transaction: vi.fn(async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx)) };
}

it("skips overlapping jobs when PostgreSQL refuses the lock", async () => {
  const db = client(false);
  const job = vi.fn();
  expect(await withScheduledJobLock(db as unknown as PrismaClient, job)).toEqual({
    ok: true, skipped: true, reason: "job-already-running"
  });
  expect(job).not.toHaveBeenCalled();
});

it("returns the job result while holding the transaction lock", async () => {
  const db = client(true);
  const job = vi.fn(async () => ({ teamsProcessed: 3 }));
  expect(await withScheduledJobLock(db as unknown as PrismaClient, job)).toEqual({ teamsProcessed: 3 });
  expect(job).toHaveBeenCalledTimes(1);
});

it("propagates errors so the transaction releases its lock and cron reports failure", async () => {
  const db = client(true);
  await expect(withScheduledJobLock(db as unknown as PrismaClient, async () => {
    throw new Error("job failed");
  })).rejects.toThrow("job failed");
});
