import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { guideRoleAfterRoleChange } from "@/lib/guide/state";
import { notifyMembershipActivated } from "@/lib/membershipNotify";
import { notificationRef, resolveNotifications } from "@/lib/notificationRefs";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  role: z.enum(["ADMIN", "TRAENER", "SPILLER", "SOME", "BOEDEKASSEFORMAND"]).optional(),
  status: z.enum(["PENDING", "ACTIVE"]).optional()
}).refine((value) => value.role || value.status, {
  message: "role eller status er påkrævet"
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const json = await request.json();
  const body = updateSchema.parse(json);

  const membership = await prisma.membership.findUnique({
    where: { id: params.id }
  });

  if (!membership) {
    return NextResponse.json({ error: "Medlem ikke fundet" }, { status: 404 });
  }

  const acting = await prisma.membership.findFirst({
    where: { userId: session.user.id, teamId: membership.teamId, status: "ACTIVE" }
  });
  if (acting?.role !== "ADMIN") {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const updated = await prisma.membership.update({
    where: { id: params.id },
    data: {
      ...(body.role ? { role: body.role, guideRole: guideRoleAfterRoleChange(membership.guideRole, body.role) } : {}),
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
  if (acting?.role !== "ADMIN") {
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
