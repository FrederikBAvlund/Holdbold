import type { Role } from "@/lib/roles";

/**
 * Guiden kender ikke roller direkte – kun hvad en rolle giver adgang til.
 * Så viser en forfremmelse automatisk præcis de nye dele (fx Træner → Bødekasseformand giver kun bøder m.m.).
 * Holdes i takt med rolle-listerne i `src/lib/apiAuth.ts` (det tjekker capabilities.test.ts).
 */
export const capabilities = ["basis", "events", "fines", "absences", "motm", "admin"] as const;
export type Capability = (typeof capabilities)[number];

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  SPILLER: ["basis"],
  SOME: ["basis"],
  TRAENER: ["basis", "events"],
  BOEDEKASSEFORMAND: ["basis", "events", "fines", "absences", "motm"],
  ADMIN: ["basis", "events", "fines", "absences", "motm", "admin"]
};

export function capabilitiesForRole(role: Role): Capability[] {
  return [...ROLE_CAPABILITIES[role]];
}

export function hasCapability(role: Role, capability: Capability) {
  return ROLE_CAPABILITIES[role].includes(capability);
}

/** Rettigheder `to` har, som `from` ikke havde. Tom ved degradering eller sidelæns skift. */
export function newCapabilities(from: Role, to: Role): Capability[] {
  const before = ROLE_CAPABILITIES[from];
  return ROLE_CAPABILITIES[to].filter((capability) => !before.includes(capability));
}
