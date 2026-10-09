import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptTeamApiKey, encryptTeamApiKey, getTeamOpenAiKey } from "./teamOpenAiKey";
import { prisma } from "./prisma";

vi.mock("@/lib/prisma", () => ({ prisma: { teamOpenAiCredential: { findUnique: vi.fn() } } }));

describe("team API key encryption", () => {
  beforeEach(() => vi.stubEnv("TEAM_API_KEY_ENCRYPTION_KEY", "ab".repeat(32)));
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("encrypts without storing plaintext and uses fresh nonces", () => {
    const encrypted = encryptTeamApiKey("team-a", "sk-test-secret");
    expect(encrypted).not.toContain("sk-test-secret");
    expect(encrypted).not.toEqual(encryptTeamApiKey("team-a", "sk-test-secret"));
    expect(decryptTeamApiKey("team-a", encrypted)).toBe("sk-test-secret");
  });

  it("rejects ciphertext copied to another team or tampered with", () => {
    const encrypted = encryptTeamApiKey("team-a", "sk-test-secret");
    expect(() => decryptTeamApiKey("team-b", encrypted)).toThrow();
    const parts = encrypted.split(":");
    parts[3] = (parts[3][0] === "0" ? "1" : "0") + parts[3].slice(1);
    expect(() => decryptTeamApiKey("team-a", parts.join(":"))).toThrow();
  });

  it("fails closed with a wrong, missing or malformed encryption key", () => {
    const encrypted = encryptTeamApiKey("team-a", "sk-secret");
    vi.stubEnv("TEAM_API_KEY_ENCRYPTION_KEY", "cd".repeat(32));
    expect(() => decryptTeamApiKey("team-a", encrypted)).toThrow();
    for (const value of ["", "short", "zz".repeat(32)]) {
      vi.stubEnv("TEAM_API_KEY_ENCRYPTION_KEY", value);
      expect(() => encryptTeamApiKey("team-a", "sk-secret")).toThrow();
    }
  });

  it("looks up only the requested team, without falling back to the env key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-global");
    vi.mocked(prisma.teamOpenAiCredential.findUnique).mockResolvedValue(null);
    expect(await getTeamOpenAiKey("team-a")).toBeNull();
    expect(prisma.teamOpenAiCredential.findUnique).toHaveBeenCalledWith({ where: { teamId: "team-a" } });
    vi.mocked(prisma.teamOpenAiCredential.findUnique).mockResolvedValue({
      teamId: "team-a", encryptedApiKey: encryptTeamApiKey("team-a", "sk-team-a")
    });
    expect(await getTeamOpenAiKey("team-a")).toBe("sk-team-a");
  });
});
