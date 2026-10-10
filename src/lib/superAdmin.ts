/** Platformadministratorer (kan oprette og styre alle hold). Kommasepareret liste i SUPER_ADMIN_EMAILS. */
const DEFAULT_SUPER_ADMINS = "frederikavlund@gmail.com";

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const configured = process.env.SUPER_ADMIN_EMAILS?.trim() || DEFAULT_SUPER_ADMINS;
  const allowed = configured
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
