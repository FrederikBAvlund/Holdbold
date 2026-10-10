import { prisma } from "@/lib/prisma";
import { resolveSeason } from "@/lib/seasons";

export type NavBadges = {
  /** Forslag og betalinger, der venter på bødekassen */
  fines: number;
  /** Nye indmeldelser (admin) + fraværsanmodninger (bødekasse/admin) */
  team: number;
  /** Fraværsanmodninger, der venter på en afgørelse */
  absences: number;
};

const EMPTY: NavBadges = { fines: 0, team: 0, absences: 0 };

/**
 * Tæller ting, brugeren selv skal tage stilling til – rollebaseret og uafhængigt af,
 * om de tilhørende notifikationer er markeret læst.
 */
export async function getNavBadges(userId: string, teamId: string, seasonId: string | null): Promise<NavBadges> {
  const membership = await prisma.membership.findFirst({
    where: { teamId, userId, status: "ACTIVE" },
    select: { role: true }
  });
  if (!membership) return EMPTY;

  const isAdmin = membership.role === "ADMIN";
  const isFineManager = isAdmin || membership.role === "BOEDEKASSEFORMAND";
  if (!isFineManager) return EMPTY;

  const season = await resolveSeason(teamId, seasonId);

  const [proposed, templates, payments, pendingMembers, absences] = await Promise.all([
    season ? prisma.fine.count({ where: { teamId, seasonId: season.id, status: "FORESLAET" } }) : 0,
    prisma.fineTemplate.count({ where: { teamId, status: "PENDING" } }),
    // Betalinger til godkendelse kan kun ses af admin (som i indbakken).
    isAdmin
      ? prisma.fine.groupBy({ by: ["userId"], where: { teamId, status: "PAID_PENDING" } }).then((rows) => rows.length)
      : 0,
    isAdmin ? prisma.membership.count({ where: { teamId, status: "PENDING" } }) : 0,
    prisma.absence.count({ where: { teamId, status: "PENDING" } })
  ]);

  return { fines: proposed + templates + payments, team: pendingMembers + absences, absences };
}
