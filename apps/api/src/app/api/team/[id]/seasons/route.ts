import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveTeamMember, requireSession } from "@/lib/apiAuth";
import { getActiveSeason } from "@/lib/seasons";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const member = await requireActiveTeamMember(session.userId, params.id);
  if (!member.ok) return member.response;

  await getActiveSeason(params.id);
  const seasons = await prisma.season.findMany({
    where: { teamId: params.id },
    orderBy: { startedAt: "desc" },
    select: { id: true, name: true, startedAt: true, closedAt: true }
  });

  return NextResponse.json({ seasons });
}
