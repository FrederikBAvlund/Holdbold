import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./prisma";
import { sendMail } from "./mail";
import { checkRateLimit } from "./rateLimit";
import {
  LOGIN_CODE_MAX_ATTEMPTS,
  codesMatch,
  generateLoginCode,
  hashLoginCode,
  requestLoginCode,
  requestSignupCode,
  requestTeamRequesterCode,
  verifyLoginCode
} from "./loginCode";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    team: { findUnique: vi.fn() },
    membership: { findFirst: vi.fn() },
    teamRequest: { findFirst: vi.fn() },
    loginCode: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() }
  }
}));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn() }));

const db = prisma as unknown as {
  user: { findFirst: ReturnType<typeof vi.fn> };
  membership: { findFirst: ReturnType<typeof vi.fn> };
  team: { findUnique: ReturnType<typeof vi.fn> };
  teamRequest: { findFirst: ReturnType<typeof vi.fn> };
  loginCode: Record<"findMany" | "findFirst" | "create" | "update" | "updateMany", ReturnType<typeof vi.fn>>;
};

beforeEach(() => {
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, count: 1 });
  db.teamRequest.findFirst.mockResolvedValue(null);
});
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

describe("requestLoginCode global cap", () => {
  it("sends nothing once the global hourly cap is reached", async () => {
    db.user.findFirst.mockResolvedValue({ id: "u1" });
    db.membership.findFirst.mockResolvedValue({ id: "m1" });
    db.loginCode.findMany.mockResolvedValue([]);
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, count: 201 });
    await requestLoginCode("a@b.dk");
    expect(sendMail).not.toHaveBeenCalled();
    expect(db.loginCode.create).not.toHaveBeenCalled();
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
    expect(await verifyLoginCode("a@b.dk", "123456")).toEqual({ ok: true, signup: null, teamRequestSignup: null });

    db.loginCode.updateMany.mockResolvedValue({ count: 0 });
    expect(await verifyLoginCode("a@b.dk", "123456")).toEqual({ ok: false });
  });

  it("counts wrong attempts and rejects", async () => {
    db.loginCode.findFirst.mockResolvedValue(record());
    expect(await verifyLoginCode("a@b.dk", "000000")).toEqual({ ok: false });
    expect(db.loginCode.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { attempts: { increment: 1 } } });
  });

  it("locks the code after too many attempts, even with the right code", async () => {
    db.loginCode.findFirst.mockResolvedValue(record({ attempts: LOGIN_CODE_MAX_ATTEMPTS }));
    expect(await verifyLoginCode("a@b.dk", "123456")).toEqual({ ok: false });
    expect(db.loginCode.updateMany).not.toHaveBeenCalled();
  });

  it("rejects when no valid code exists or the format is wrong", async () => {
    db.loginCode.findFirst.mockResolvedValue(null);
    expect(await verifyLoginCode("a@b.dk", "123456")).toEqual({ ok: false });
    expect(await verifyLoginCode("a@b.dk", "12ab56")).toEqual({ ok: false });
  });
});

describe("signup codes", () => {
  it("rejects unknown teams and already registered emails without sending", async () => {
    db.team.findUnique.mockResolvedValue(null);
    expect(await requestSignupCode({ email: "ny@b.dk", name: "Ny", teamSlug: "findes-ikke" })).toEqual({ status: "team_not_found" });

    db.team.findUnique.mockResolvedValue({ id: "t1" });
    db.user.findFirst.mockResolvedValue({ id: "u1" });
    expect(await requestSignupCode({ email: "ny@b.dk", name: "Ny", teamSlug: "hold" })).toEqual({ status: "email_taken" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("stores name and team with the code and mails it", async () => {
    db.team.findUnique.mockResolvedValue({ id: "t1" });
    db.user.findFirst.mockResolvedValue(null);
    db.loginCode.findMany.mockResolvedValue([]);
    expect(await requestSignupCode({ email: "Ny@B.dk", name: " Ny Bruger ", teamSlug: "Hold" })).toEqual({ status: "sent" });
    expect(db.loginCode.create.mock.calls[0][0].data).toMatchObject({ email: "ny@b.dk", signupName: "Ny Bruger", signupTeamId: "t1" });
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it("returns signup data when a signup code is verified", async () => {
    db.loginCode.findFirst.mockResolvedValue({
      id: "c1",
      codeHash: hashLoginCode("ny@b.dk", "123456"),
      attempts: 0,
      signupName: "Ny Bruger",
      signupTeamId: "t1"
    });
    db.loginCode.updateMany.mockResolvedValue({ count: 1 });
    expect(await verifyLoginCode("ny@b.dk", "123456")).toEqual({ ok: true, signup: { name: "Ny Bruger", teamId: "t1" }, teamRequestSignup: null });
  });
});

describe("team requester codes", () => {
  beforeEach(() => {
    db.loginCode.findMany.mockResolvedValue([]);
    db.membership.findFirst.mockResolvedValue(null);
  });

  it("sends a code flagged for team request signup to a new email", async () => {
    db.user.findFirst.mockResolvedValue(null);
    expect(await requestTeamRequesterCode({ email: "Ny@B.dk", name: "Ny" })).toEqual({ status: "sent" });
    expect(db.loginCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "ny@b.dk", signupName: "Ny", signupTeamId: null, signupForTeamRequest: true })
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("tells existing users with a team to log in instead", async () => {
    db.user.findFirst.mockResolvedValue({ id: "u1" });
    db.membership.findFirst.mockResolvedValue({ id: "m1" });
    expect(await requestTeamRequesterCode({ email: "a@b.dk", name: "A" })).toEqual({ status: "email_taken" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("lets an abandoned account without team or request try again", async () => {
    db.user.findFirst.mockResolvedValue({ id: "u1" });
    expect(await requestTeamRequesterCode({ email: "a@b.dk", name: "A" })).toEqual({ status: "sent" });
  });

  it("lets users with only a team request log in", async () => {
    db.user.findFirst.mockResolvedValue({ id: "u1" });
    db.teamRequest.findFirst.mockResolvedValue({ id: "r1" });
    await requestLoginCode("a@b.dk");
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});
