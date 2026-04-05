import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const template = await prisma.fineTemplate.findUnique({
    where: { id: params.id }
  });
  if (!template) {
    return NextResponse.json({ error: "Skabelon ikke fundet" }, { status: 404 });
  }

  const membership = await prisma.membership.findFirst({
    where: { teamId: template.teamId, userId: session.user.id }
  });
  const role = membership?.role ?? "SPILLER";
  if (!["ADMIN", "BOEDEKASSEFORMAND"].includes(role)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const updated = await prisma.fineTemplate.update({
    where: { id: params.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: session.user.id,
      rejectedAt: null,
      rejectedById: null
    }
  });

  if (template.createdById && template.createdById !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: template.createdById,
        teamId: template.teamId,
        type: "FINE_PROPOSED",
        title: "Bødeskabelon godkendt",
        body: `${template.title} · ${template.amount} kr`,
        link: "/dashboard/boder"
      }
    });
  }

  return NextResponse.json({ template: updated });
}
