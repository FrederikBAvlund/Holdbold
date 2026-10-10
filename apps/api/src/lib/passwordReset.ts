import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const IDENTIFIER_PREFIX = "password-reset:";

export function resetIdentifier(email: string) {
  return `${IDENTIFIER_PREFIX}${email.trim().toLowerCase()}`;
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Opretter et engangstoken. Kun hashen gemmes; det rå token sendes i mailen. */
export async function createPasswordResetToken(email: string) {
  const identifier = resetIdentifier(email);
  const token = randomBytes(32).toString("hex");

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: hashResetToken(token),
      expires: new Date(Date.now() + PASSWORD_RESET_TTL_MS)
    }
  });

  return token;
}

/** Slår tokenet op og sletter det (engangsbrug). Returnerer email eller null. */
export async function consumePasswordResetToken(token: string) {
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashResetToken(token) }
  });
  if (!record || !record.identifier.startsWith(IDENTIFIER_PREFIX)) return null;

  await prisma.verificationToken.deleteMany({ where: { token: record.token } });
  if (record.expires.getTime() < Date.now()) return null;

  return record.identifier.slice(IDENTIFIER_PREFIX.length);
}
