import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/superAdmin";

/** Holdkoder, der ikke må bruges, fordi de ligner systemets egne ruter eller kan forveksles med Holdbold selv. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "dashboard",
  "login",
  "logout",
  "signup",
  "opret-hold",
  "holdbold",
  "support",
  "help",
  "hjaelp",
  "kontakt",
  "privatliv",
  "www",
  "mail",
  "test",
  "system",
  "systemadmin"
]);

export type SlugCheck =
  | { ok: true; slug: string }
  | { ok: false; reason: "too_short" | "reserved" | "taken"; slug: string };

export const SLUG_ERROR_MESSAGES: Record<"too_short" | "reserved" | "taken", string> = {
  too_short: "Holdkoden skal indeholde mindst 2 bogstaver eller tal",
  reserved: "Holdkoden kan ikke bruges. Vælg en anden",
  taken: "Holdkoden er allerede i brug eller reserveret af et andet hold"
};

/** Tjekker om en holdkode kan bruges: normaliseres, ikke reserveret, ikke et eksisterende hold og ikke reserveret af en aktiv anmodning. */
export async function checkSlugAvailable(rawSlug: string, options: { ignoreTeamId?: string } = {}): Promise<SlugCheck> {
  const slug = slugify(rawSlug);
  if (slug.length < 2) return { ok: false, reason: "too_short", slug };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: "reserved", slug };

  const [team, request] = await Promise.all([
    prisma.team.findUnique({ where: { slug }, select: { id: true } }),
    prisma.teamRequest.findFirst({ where: { slug, status: "PENDING" }, select: { id: true } })
  ]);
  if (team && team.id !== options.ignoreTeamId) return { ok: false, reason: "taken", slug };
  if (request) return { ok: false, reason: "taken", slug };
  return { ok: true, slug };
}
