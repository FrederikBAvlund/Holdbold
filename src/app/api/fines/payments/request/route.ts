import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  teamId: z.string().min(1)
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const json = await request.json();
  const body = bodySchema.parse(json);

  const membership = await prisma.membership.findFirst({
    where: { teamId: body.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { id: true }
  });
  if (!membership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const unpaidFines = await prisma.fine.findMany({
    where: {
      teamId: body.teamId,
      userId: session.user.id,
      status: "UNPAID"
    },
    select: { id: true, amount: true }
  });

  if (unpaidFines.length === 0) {
    return NextResponse.json({ error: "Du har ingen ubetalte bøder" }, { status: 400 });
  }

  const fineIds = unpaidFines.map((fine) => fine.id);
  const total = unpaidFines.reduce((sum, fine) => sum + fine.amount, 0);
  const now = new Date();

  await prisma.fine.updateMany({
    where: { id: { in: fineIds }, status: "UNPAID" },
    data: {
      status: "PAID_PENDING",
      markedPaidAt: now,
      markedPaidById: session.user.id
    }
  });

  const admins = await prisma.membership.findMany({
    where: { teamId: body.teamId, status: "ACTIVE", role: "ADMIN" },
    select: { userId: true }
  });

  const payer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true }
  });

  const notifications = admins
    .filter((admin) => admin.userId !== session.user.id)
    .map((admin) => ({
      userId: admin.userId,
      teamId: body.teamId,
      type: "FINE" as const,
      title: "Betaling afventer godkendelse",
      body: `${payer?.name ?? "En spiller"} har markeret ${unpaidFines.length} bøder som betalt (${total} kr).`,
      link: "/dashboard/boder"
    }));

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  return NextResponse.json({ updated: fineIds.length, total });
}
