import { describe, expect, it } from "vitest";
import {
  ABSENCE_MANAGER_ROLES,
  EVENT_MANAGER_ROLES,
  FINE_MANAGER_ROLES,
  MOTM_MANAGER_ROLES
} from "@/lib/apiAuth";
import { capabilitiesForRole, hasCapability, newCapabilities, type Capability } from "@/lib/guide/capabilities";
import { roles } from "@/lib/roles";

describe("guide capabilities", () => {
  it.each<[Capability, readonly string[]]>([
    ["events", EVENT_MANAGER_ROLES],
    ["fines", FINE_MANAGER_ROLES],
    ["absences", ABSENCE_MANAGER_ROLES],
    ["motm", MOTM_MANAGER_ROLES],
    ["admin", ["ADMIN"]],
    ["basis", roles]
  ])("%s følger rettighederne i apiAuth", (capability, allowed) => {
    for (const role of roles) {
      expect(hasCapability(role, capability), role).toBe(allowed.includes(role));
    }
  });

  it("viser kun de nye dele ved forfremmelse", () => {
    expect(newCapabilities("SPILLER", "TRAENER")).toEqual(["events"]);
    // Træneren kan allerede begivenheder – bødeformand giver kun bødekassen m.m.
    expect(newCapabilities("TRAENER", "BOEDEKASSEFORMAND")).toEqual(["fines", "absences", "motm"]);
    expect(newCapabilities("BOEDEKASSEFORMAND", "ADMIN")).toEqual(["admin"]);
  });

  it("giver intet nyt ved degradering eller sidelæns skift", () => {
    expect(newCapabilities("ADMIN", "SPILLER")).toEqual([]);
    expect(newCapabilities("SPILLER", "SOME")).toEqual([]);
  });

  it("giver admin alle rettigheder", () => {
    expect(capabilitiesForRole("ADMIN")).toEqual(["basis", "events", "fines", "absences", "motm", "admin"]);
  });
});
