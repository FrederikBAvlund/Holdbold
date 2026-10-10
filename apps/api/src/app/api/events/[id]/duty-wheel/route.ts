import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveTeamMember, requireSession } from "@/lib/apiAuth";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: { teamId: true, date: true }
  });
  if (!event) {
    return NextResponse.json({ error: "Begivenhed ikke fundet" }, { status: 404 });
  }

  const member = await requireActiveTeamMember(session.userId, event.teamId);
  if (!member.ok) return member.response;

  try {
    const priorBeerRows = await prisma.event.findMany({
      where: {
        teamId: event.teamId,
        canceledAt: null,
        id: { not: params.id },
        date: { lt: event.date },
        beerCarrierId: { not: null }
      },
      select: { beerCarrierId: true }
    });
    const beerPreviouslyUserIds = [
      ...new Set(
        priorBeerRows
          .map((row) => row.beerCarrierId)
          .filter((id): id is string => Boolean(id))
      )
    ];

    const nextEvent = await prisma.event.findFirst({
      where: {
        teamId: event.teamId,
        canceledAt: null,
        date: { gt: event.date }
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        title: true,
        date: true,
        kind: true
      }
    });

    return NextResponse.json({
      beerPreviouslyUserIds,
      nextEvent
    });
  } catch (error) {
    console.error("Failed to load duty wheel context", { eventId: params.id, error });
    return NextResponse.json({ error: "Kunne ikke hente data til hjulet" }, { status: 500 });
  }
}
