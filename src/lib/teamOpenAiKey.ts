import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

function encryptionKey(): Buffer {
  const value = process.env.TEAM_API_KEY_ENCRYPTION_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error("Team API key encryption is not configured");
  }
  return Buffer.from(value, "hex");
}

export function encryptTeamApiKey(teamId: string, apiKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(teamId));
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return ["v1", iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptTeamApiKey(teamId: string, encrypted: string): string {
  const parts = encrypted.split(":");
  const [version, iv, tag, ciphertext] = parts;
  if (parts.length !== 4 || version !== "v1" || !/^[a-f0-9]{24}$/.test(iv) ||
      !/^[a-f0-9]{32}$/.test(tag) || !/^(?:[a-f0-9]{2})+$/.test(ciphertext)) {
    throw new Error("Invalid encrypted team API key");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
  decipher.setAAD(Buffer.from(teamId));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "hex")), decipher.final()]).toString("utf8");
}

/** Call only after authorizing access to this team's AI functions. Never return the key to clients. */
export async function getTeamOpenAiKey(teamId: string): Promise<string | null> {
  const credential = await prisma.teamOpenAiCredential.findUnique({ where: { teamId } });
  return credential ? decryptTeamApiKey(teamId, credential.encryptedApiKey) : null;
}
