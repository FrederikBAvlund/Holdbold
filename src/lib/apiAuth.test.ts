import { describe, expect, it } from "vitest";
import { EVENT_MANAGER_ROLES, FINE_AUTOMATION_ROLES } from "./apiAuth";

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
