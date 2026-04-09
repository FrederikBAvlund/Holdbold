import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EVENT_MANAGER_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";

const updateSchema = z.object({
  endDate: z.string().datetime().nullable().optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const existing = await prisma.eventSeries.findUnique({
    where: { id: params.id },
    select: { teamId: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Gentagelse ikke fundet" }, { status: 404 });
  }

  const member = await requireActiveTeamMemberWithRoles(session.userId, existing.teamId, EVENT_MANAGER_ROLES);
  if (!member.ok) return member.response;

  const json = await request.json();
  const body = updateSchema.parse(json);

  const series = await prisma.eventSeries.update({
    where: { id: params.id },
    data: {
      ...(body.endDate !== undefined ? { endDate: body.endDate ? new Date(body.endDate) : null } : {})
    }
  });

  return NextResponse.json({ series });
}
