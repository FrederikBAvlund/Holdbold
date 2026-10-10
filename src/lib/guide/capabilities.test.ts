import { describe, expect, it } from "vitest";
import {
  ABSENCE_MANAGER_ROLES,
  EVENT_MANAGER_ROLES,
  FINE_MANAGER_ROLES,
  MOTM_MANAGER_ROLES
} from "@/lib/apiAuth";
import { capabilitiesForRoles, hasCapability, newCapabilities, type Capability } from "@/lib/guide/capabilities";
import { roles } from "@/lib/roles";

describe("guide capabilities", () => {
  it.each<[Capability, readonly string[]]>([
    ["events", EVENT_MANAGER_ROLES],
    ["fines", FINE_MANAGER_ROLES],
    ["absences", ABSENCE_MANAGER_ROLES],
    ["motm", MOTM_MANAGER_ROLES],
    ["admin", ["ADMIN"]],
    ["basis", roles]
  ])("%s følger rettighederne i roles.ts", (capability, allowed) => {
    for (const role of roles) {
      expect(hasCapability([role], capability), role).toBe(allowed.includes(role));
    }
  });

  it("holder træner og bødekasse adskilt", () => {
    expect(capabilitiesForRoles(["TRAENER"])).toEqual(["basis", "events"]);
    expect(capabilitiesForRoles(["BOEDEKASSEFORMAND"])).toEqual(["basis", "fines", "absences", "motm"]);
  });

  it("giver summen af flere roller", () => {
    expect(capabilitiesForRoles(["SPILLER", "TRAENER", "BOEDEKASSEFORMAND"])).toEqual([
      "basis",
      "events",
      "fines",
      "absences",
      "motm"
    ]);
  });

  it("viser kun de nye dele, når man får en rolle mere", () => {
    expect(newCapabilities(["SPILLER"], ["SPILLER", "TRAENER"])).toEqual(["events"]);
    expect(newCapabilities(["SPILLER", "TRAENER"], ["SPILLER", "TRAENER", "BOEDEKASSEFORMAND"])).toEqual([
      "fines",
      "absences",
      "motm"
    ]);
    expect(newCapabilities(["BOEDEKASSEFORMAND"], ["ADMIN"])).toEqual(["events", "admin"]);
  });

  it("giver intet nyt, når man mister en rolle eller får en uden nye rettigheder", () => {
    expect(newCapabilities(["ADMIN"], ["SPILLER"])).toEqual([]);
    expect(newCapabilities(["SPILLER"], ["SPILLER", "SOME"])).toEqual([]);
    expect(newCapabilities(["ADMIN"], ["ADMIN", "TRAENER"])).toEqual([]);
  });
});
