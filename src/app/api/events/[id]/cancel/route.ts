import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { team: true }
  });

  if (!event) {
    return NextResponse.json({ error: "Begivenhed ikke fundet" }, { status: 404 });
  }

  const eventMembership = await prisma.membership.findFirst({
    where: { userId: session.user.id, teamId: event.teamId }
  });
  const role = eventMembership?.role ?? "SPILLER";
  if (!["ADMIN", "TRAENER", "BOEDEKASSEFORMAND"].includes(role)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const updated = await prisma.event.update({
    where: { id: params.id },
    data: {
      canceledAt: new Date(),
      canceledById: session.user.id
    }
  });

  await prisma.eventLog.create({
    data: {
      eventId: event.id,
      actorId: session.user.id,
      type: "CANCEL",
      message: `Begivenhed aflyst af ${session.user.name ?? "Administrator"}`
    }
  });

  const members = await prisma.membership.findMany({
    where: { teamId: event.teamId },
    select: { userId: true }
  });

  const notifications = members
    .filter((member) => member.userId !== session.user.id)
    .map((member) => ({
      userId: member.userId,
      teamId: event.teamId,
      type: "EVENT" as const,
      title: `Aflyst: ${event.title}`,
      body: `${new Date(event.date).toLocaleString("da-DK")} · ${event.location}`,
      link: "/dashboard/kalender"
    }));

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  return NextResponse.json({ event: updated });
}
