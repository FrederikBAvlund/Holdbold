import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  unread: z.enum(["true", "false"]).optional(),
  limit: z.string().optional()
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ notifications: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.parse({
    unread: searchParams.get("unread") ?? undefined,
    limit: searchParams.get("limit") ?? undefined
  });

  const limit = parsed.limit ? Math.min(Number(parsed.limit) || 50, 200) : 100;

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      ...(parsed.unread === "true" ? { readAt: null } : {})
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  return NextResponse.json({ notifications });
}
