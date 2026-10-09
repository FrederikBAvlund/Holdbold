import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./prisma";
import { sendMail } from "./mail";
import {
  LOGIN_CODE_MAX_ATTEMPTS,
  codesMatch,
  generateLoginCode,
  hashLoginCode,
  requestLoginCode,
  verifyLoginCode
} from "./loginCode";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    membership: { findFirst: vi.fn() },
    loginCode: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() }
  }
}));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn() }));

const db = prisma as unknown as {
  user: { findFirst: ReturnType<typeof vi.fn> };
  membership: { findFirst: ReturnType<typeof vi.fn> };
  loginCode: Record<"findMany" | "findFirst" | "create" | "update" | "updateMany", ReturnType<typeof vi.fn>>;
};

beforeEach(() => vi.stubEnv("NEXTAUTH_SECRET", "test-secret"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("login code helpers", () => {
  it("generates six digits", () => {
    for (let i = 0; i < 50; i++) expect(generateLoginCode()).toMatch(/^\d{6}$/);
  });

  it("binds the hash to the email and code", () => {
    const hash = hashLoginCode("A@b.dk", "123456");
    expect(codesMatch(hash, "a@b.dk", "123456")).toBe(true);
    expect(codesMatch(hash, "a@b.dk", "654321")).toBe(false);
    expect(codesMatch(hash, "other@b.dk", "123456")).toBe(false);
  });
});

describe("requestLoginCode", () => {
  it("sends nothing for unknown emails", async () => {
    db.user.findFirst.mockResolvedValue(null);
    await requestLoginCode("ukendt@b.dk");
    expect(sendMail).not.toHaveBeenCalled();
    expect(db.loginCode.create).not.toHaveBeenCalled();
  });

  it("sends nothing for users without a membership", async () => {
    db.user.findFirst.mockResolvedValue({ id: "u1" });
    db.membership.findFirst.mockResolvedValue(null);
    await requestLoginCode("a@b.dk");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("stores only a hash and mails the code", async () => {
    db.user.findFirst.mockResolvedValue({ id: "u1" });
    db.membership.findFirst.mockResolvedValue({ id: "m1" });
    db.loginCode.findMany.mockResolvedValue([]);
    await requestLoginCode(" A@B.dk ");

    const stored = db.loginCode.create.mock.calls[0][0].data;
    const mail = vi.mocked(sendMail).mock.calls[0][0];
    const code = /Din Holdbold-kode: (\d{6})/.exec(mail.subject)?.[1];
    expect(mail.to).toBe("a@b.dk");
    expect(code).toBeDefined();
    expect(JSON.stringify(stored)).not.toContain(code!);
    expect(codesMatch(stored.codeHash, "a@b.dk", code!)).toBe(true);
  });

  it("respects the resend cooldown and hourly limit", async () => {
    db.user.findFirst.mockResolvedValue({ id: "u1" });
    db.membership.findFirst.mockResolvedValue({ id: "m1" });
    db.loginCode.findMany.mockResolvedValue([{ createdAt: new Date() }]);
    await requestLoginCode("a@b.dk");
    expect(sendMail).not.toHaveBeenCalled();

    db.loginCode.findMany.mockResolvedValue(Array.from({ length: 5 }, () => ({ createdAt: new Date(Date.now() - 600_000) })));
    await requestLoginCode("a@b.dk");
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("verifyLoginCode", () => {
  const record = (overrides = {}) => ({
    id: "c1",
    codeHash: hashLoginCode("a@b.dk", "123456"),
    attempts: 0,
    ...overrides
  });

  it("accepts a correct code once", async () => {
    db.loginCode.findFirst.mockResolvedValue(record());
    db.loginCode.updateMany.mockResolvedValue({ count: 1 });
    expect(await verifyLoginCode("a@b.dk", "123456")).toBe(true);

    db.loginCode.updateMany.mockResolvedValue({ count: 0 });
    expect(await verifyLoginCode("a@b.dk", "123456")).toBe(false);
  });

  it("counts wrong attempts and rejects", async () => {
    db.loginCode.findFirst.mockResolvedValue(record());
    expect(await verifyLoginCode("a@b.dk", "000000")).toBe(false);
    expect(db.loginCode.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { attempts: { increment: 1 } } });
  });

  it("locks the code after too many attempts, even with the right code", async () => {
    db.loginCode.findFirst.mockResolvedValue(record({ attempts: LOGIN_CODE_MAX_ATTEMPTS }));
    expect(await verifyLoginCode("a@b.dk", "123456")).toBe(false);
    expect(db.loginCode.updateMany).not.toHaveBeenCalled();
  });

  it("rejects when no valid code exists or the format is wrong", async () => {
    db.loginCode.findFirst.mockResolvedValue(null);
    expect(await verifyLoginCode("a@b.dk", "123456")).toBe(false);
    expect(await verifyLoginCode("a@b.dk", "12ab56")).toBe(false);
  });
});
