import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { checkRateLimit } from "@/lib/rateLimit";

export const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;
export const LOGIN_CODE_RESEND_COOLDOWN_MS = 60 * 1000;
export const LOGIN_CODE_MAX_PER_HOUR = 5;
/** Samlet loft for udsendte koder pr. time, som værn mod misbrug fra mange IP-adresser (fx via proxyer). */
export const LOGIN_CODE_GLOBAL_MAX_PER_HOUR = 200;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function generateLoginCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function secret() {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("NEXTAUTH_SECRET mangler");
  return value;
}

export function hashLoginCode(email: string, code: string) {
  return createHmac("sha256", secret()).update(`${normalizeEmail(email)}:${code}`).digest("hex");
}

export function codesMatch(expectedHash: string, email: string, code: string) {
  const actual = Buffer.from(hashLoginCode(email, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Spørger rate limits og opretter + sender koden. Gør intet synligt, hvis grænserne er nået. */
async function issueCode(email: string, signup?: { name: string; teamId: string }): Promise<void> {
  const now = Date.now();
  const recent = await prisma.loginCode.findMany({
    where: { email, createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true }
  });
  if (recent.length >= LOGIN_CODE_MAX_PER_HOUR) return;
  if (recent[0] && now - recent[0].createdAt.getTime() < LOGIN_CODE_RESEND_COOLDOWN_MS) return;

  const global = await checkRateLimit("otp-request:global", LOGIN_CODE_GLOBAL_MAX_PER_HOUR, 60 * 60);
  if (!global.allowed) return;

  const code = generateLoginCode();
  await prisma.loginCode.create({
    data: {
      email,
      codeHash: hashLoginCode(email, code),
      expiresAt: new Date(now + LOGIN_CODE_TTL_MS),
      signupName: signup?.name ?? null,
      signupTeamId: signup?.teamId ?? null
    }
  });

  await sendMail({
    to: email,
    subject: `Din Holdbold-kode: ${code}`,
    text: `Din kode til at ${signup ? "oprette din bruger" : "logge ind"} på Holdbold er ${code}.\n\nKoden udløber om 10 minutter. Har du ikke bedt om den, kan du ignorere mailen.`,
    html: `<p>Din kode til at ${signup ? "oprette din bruger" : "logge ind"} på Holdbold er</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Koden udløber om 10 minutter. Har du ikke bedt om den, kan du ignorere mailen.</p>`
  });
}

/**
 * Sender en engangskode, hvis e-mailen tilhører en bruger med et medlemskab.
 * Gør ingenting synligt for kalderen i øvrigt, så man ikke kan afprøve hvilke e-mails der findes.
 */
export async function requestLoginCode(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true }
  });
  if (!user) return;

  const hasMembership = await prisma.membership.findFirst({
    where: { userId: user.id, status: { in: ["ACTIVE", "PENDING"] } },
    select: { id: true }
  });
  if (!hasMembership) return;

  await issueCode(email);
}

export type SignupCodeResult = { status: "sent" } | { status: "team_not_found" } | { status: "email_taken" };

/** Sender en kode til en ny bruger. Brugeren oprettes først, når koden er bekræftet. */
export async function requestSignupCode(input: { email: string; name: string; teamSlug: string }): Promise<SignupCodeResult> {
  const email = normalizeEmail(input.email);

  const team = await prisma.team.findUnique({ where: { slug: input.teamSlug.trim().toLowerCase() }, select: { id: true } });
  if (!team) return { status: "team_not_found" };

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true }
  });
  if (existing) return { status: "email_taken" };

  await issueCode(email, { name: input.name.trim(), teamId: team.id });
  return { status: "sent" };
}

export type VerifiedLoginCode = { ok: false } | { ok: true; signup: { name: string; teamId: string } | null };

/** Forbruger koden, hvis den er korrekt, ikke udløbet og ikke brugt. Returnerer evt. signup-data. */
export async function verifyLoginCode(rawEmail: string, code: string): Promise<VerifiedLoginCode> {
  const email = normalizeEmail(rawEmail);
  if (!/^\d{6}$/.test(code)) return { ok: false };

  const record = await prisma.loginCode.findFirst({
    where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" }
  });
  if (!record || record.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return { ok: false };

  if (!codesMatch(record.codeHash, email, code)) {
    await prisma.loginCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return { ok: false };
  }

  // Betinget opdatering sikrer, at to samtidige forsøg ikke begge kan bruge samme kode.
  const consumed = await prisma.loginCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() }
  });
  if (consumed.count !== 1) return { ok: false };

  return {
    ok: true,
    signup: record.signupName && record.signupTeamId ? { name: record.signupName, teamId: record.signupTeamId } : null
  };
}
