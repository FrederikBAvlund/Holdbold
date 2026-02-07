export const roles = ["ADMIN", "TRAENER", "SPILLER", "BOEDEKASSEFORMAND"] as const;
export type Role = (typeof roles)[number];
