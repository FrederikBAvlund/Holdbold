import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const unauthorized = () => NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Ikke adgang" }, { status: 403 });

/** Trænere/admin kan oprette begivenheder og gentagelser */
export const EVENT_MANAGER_ROLES: readonly Role[] = ["ADMIN", "TRAENER", "BOEDEKASSEFORMAND"];

/** Kun admin og bødekasse kan køre visse automations-endpoints manuelt */
export const FINE_AUTOMATION_ROLES: readonly Role[] = ["ADMIN", "BOEDEKASSEFORMAND"];

export async function requireSession(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, response: unauthorized() };
  }
  return { ok: true, userId: session.user.id };
}

export async function requireActiveTeamMember(
  userId: string,
  teamId: string
): Promise<{ ok: true; role: Role } | { ok: false; response: NextResponse }> {
  const membership = await prisma.membership.findFirst({
    where: { teamId, userId, status: "ACTIVE" },
    select: { role: true }
  });
  if (!membership) {
    return { ok: false, response: forbidden() };
  }
  return { ok: true, role: membership.role };
}

export async function requireActiveTeamMemberWithRoles(
  userId: string,
  teamId: string,
  allowedRoles: readonly Role[]
): Promise<{ ok: true; role: Role } | { ok: false; response: NextResponse }> {
  const member = await requireActiveTeamMember(userId, teamId);
  if (!member.ok) return member;
  if (!allowedRoles.includes(member.role)) {
    return { ok: false, response: forbidden() };
  }
  return member;
}
