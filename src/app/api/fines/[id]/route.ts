import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureFineSeasonOpen } from "@/lib/seasons";
import { FINE_MANAGER_ROLES, hasAnyRole } from "@/lib/roles";

const deletableStatuses = new Set(["UNPAID", "PAID_PENDING", "AFVIST"]);

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const seasonGuard = await ensureFineSeasonOpen(params.id);
  if (seasonGuard) return seasonGuard;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const fine = await prisma.fine.findUnique({
    where: { id: params.id },
    select: { id: true, teamId: true, status: true }
  });
  if (!fine) {
    return NextResponse.json({ error: "Bøde ikke fundet" }, { status: 404 });
  }

  const membership = await prisma.membership.findFirst({
    where: { teamId: fine.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { roles: true }
  });
  if (!membership || !hasAnyRole(membership.roles, FINE_MANAGER_ROLES)) {
    return NextResponse.json({ error: "Kun admin/bødekasseformand kan slette bøder" }, { status: 403 });
  }

  if (!deletableStatuses.has(fine.status)) {
    return NextResponse.json({ error: "Foreslåede og betalte bøder kan ikke slettes" }, { status: 400 });
  }

  await prisma.fine.delete({ where: { id: fine.id } });
  return NextResponse.json({ ok: true });
}

