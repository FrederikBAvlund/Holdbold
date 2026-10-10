import { afterEach, describe, expect, it } from "vitest";
import { isSuperAdminEmail, slugify } from "./superAdmin";

describe("isSuperAdminEmail", () => {
  afterEach(() => {
    delete process.env.SUPER_ADMIN_EMAILS;
  });

  it("accepts the default admin case-insensitively", () => {
    expect(isSuperAdminEmail("FrederikAvlund@gmail.com")).toBe(true);
  });

  it("rejects other and missing emails", () => {
    expect(isSuperAdminEmail("andre@example.com")).toBe(false);
    expect(isSuperAdminEmail(null)).toBe(false);
  });

  it("uses SUPER_ADMIN_EMAILS when set", () => {
    process.env.SUPER_ADMIN_EMAILS = "a@x.dk, b@x.dk";
    expect(isSuperAdminEmail("b@x.dk")).toBe(true);
    expect(isSuperAdminEmail("frederikavlund@gmail.com")).toBe(false);
  });
});

describe("slugify", () => {
  it("handles danish letters and symbols", () => {
    expect(slugify("Brønshøj Ældste Å!")).toBe("broenshoej-aeldste-aa");
  });

  it("keeps underscores", () => {
    expect(slugify("bk_skjold")).toBe("bk_skjold");
    expect(slugify("_bk_skjold_")).toBe("bk_skjold");
  });
});
