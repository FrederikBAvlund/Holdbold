import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildIcsCalendar } from "@/lib/ics";
import { toIcsEvent } from "@/lib/calendarEvents";

/** Henter én begivenhed som .ics-fil, så den kan føjes til fx Kalender på Mac. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      teamId: true,
      title: true,
      date: true,
      location: true,
      kind: true,
      meetingTime: true,
      canceledAt: true,
      team: { select: { name: true } }
    }
  });
  if (!event) return NextResponse.json({ error: "Begivenhed ikke fundet" }, { status: 404 });

  const membership = await prisma.membership.findFirst({
    where: { teamId: event.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });

  const body = buildIcsCalendar([toIcsEvent(event)], { name: event.team.name });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="begivenhed.ics"',
      "Cache-Control": "private, no-store"
    }
  });
}
