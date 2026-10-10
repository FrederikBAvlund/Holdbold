import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";
import { closeSeasonAndStartNew } from "@/lib/seasons";

const bodySchema = z.object({
  confirm: z.literal(true),
  name: z.string().trim().min(1).max(60).optional()
});

/** Kun admin: lukker den aktive sæson (arkiveres som skrivebeskyttet) og starter en ny. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const member = await requireActiveTeamMemberWithRoles(session.userId, params.id, ["ADMIN"]);
  if (!member.ok) return member.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bekræft at sæsonen skal lukkes" }, { status: 400 });
  }

  const result = await closeSeasonAndStartNew(params.id, parsed.data.name);
  return NextResponse.json({
    closedSeason: { id: result.closed.id, name: result.closed.name },
    season: { id: result.next.id, name: result.next.name, startedAt: result.next.startedAt, closedAt: null },
    carriedOverFines: result.carriedOverFines
  });
}
