export const fineRoles = ["BOEDEKASSEFORMAND", "ADMIN"];
export const categoryOptions = [
  { value: "SOME", label: "SoMe" },
  { value: "FAELLES", label: "Fælles" },
  { value: "SPILLER", label: "Spiller" },
  { value: "DIVERSE", label: "Diverse" }
] as const;

export const categoryLabel: Record<string, string> = {
  SOME: "SoMe",
  FAELLES: "Fælles",
  SPILLER: "Spiller",
  DIVERSE: "Diverse"
};

export const roleLabel: Record<string, string> = {
  ADMIN: "Admin",
  TRAENER: "Træner",
  SPILLER: "Spiller",
  SOME: "SoMe",
  BOEDEKASSEFORMAND: "Bødekasse"
};
