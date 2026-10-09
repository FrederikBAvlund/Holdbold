import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { applyAbsenceToUpcomingEvents } from "@/lib/absences";
import { ABSENCE_MANAGER_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";

const bodySchema = z.object({ decision: z.enum(["APPROVE", "REJECT"]) });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Ugyldig handling" }, { status: 400 });

  const absence = await prisma.absence.findUnique({ where: { id: params.id } });
  if (!absence) return NextResponse.json({ error: "Fravær ikke fundet" }, { status: 404 });

  const manager = await requireActiveTeamMemberWithRoles(session.userId, absence.teamId, ABSENCE_MANAGER_ROLES);
  if (!manager.ok) return manager.response;

  const approve = parsed.data.decision === "APPROVE";
  if (approve && absence.endDate < new Date()) {
    return NextResponse.json({ error: "Fraværet er allerede slut" }, { status: 400 });
  }

  // Betinget opdatering: kun én samtidig afgørelse kan vinde
  const decided = await prisma.$transaction(async (tx) => {
    const result = await tx.absence.updateMany({
      where: { id: absence.id, status: "PENDING" },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        decidedById: session.userId,
        decidedAt: new Date()
      }
    });
    if (result.count === 0) return null;
    const updated = await tx.absence.findUniqueOrThrow({ where: { id: absence.id } });
    if (approve) await applyAbsenceToUpcomingEvents(updated, tx);
    return updated;
  });
  if (!decided) {
    return NextResponse.json({ error: "Anmodningen er allerede afgjort eller trukket tilbage" }, { status: 409 });
  }

  if (absence.userId !== session.userId) {
    await createNotifications([
      {
        userId: absence.userId,
        teamId: absence.teamId,
        type: "GENERAL",
        title: approve ? "Dit fravær er godkendt" : "Dit fravær er afvist",
        body: approve
          ? "Du er meldt fra til kommende begivenheder i perioden."
          : "Kontakt bødekassen, hvis du er i tvivl.",
        link: "/dashboard/fravaer"
      }
    ]);
  }

  return NextResponse.json({ absence: decided });
}
