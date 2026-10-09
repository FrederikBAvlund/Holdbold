import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  unread: z.enum(["true", "false"]).optional(),
  limit: z.string().optional(),
  days: z.string().optional()
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ notifications: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.parse({
    unread: searchParams.get("unread") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    days: searchParams.get("days") ?? undefined
  });

  const limit = parsed.limit ? Math.min(Number(parsed.limit) || 50, 200) : 100;

  const days = Number(parsed.days);
  const since = Number.isFinite(days) && days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(parsed.unread === "true" ? { readAt: null } : {})
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  return NextResponse.json({ notifications });
}
