import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveProfileImageUrl } from "@/lib/profileImages";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const logs = await prisma.signupLog.findMany({
    where: { eventId: params.id },
    include: { user: true },
    orderBy: { createdAt: "desc" }
  });

  const eventLogs = await prisma.eventLog.findMany({
    where: { eventId: params.id },
    include: { actor: true },
    orderBy: { createdAt: "desc" }
  });

  const logsWithResolvedImages = await Promise.all(
    logs.map(async (log) => ({
      ...log,
      user: {
        ...log.user,
        image: await resolveProfileImageUrl(log.user.image)
      }
    }))
  );

  const eventLogsWithResolvedImages = await Promise.all(
    eventLogs.map(async (log) => ({
      ...log,
      actor: log.actor
        ? {
            ...log.actor,
            image: await resolveProfileImageUrl(log.actor.image)
          }
        : null
    }))
  );

  return NextResponse.json({ logs: logsWithResolvedImages, eventLogs: eventLogsWithResolvedImages });
}
