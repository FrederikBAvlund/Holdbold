import { afterEach, expect, it, vi } from "vitest";
import { runScheduledJobs } from "@/lib/runScheduledJobs";
import { GET } from "./route";

vi.mock("@/lib/runScheduledJobs", () => ({ runScheduledJobs: vi.fn(async () => ({ ok: true })) }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("disables public cron even when a valid bearer token is supplied", async () => {
  vi.stubEnv("DISABLE_HTTP_CRON", "true");
  vi.stubEnv("CRON_SECRET", "test-secret");
  const response = await GET(new Request("http://localhost/api/cron/fines", {
    headers: { authorization: "Bearer test-secret" }
  }));
  expect(response.status).toBe(404);
  expect(runScheduledJobs).not.toHaveBeenCalled();
});

it("keeps authentication on the legacy production endpoint", async () => {
  vi.stubEnv("DISABLE_HTTP_CRON", "false");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CRON_SECRET", "test-secret");
  expect((await GET(new Request("http://localhost/api/cron/fines"))).status).toBe(401);
  expect(runScheduledJobs).not.toHaveBeenCalled();
});
