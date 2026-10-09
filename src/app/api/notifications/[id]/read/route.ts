import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const notification = await prisma.notification.updateMany({
    where: { id: params.id, userId: session.user.id, readAt: null },
    data: { readAt: new Date() }
  });

  const count = await prisma.notification.count({
    where: { userId: session.user.id, readAt: null }
  });

  return NextResponse.json({ updated: notification.count, unreadCount: count });
}
