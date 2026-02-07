import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({ logs, eventLogs });
}
