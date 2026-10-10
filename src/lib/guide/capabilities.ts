import type { Role } from "@/lib/roles";

/**
 * Guiden kender ikke roller direkte – kun hvad rollerne giver adgang til.
 * Et medlem med flere roller får summen, og en ny rolle viser præcis de nye dele
 * (fx Spiller + Træner, der også bliver Bødekasseformand, får kun bødekassen m.m.).
 * Holdes i takt med rolle-listerne i `src/lib/roles.ts` (det tjekker capabilities.test.ts).
 */
export const capabilities = ["basis", "events", "fines", "absences", "motm", "admin"] as const;
export type Capability = (typeof capabilities)[number];

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  SPILLER: ["basis"],
  SOME: ["basis"],
  TRAENER: ["basis", "events"],
  BOEDEKASSEFORMAND: ["basis", "fines", "absences", "motm"],
  ADMIN: ["basis", "events", "fines", "absences", "motm", "admin"]
};

/** Alt, medlemmets roller tilsammen giver adgang til – i guidens rækkefølge. */
export function capabilitiesForRoles(memberRoles: readonly Role[]): Capability[] {
  return capabilities.filter((capability) => memberRoles.some((role) => ROLE_CAPABILITIES[role].includes(capability)));
}

export function hasCapability(memberRoles: readonly Role[], capability: Capability) {
  return capabilitiesForRoles(memberRoles).includes(capability);
}

/** Rettigheder `to` giver, som `from` ikke gav. Tom, hvis man kun har mistet eller byttet til noget, man allerede kunne. */
export function newCapabilities(from: readonly Role[], to: readonly Role[]): Capability[] {
  const before = capabilitiesForRoles(from);
  return capabilitiesForRoles(to).filter((capability) => !before.includes(capability));
}
