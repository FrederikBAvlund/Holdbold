import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIcsCalendar } from "@/lib/ics";
import { toIcsEvent } from "@/lib/calendarEvents";

const LOOKBACK_DAYS = 60;

/**
 * Personlig kalenderfeed til abonnement (fx Kalender på Mac/iPhone). Kalenderprogrammer sender
 * ikke login-cookies, så feedet beskyttes af en hemmelig nøgle i adressen i stedet.
 */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const token = params.token.replace(/\.ics$/, "");
  if (token.length < 20) return new NextResponse("Ikke fundet", { status: 404 });

  const user = await prisma.user.findUnique({ where: { calendarToken: token }, select: { id: true } });
  if (!user) return new NextResponse("Ikke fundet", { status: 404 });

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    select: { teamId: true }
  });
  const teamIds = memberships.map((membership) => membership.teamId);

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  const events = teamIds.length
    ? await prisma.event.findMany({
        where: { teamId: { in: teamIds }, date: { gte: since } },
        orderBy: { date: "asc" },
        select: {
          id: true,
          title: true,
          date: true,
          location: true,
          kind: true,
          meetingTime: true,
          canceledAt: true,
          team: { select: { name: true } }
        }
      })
    : [];

  const withTeamPrefix = teamIds.length > 1;
  const body = buildIcsCalendar(
    events.map((event) => toIcsEvent(event, { withTeamPrefix })),
    { name: "Holdbold" }
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300"
    }
  });
}
