export const roles = ["ADMIN", "TRAENER", "SPILLER", "SOME", "BOEDEKASSEFORMAND"] as const;
export type Role = (typeof roles)[number];

/** Vigtigste rolle først – bruges til visning og sortering */
export const ROLE_PRIORITY: readonly Role[] = ["ADMIN", "TRAENER", "BOEDEKASSEFORMAND", "SOME", "SPILLER"];

/** Træneren (og admin) styrer begivenheder */
export const EVENT_MANAGER_ROLES: readonly Role[] = ["ADMIN", "TRAENER"];

/** Admin og bødekasseformand styrer bødekassen */
export const FINE_MANAGER_ROLES: readonly Role[] = ["ADMIN", "BOEDEKASSEFORMAND"];

/** Kun admin og bødekasse kan køre visse automations-endpoints manuelt */
export const FINE_AUTOMATION_ROLES: readonly Role[] = FINE_MANAGER_ROLES;

/** Kun admin og bødekasseformand må åbne eller nulstille MOTM-afstemninger */
export const MOTM_MANAGER_ROLES: readonly Role[] = ["ADMIN", "BOEDEKASSEFORMAND"];

/** Bødekassen (og admin) godkender fravær */
export const ABSENCE_MANAGER_ROLES: readonly Role[] = ["ADMIN", "BOEDEKASSEFORMAND"];

/** Roller der må se andre spilleres tilmeldingsstatus – bødekassen skal bruge det til bøder */
export const SIGNUP_VIEWER_ROLES: readonly Role[] = ["ADMIN", "BOEDEKASSEFORMAND", "TRAENER"];

/** Et medlem har en rettighed, hvis bare én af medlemmets roller giver den. */
export function hasAnyRole(memberRoles: readonly string[] | null | undefined, allowed: readonly string[]) {
  return Boolean(memberRoles?.some((role) => allowed.includes(role)));
}

export function isAdminRoles(memberRoles: readonly string[] | null | undefined) {
  return hasAnyRole(memberRoles, ["ADMIN"]);
}

/** Uden dubletter, vigtigste først og aldrig tom (et medlem uden andre roller er spiller). */
export function normalizeRoles(memberRoles: readonly Role[]): Role[] {
  const unique = ROLE_PRIORITY.filter((role) => memberRoles.includes(role));
  return unique.length > 0 ? unique : ["SPILLER"];
}

/** Den vigtigste rolle – til sortering og grupper på holdsiden */
export function primaryRole(memberRoles: readonly string[] | null | undefined): Role {
  return ROLE_PRIORITY.find((role) => memberRoles?.includes(role)) ?? "SPILLER";
}
