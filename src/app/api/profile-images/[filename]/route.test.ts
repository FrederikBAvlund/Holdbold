import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst: vi.fn() } } }));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));

const request = new Request("http://localhost/api/profile-images/avatar.jpg");
const params = { params: { filename: "avatar.jpg" } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LOCAL_PROFILE_UPLOAD_DIR", "/data/profile-images");
});
afterEach(() => vi.unstubAllEnvs());

describe("private profile images", () => {
  it("requires login before reading a file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect((await GET(request, params)).status).toBe(401);
    expect(readFile).not.toHaveBeenCalled();
  });
  it("rejects traversal before querying access", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "viewer" } });
    expect((await GET(request, { params: { filename: "../secret.jpg" } })).status).toBe(404);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
  it("does not read a file without owner or shared active team access", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "viewer" } });
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    expect((await GET(request, params)).status).toBe(404);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        image: "/api/profile-images/avatar.jpg",
        OR: [
          { id: "viewer" },
          { memberships: { some: {
            status: "ACTIVE",
            team: { memberships: { some: { userId: "viewer", status: "ACTIVE" } } }
          } } }
        ]
      }
    }));
    expect(readFile).not.toHaveBeenCalled();
  });
  it("serves an authorized image without public caching", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "viewer" } });
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "owner" } as never);
    vi.mocked(readFile).mockResolvedValue(Buffer.from("image"));
    const response = await GET(request, params);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(readFile).toHaveBeenCalledWith("/data/profile-images/avatar.jpg");
  });
});
