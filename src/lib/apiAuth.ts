import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAnyRole, SIGNUP_VIEWER_ROLES } from "@/lib/roles";
import { isSuperAdminEmail } from "@/lib/superAdmin";

const unauthorized = () => NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Ikke adgang" }, { status: 403 });

export {
  ABSENCE_MANAGER_ROLES,
  EVENT_MANAGER_ROLES,
  FINE_AUTOMATION_ROLES,
  FINE_MANAGER_ROLES,
  MOTM_MANAGER_ROLES,
  SIGNUP_VIEWER_ROLES
} from "@/lib/roles";

/** Spillere må kun se egen tilmelding; ledere må se alles */
export function canViewSignupOf(actorId: string, actorRoles: readonly Role[], targetUserId: string): boolean {
  return actorId === targetUserId || hasAnyRole(actorRoles, SIGNUP_VIEWER_ROLES);
}

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
): Promise<{ ok: true; roles: Role[] } | { ok: false; response: NextResponse }> {
  const membership = await prisma.membership.findFirst({
    where: { teamId, userId, status: "ACTIVE" },
    select: { roles: true }
  });
  if (!membership) {
    return { ok: false, response: forbidden() };
  }
  return { ok: true, roles: membership.roles };
}

export async function requireActiveTeamMemberWithRoles(
  userId: string,
  teamId: string,
  allowedRoles: readonly Role[]
): Promise<{ ok: true; roles: Role[] } | { ok: false; response: NextResponse }> {
  const member = await requireActiveTeamMember(userId, teamId);
  if (!member.ok) return member;
  if (!hasAnyRole(member.roles, allowedRoles)) {
    return { ok: false, response: forbidden() };
  }
  return member;
}

/** Kun platformadministratorer (se SUPER_ADMIN_EMAILS) */
export async function requireSuperAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, response: unauthorized() };
  }
  if (!isSuperAdminEmail(session.user.email)) {
    return { ok: false, response: forbidden() };
  }
  return { ok: true, userId: session.user.id };
}
