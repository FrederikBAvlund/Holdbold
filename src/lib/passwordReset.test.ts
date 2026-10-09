import { describe, expect, it } from "vitest";
import { hashResetToken, resetIdentifier } from "./passwordReset";

describe("passwordReset helpers", () => {
  it("normaliserer email i identifier", () => {
    expect(resetIdentifier("  Test@Example.COM ")).toBe("password-reset:test@example.com");
  });

  it("hasher deterministisk og aldrig til selve tokenet", () => {
    const hash = hashResetToken("abc");
    expect(hash).toBe(hashResetToken("abc"));
    expect(hash).not.toBe("abc");
    expect(hash).toHaveLength(64);
  });
});
