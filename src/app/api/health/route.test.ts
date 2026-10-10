import { beforeEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

it("reports ready only when the database responds", async () => {
  vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ ok: true });
});

it("reports unavailable without exposing connection details", async () => {
  vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("private DB details"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ok: false });
});
