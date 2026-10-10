import { describe, expect, it } from "vitest";
import { EVENT_MANAGER_ROLES, FINE_AUTOMATION_ROLES, canViewSignupOf } from "./apiAuth";

describe("canViewSignupOf", () => {
  it("lets anyone view their own signup", () => {
    expect(canViewSignupOf("u1", "SPILLER", "u1")).toBe(true);
  });

  it("blocks players from viewing other users' signups", () => {
    expect(canViewSignupOf("u1", "SPILLER", "u2")).toBe(false);
  });

  it("lets admin, bødekasseformand and træner view others", () => {
    expect(canViewSignupOf("u1", "ADMIN", "u2")).toBe(true);
    expect(canViewSignupOf("u1", "BOEDEKASSEFORMAND", "u2")).toBe(true);
    expect(canViewSignupOf("u1", "TRAENER", "u2")).toBe(true);
  });
});

describe("apiAuth role sets", () => {
  it("EVENT_MANAGER_ROLES covers træner/admin/bødekasse", () => {
    expect(EVENT_MANAGER_ROLES).toContain("ADMIN");
    expect(EVENT_MANAGER_ROLES).toContain("TRAENER");
    expect(EVENT_MANAGER_ROLES).toContain("BOEDEKASSEFORMAND");
  });

  it("FINE_AUTOMATION_ROLES is restricted", () => {
    expect(FINE_AUTOMATION_ROLES).toEqual(["ADMIN", "BOEDEKASSEFORMAND"]);
  });
});
