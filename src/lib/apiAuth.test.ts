import { describe, expect, it } from "vitest";
import { EVENT_MANAGER_ROLES, FINE_AUTOMATION_ROLES, FINE_MANAGER_ROLES, canViewSignupOf } from "./apiAuth";

describe("canViewSignupOf", () => {
  it("lets anyone view their own signup", () => {
    expect(canViewSignupOf("u1", ["SPILLER"], "u1")).toBe(true);
  });

  it("blocks players from viewing other users' signups", () => {
    expect(canViewSignupOf("u1", ["SPILLER"], "u2")).toBe(false);
    expect(canViewSignupOf("u1", ["SPILLER", "SOME"], "u2")).toBe(false);
  });

  it("lets admin, bødekasseformand and træner view others", () => {
    expect(canViewSignupOf("u1", ["ADMIN"], "u2")).toBe(true);
    expect(canViewSignupOf("u1", ["BOEDEKASSEFORMAND"], "u2")).toBe(true);
    expect(canViewSignupOf("u1", ["TRAENER"], "u2")).toBe(true);
  });

  it("is enough that one of several roles allows it", () => {
    expect(canViewSignupOf("u1", ["SPILLER", "TRAENER"], "u2")).toBe(true);
  });
});

describe("apiAuth role sets", () => {
  it("EVENT_MANAGER_ROLES is træner and admin – bødekassen styrer ikke begivenheder", () => {
    expect(EVENT_MANAGER_ROLES).toEqual(["ADMIN", "TRAENER"]);
  });

  it("FINE_MANAGER_ROLES and FINE_AUTOMATION_ROLES are restricted", () => {
    expect(FINE_MANAGER_ROLES).toEqual(["ADMIN", "BOEDEKASSEFORMAND"]);
    expect(FINE_AUTOMATION_ROLES).toEqual(["ADMIN", "BOEDEKASSEFORMAND"]);
  });
});
