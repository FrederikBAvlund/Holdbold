import { ROLE_PRIORITY } from "@/lib/roles";

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Holdadmin",
  TRAENER: "Træner",
  SPILLER: "Spiller",
  SOME: "SoMe",
  BOEDEKASSEFORMAND: "Bødekasseformand"
};

export function roleLabel(role: string | null | undefined) {
  return (role && ROLE_LABELS[role]) || "Medlem";
}

/** "Træner · Bødekasseformand". Spiller nævnes kun, når det er den eneste rolle. */
export function rolesLabel(memberRoles: readonly string[] | null | undefined) {
  const sorted = ROLE_PRIORITY.filter((role) => memberRoles?.includes(role));
  const shown = sorted.length > 1 ? sorted.filter((role) => role !== "SPILLER") : sorted;
  return shown.length > 0 ? shown.map(roleLabel).join(" · ") : "Medlem";
}
