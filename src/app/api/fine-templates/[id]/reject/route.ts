import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notificationRef, resolveBulkFineProposalNotifications, resolveNotifications } from "@/lib/notificationRefs";
import { prisma } from "@/lib/prisma";
import { FINE_MANAGER_ROLES, hasAnyRole } from "@/lib/roles";

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
  if (!hasAnyRole(membership?.roles, FINE_MANAGER_ROLES)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const updated = await prisma.fineTemplate.update({
    where: { id: params.id },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectedById: session.user.id
    }
  });

  await resolveNotifications([notificationRef.template(template.id)]);

  if (template.createdById && template.createdById !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: template.createdById,
        teamId: template.teamId,
        type: "FINE_PROPOSED",
        title: "Bødeskabelon afvist",
        body: `${template.title} · ${template.amount} kr`,
        link: "/dashboard/boder"
      }
    });
  }

  return NextResponse.json({ template: updated });
}
