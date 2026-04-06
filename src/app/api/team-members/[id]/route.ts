import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { createNotifications } from "@/lib/notifications";
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
      ...(body.role ? { role: body.role } : {}),
      ...(body.status ? { status: body.status } : {})
    }
  });

  if (membership.status === "PENDING" && updated.status === "ACTIVE") {
    await createNotifications([
      {
        userId: membership.userId,
        teamId: membership.teamId,
        type: "GENERAL",
        title: "Din adgang er godkendt",
        body: "Du har nu adgang til holdet.",
        link: "/dashboard"
      }
    ]);
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

  const remainingMemberships = await prisma.membership.count({ where: { userId } });
  if (remainingMemberships > 0) {
    return NextResponse.json({ removed: true, userDeleted: false });
  }

  const relatedCounts = await prisma.$transaction([
    prisma.signup.count({ where: { userId } }),
    prisma.fine.count({ where: { userId } }),
    prisma.event.count({ where: { createdById: userId } })
  ]);

  const hasRelations = relatedCounts.some((count) => count > 0);
  if (hasRelations) {
    return NextResponse.json({
      removed: true,
      userDeleted: false,
      warning: "Brugeren har historik og kan ikke slettes helt."
    });
  }

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ removed: true, userDeleted: true });
}
