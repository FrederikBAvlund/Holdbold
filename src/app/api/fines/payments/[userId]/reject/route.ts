import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  teamId: z.string().min(1)
});

export async function POST(request: Request, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const json = await request.json();
  const body = bodySchema.parse(json);

  const membership = await prisma.membership.findFirst({
    where: { teamId: body.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Kun admin kan afvise betaling" }, { status: 403 });
  }

  const pendingFines = await prisma.fine.findMany({
    where: {
      teamId: body.teamId,
      userId: params.userId,
      status: "PAID_PENDING"
    },
    select: { id: true, amount: true }
  });

  if (pendingFines.length === 0) {
    return NextResponse.json({ error: "Ingen afventende betalinger fundet" }, { status: 400 });
  }

  const total = pendingFines.reduce((sum, fine) => sum + fine.amount, 0);

  await prisma.fine.updateMany({
    where: { id: { in: pendingFines.map((fine) => fine.id) } },
    data: {
      status: "UNPAID",
      markedPaidAt: null,
      markedPaidById: null
    }
  });

  await prisma.notification.create({
    data: {
      userId: params.userId,
      teamId: body.teamId,
      type: "FINE",
      title: "Betaling afvist",
      body: `Din betaling på ${total} kr blev afvist.`,
      link: "/dashboard/boder"
    }
  });

  return NextResponse.json({ rejected: pendingFines.length, total });
}
