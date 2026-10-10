import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  teamId: z.string().min(1)
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.parse({ teamId: searchParams.get("teamId") ?? "" });

  const membership = await prisma.membership.findFirst({
    where: { teamId: parsed.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Kun admin kan se betalinger til godkendelse" }, { status: 403 });
  }

  const grouped = await prisma.fine.groupBy({
    by: ["userId"],
    where: { teamId: parsed.teamId, status: "PAID_PENDING" },
    _sum: { amount: true },
    _count: { _all: true },
    _max: { markedPaidAt: true }
  });

  if (grouped.length === 0) {
    return NextResponse.json({ payments: [] });
  }

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((item) => item.userId) } },
    select: { id: true, name: true }
  });
  const userMap = new Map(users.map((user) => [user.id, user.name ?? "Ukendt"]));

  const payments = grouped
    .map((item) => ({
      userId: item.userId,
      name: userMap.get(item.userId) ?? "Ukendt",
      total: item._sum.amount ?? 0,
      count: item._count._all,
      requestedAt: item._max.markedPaidAt?.toISOString() ?? null
    }))
    .sort((a, b) => {
      const aTime = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const bTime = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return bTime - aTime;
    });

  return NextResponse.json({ payments });
}
