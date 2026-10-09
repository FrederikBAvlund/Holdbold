import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { releaseAbsenceSignups } from "@/lib/absences";
import { ABSENCE_MANAGER_ROLES, requireActiveTeamMember, requireSession } from "@/lib/apiAuth";

/** Trækker en afventende anmodning tilbage eller stopper et godkendt fravær før tid. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const absence = await prisma.absence.findUnique({ where: { id: params.id } });
  if (!absence) return NextResponse.json({ error: "Fravær ikke fundet" }, { status: 404 });

  const member = await requireActiveTeamMember(session.userId, absence.teamId);
  if (!member.ok) return member.response;
  if (absence.userId !== session.userId && !ABSENCE_MANAGER_ROLES.includes(member.role)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const now = new Date();
  const wasApproved = absence.status === "APPROVED";

  const stopped = await prisma.$transaction(async (tx) => {
    const result = await tx.absence.updateMany({
      where: { id: absence.id, status: { in: ["PENDING", "APPROVED"] }, endedAt: null },
      data: wasApproved ? { endedAt: now } : { status: "CANCELED" }
    });
    if (result.count === 0) return false;
    if (wasApproved) await releaseAbsenceSignups(absence.id, tx);
    return true;
  });
  if (!stopped) {
    return NextResponse.json({ error: "Fraværet er allerede afsluttet eller afgjort" }, { status: 409 });
  }

  if (wasApproved) {
    const [user, managers] = await Promise.all([
      prisma.user.findUnique({ where: { id: absence.userId }, select: { name: true } }),
      prisma.membership.findMany({
        where: { teamId: absence.teamId, status: "ACTIVE", role: { in: [...ABSENCE_MANAGER_ROLES] } },
        select: { userId: true }
      })
    ]);
    await createNotifications(
      managers
        .filter((m) => m.userId !== session.userId)
        .map((m) => ({
          userId: m.userId,
          teamId: absence.teamId,
          type: "GENERAL" as const,
          title: "Fravær stoppet",
          body: `${user?.name ?? "En spiller"} er tilbage og kan igen tilmelde sig begivenheder.`,
          link: "/dashboard/fravaer"
        }))
    );
  }

  return NextResponse.json({ ok: true });
}
