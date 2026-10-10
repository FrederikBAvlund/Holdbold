import { isIPv6 } from "node:net";
import { prisma } from "@/lib/prisma";

type HeaderSource = Headers | Record<string, string | string[] | undefined>;

function readHeader(headers: HeaderSource, name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Normaliserer en IP til den nøgle, der rate limites på:
 * IPv4-mappede IPv6-adresser bliver IPv4, og IPv6 grupperes på /64, så man ikke kan
 * omgå grænsen ved at skifte adresse indenfor sit eget præfiks.
 */
export function normalizeIp(raw: string): string {
  let ip = raw.trim().toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) return mapped[1];
  if (isIPv6(ip)) {
    const [head, tail = ""] = ip.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = 8 - headParts.length - tailParts.length;
    const full = [...headParts, ...(ip.includes("::") ? Array(Math.max(missing, 0)).fill("0") : []), ...tailParts];
    ip = `${full.slice(0, 4).map((part) => part.padStart(4, "0")).join(":")}::/64`;
  }
  return ip;
}

/**
 * Finder klientens IP. På Vercel overskriver platformen x-forwarded-for / x-vercel-forwarded-for,
 * så de kan ikke forfalskes af klienten. Kør ikke bag en proxy, der ikke selv sætter disse headers,
 * uden at tilpasse funktionen, fordi x-forwarded-for ellers kan forfalskes.
 */
export function getClientIp(headers: HeaderSource): string {
  const candidate =
    readHeader(headers, "x-vercel-forwarded-for") ??
    readHeader(headers, "x-real-ip") ??
    readHeader(headers, "x-forwarded-for")?.split(",")[0];
  return candidate?.trim() ? normalizeIp(candidate) : "unknown";
}

/**
 * Tæller et kald i et fast tidsvindue og siger, om det er inden for grænsen.
 * Opdateringen er atomisk i databasen, så samtidige kald ikke kan snyde tælleren.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; count: number }> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "AuthRateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "AuthRateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}) THEN 1
        ELSE "AuthRateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "AuthRateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}) THEN now()
        ELSE "AuthRateLimit"."windowStart"
      END
    RETURNING "count"
  `;
  const count = Number(rows[0]?.count ?? 1);

  // Ryd gamle tællere op en gang imellem, så tabellen ikke vokser uden grænse.
  if (Math.random() < 0.01) {
    void prisma.authRateLimit
      .deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => undefined);
  }

  return { allowed: count <= limit, count };
}
