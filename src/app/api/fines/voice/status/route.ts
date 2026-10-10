import { NextResponse } from "next/server";
import { FINE_AUTOMATION_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

/** Fortæller kun om holdet har en OpenAI-nøgle – nøglen selv forlader aldrig serveren. */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const teamId = new URL(request.url).searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "Ugyldigt input" }, { status: 400 });

  const member = await requireActiveTeamMemberWithRoles(session.userId, teamId, FINE_AUTOMATION_ROLES);
  if (!member.ok) return member.response;

  const credential = await prisma.teamOpenAiCredential.findUnique({ where: { teamId }, select: { teamId: true } });
  return NextResponse.json({ enabled: Boolean(credential) }, { headers: { "Cache-Control": "no-store" } });
}
