import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { applyActiveAbsencesToEvent } from "@/lib/absences";
import { requireActiveTeamMember, requireSession } from "@/lib/apiAuth";
import { seasonClosedResponse } from "@/lib/seasons";

const bodySchema = z.object({
  teamId: z.string().min(1),
  seriesId: z.string().min(1),
  date: z.string().datetime()
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const json = await request.json();
  const body = bodySchema.parse(json);

  const member = await requireActiveTeamMember(session.userId, body.teamId);
  if (!member.ok) return member.response;

  const createdById = session.userId;

  const date = new Date(body.date);

  const existing = await prisma.event.findFirst({
    where: {
      teamId: body.teamId,
      seriesId: body.seriesId,
      date
    }
  });

  if (existing) {
    return NextResponse.json({ event: existing });
  }

  const series = await prisma.eventSeries.findFirst({
    where: { id: body.seriesId, teamId: body.teamId }
  });

  if (!series) {
    return NextResponse.json({ error: "Gentagelse ikke fundet" }, { status: 404 });
  }

  const closed = seasonClosedResponse(await prisma.season.findUnique({ where: { id: series.seasonId } }));
  if (closed) return closed;

  const deadline = new Date(date.getTime() - series.signupDeadlineHoursBefore * 60 * 60 * 1000);

  const event = await prisma.event.create({
    data: {
      teamId: body.teamId,
      seriesId: series.id,
      seasonId: series.seasonId,
      title: series.title,
      date,
      location: series.location,
      signupDeadline: deadline,
      source: "SERIES",
      createdById,
      kind: series.kind
    }
  });

  await applyActiveAbsencesToEvent(event);

  // Gentagne begivenheder giver ingen "ny begivenhed"-notifikation – kun enkeltoprettede gør.
  return NextResponse.json({ event });
}
