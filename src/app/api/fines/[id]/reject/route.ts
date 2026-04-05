import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const fineToReject = await prisma.fine.findUnique({
    where: { id: params.id },
    select: { id: true, teamId: true, status: true, createdById: true, reason: true, amount: true }
  });
  if (!fineToReject) {
    return NextResponse.json({ error: "Bøde ikke fundet" }, { status: 404 });
  }

  const membership = await prisma.membership.findFirst({
    where: { teamId: fineToReject.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!membership || !["ADMIN", "BOEDEKASSEFORMAND"].includes(membership.role)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }
  if (fineToReject.status !== "FORESLAET") {
    return NextResponse.json({ error: "Kun foreslåede bøder kan afvises" }, { status: 400 });
  }

  const fine = await prisma.fine.update({
    where: { id: params.id },
    data: {
      status: "AFVIST",
      rejectedAt: new Date(),
      rejectedById: session.user.id
    }
  });

  if (fineToReject.createdById && fineToReject.createdById !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: fineToReject.createdById,
        teamId: fineToReject.teamId,
        type: "FINE",
        title: "Foreslået bøde afvist",
        body: `${fineToReject.reason} · ${fineToReject.amount} kr`,
        link: "/dashboard/boder"
      }
    });
  }

  return NextResponse.json({ fine });
}
