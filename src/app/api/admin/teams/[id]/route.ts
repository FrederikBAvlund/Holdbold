import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

/**
 * Sletter et hold, men kun hvis der ikke er andre medlemmer end platformadministratoren selv.
 * Spillere skal fjernes enkeltvis først, så man altid har kontrol over, hvem der slettes.
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const teamId = params.id;
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } });
  if (!team) return NextResponse.json({ error: "Holdet findes ikke" }, { status: 404 });

  const players = await prisma.membership.count({ where: { teamId, userId: { not: auth.userId } } });
  if (players > 0) {
    return NextResponse.json(
      { error: "Holdet har stadig spillere. Åbn holdet og fjern dem enkeltvis først." },
      { status: 409 }
    );
  }

  const events = { event: { teamId } };
  // Skemaet har ikke cascade på holdets data, så alt slettes eksplicit i rækkefølge efter fremmednøgler.
  await prisma.$transaction(async (tx) => {
    await tx.signupLog.deleteMany({ where: events });
    await tx.signup.deleteMany({ where: events });
    await tx.eventLog.deleteMany({ where: events });
    await tx.fine.deleteMany({ where: { teamId } });
    await tx.fineCollection.deleteMany({ where: { teamId } });
    await tx.fineAutomationSetting.deleteMany({ where: { teamId } });
    await tx.fineTemplate.deleteMany({ where: { teamId } });
    await tx.event.deleteMany({ where: { teamId } });
    await tx.eventSeries.deleteMany({ where: { teamId } });
    await tx.icalFeed.deleteMany({ where: { teamId } });
    await tx.absence.deleteMany({ where: { teamId } });
    await tx.notification.deleteMany({ where: { teamId } });
    await tx.season.deleteMany({ where: { teamId } });
    await tx.membership.deleteMany({ where: { teamId } });
    await tx.team.delete({ where: { id: teamId } });
  });

  return NextResponse.json({ ok: true });
}
