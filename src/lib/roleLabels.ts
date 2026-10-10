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

export const EVENT_MANAGER_ROLES = ["ADMIN", "TRAENER", "BOEDEKASSEFORMAND"];
export const FINE_MANAGER_ROLES = ["ADMIN", "BOEDEKASSEFORMAND"];
