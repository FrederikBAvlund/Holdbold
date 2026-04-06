export const roles = ["ADMIN", "TRAENER", "SPILLER", "SOME", "BOEDEKASSEFORMAND"] as const;
export type Role = (typeof roles)[number];
