import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./prisma";
import { checkRateLimit, getClientIp, normalizeIp } from "./rateLimit";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn(), authRateLimit: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) } }
}));

afterEach(() => vi.clearAllMocks());

describe("normalizeIp", () => {
  it("keeps IPv4 and unwraps IPv4-mapped IPv6", () => {
    expect(normalizeIp("203.0.113.7")).toBe("203.0.113.7");
    expect(normalizeIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("groups IPv6 on the /64 prefix, so rotating inside a prefix does not help", () => {
    const a = normalizeIp("2001:db8:abcd:12::1");
    const b = normalizeIp("2001:DB8:abcd:0012:ffff:ffff:ffff:ffff");
    expect(a).toBe("2001:0db8:abcd:0012::/64");
    expect(b).toBe(a);
    expect(normalizeIp("2001:db8:abcd:13::1")).not.toBe(a);
  });
});

describe("getClientIp", () => {
  it("prefers the platform-set header over a client-supplied x-forwarded-for", () => {
    const headers = new Headers({ "x-vercel-forwarded-for": "198.51.100.9", "x-forwarded-for": "6.6.6.6, 198.51.100.9" });
    expect(getClientIp(headers)).toBe("198.51.100.9");
  });

  it("falls back to x-real-ip, then the first x-forwarded-for, then 'unknown'", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
    expect(getClientIp(new Headers({ "x-forwarded-for": "198.51.100.2, 10.0.0.1" }))).toBe("198.51.100.2");
    expect(getClientIp(new Headers())).toBe("unknown");
  });

  it("reads plain header objects (NextAuth)", () => {
    expect(getClientIp({ "x-forwarded-for": ["198.51.100.3"] })).toBe("198.51.100.3");
  });
});

describe("checkRateLimit", () => {
  it("allows up to the limit and blocks beyond it", async () => {
    const raw = vi.mocked(prisma.$queryRaw);
    raw.mockResolvedValueOnce([{ count: 3 }]);
    expect(await checkRateLimit("k", 3, 60)).toEqual({ allowed: true, count: 3 });
    raw.mockResolvedValueOnce([{ count: 4 }]);
    expect(await checkRateLimit("k", 3, 60)).toEqual({ allowed: false, count: 4 });
  });
});
