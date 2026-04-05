import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const fineToApprove = await prisma.fine.findUnique({
    where: { id: params.id },
    select: { id: true, teamId: true, status: true, userId: true, createdById: true, reason: true, amount: true }
  });
  if (!fineToApprove) {
    return NextResponse.json({ error: "Bøde ikke fundet" }, { status: 404 });
  }

  const membership = await prisma.membership.findFirst({
    where: { teamId: fineToApprove.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!membership || !["ADMIN", "BOEDEKASSEFORMAND"].includes(membership.role)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }
  if (fineToApprove.status !== "FORESLAET") {
    return NextResponse.json({ error: "Kun foreslåede bøder kan godkendes" }, { status: 400 });
  }

  const fine = await prisma.fine.update({
    where: { id: params.id },
    data: {
      status: "UNPAID",
      approvedAt: new Date(),
      approvedById: session.user.id
    }
  });

  const notificationTargets = new Set<string>();
  if (fineToApprove.userId !== session.user.id) notificationTargets.add(fineToApprove.userId);
  if (fineToApprove.createdById && fineToApprove.createdById !== session.user.id) {
    notificationTargets.add(fineToApprove.createdById);
  }
  if (notificationTargets.size > 0) {
    await prisma.notification.createMany({
      data: Array.from(notificationTargets).map((userId) => ({
        userId,
        teamId: fineToApprove.teamId,
        type: "FINE" as const,
        title: "Foreslået bøde godkendt",
        body: `${fineToApprove.reason} · ${fineToApprove.amount} kr`,
        link: "/dashboard/boder"
      }))
    });
  }

  return NextResponse.json({ fine });
}
