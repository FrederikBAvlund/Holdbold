import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { guideRolesAfterRoleChange } from "@/lib/guide/state";
import { notifyMembershipActivated } from "@/lib/membershipNotify";
import { notificationRef, resolveNotifications } from "@/lib/notificationRefs";
import { prisma } from "@/lib/prisma";
import { isAdminRoles, normalizeRoles, roles } from "@/lib/roles";

const updateSchema = z.object({
  roles: z.array(z.enum(roles)).min(1, "Vælg mindst én rolle").optional(),
  status: z.enum(["PENDING", "ACTIVE"]).optional()
}).refine((value) => value.roles || value.status, {
  message: "roles eller status er påkrævet"
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ugyldigt input" }, { status: 400 });
  }
  const body = parsed.data;

  const membership = await prisma.membership.findUnique({
    where: { id: params.id }
  });

  if (!membership) {
    return NextResponse.json({ error: "Medlem ikke fundet" }, { status: 404 });
  }

  const acting = await prisma.membership.findFirst({
    where: { userId: session.user.id, teamId: membership.teamId, status: "ACTIVE" }
  });
  if (!isAdminRoles(acting?.roles)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const nextRoles = body.roles ? normalizeRoles(body.roles) : null;

  // Holdet må aldrig stå uden admin
  if (nextRoles && isAdminRoles(membership.roles) && !isAdminRoles(nextRoles) && membership.status === "ACTIVE") {
    const otherAdmins = await prisma.membership.count({
      where: { teamId: membership.teamId, status: "ACTIVE", roles: { has: "ADMIN" }, id: { not: membership.id } }
    });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: "Holdet skal have mindst én admin" }, { status: 409 });
    }
  }

  const updated = await prisma.membership.update({
    where: { id: params.id },
    data: {
      ...(nextRoles ? { roles: nextRoles, guideRoles: guideRolesAfterRoleChange(membership.guideRoles, nextRoles) } : {}),
      ...(body.status ? { status: body.status } : {})
    }
  });

  if (membership.status === "PENDING" && updated.status === "ACTIVE") {
    await resolveNotifications([notificationRef.membership(membership.teamId, membership.userId)]);
    await notifyMembershipActivated({ userId: membership.userId, teamId: membership.teamId });
  }

  return NextResponse.json({ membership: updated });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const membership = await prisma.membership.findUnique({
    where: { id: params.id }
  });

  if (!membership) {
    return NextResponse.json({ error: "Medlem ikke fundet" }, { status: 404 });
  }

  const acting = await prisma.membership.findFirst({
    where: { userId: session.user.id, teamId: membership.teamId, status: "ACTIVE" }
  });
  if (!isAdminRoles(acting?.roles)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const userId = membership.userId;

  await prisma.membership.delete({ where: { id: params.id } });
  await resolveNotifications([notificationRef.membership(membership.teamId, userId)]);

  const remainingMemberships = await prisma.membership.count({ where: { userId } });
  if (remainingMemberships > 0) {
    return NextResponse.json({ removed: true, userDeleted: false });
  }

  // GDPR: Når brugeren ikke længere er på noget hold, slettes brugeren helt. Bøder, tilmeldinger,
  // notifikationer, fravær m.m. følger med (onDelete: Cascade i skemaet). Felter, der blot peger på
  // brugeren som opretter/godkender, nulstilles, så holdets øvrige data bevares.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  await prisma.$transaction(async (tx) => {
    // Hændelseslog gemmer navne som tekst, så de skal anonymiseres, før brugeren forsvinder.
    if (user?.name.trim()) {
      const [signups, actorLogs] = await Promise.all([
        tx.signup.findMany({ where: { userId }, select: { eventId: true } }),
        tx.eventLog.findMany({ where: { actorId: userId }, select: { eventId: true } })
      ]);
      const eventIds = Array.from(new Set([...signups, ...actorLogs].map((row) => row.eventId)));
      if (eventIds.length > 0) {
        await tx.$executeRaw`
          UPDATE "EventLog"
          SET "message" = REPLACE("message", ${user.name}, 'Slettet bruger')
          WHERE "eventId" IN (${Prisma.join(eventIds)})
        `;
      }
    }
    await tx.user.delete({ where: { id: userId } });
  });

  return NextResponse.json({ removed: true, userDeleted: true });
}
