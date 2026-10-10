import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

/** Giver platformadministratoren adgang som ADMIN til et eksisterende hold. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const team = await prisma.team.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!team) return NextResponse.json({ error: "Holdet findes ikke" }, { status: 404 });

  await prisma.membership.upsert({
    where: { userId_teamId: { userId: auth.userId, teamId: team.id } },
    create: { userId: auth.userId, teamId: team.id, role: "ADMIN", status: "ACTIVE" },
    update: { role: "ADMIN", status: "ACTIVE" }
  });
  return NextResponse.json({ ok: true });
}
