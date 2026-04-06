import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveProfileImageUrl } from "@/lib/profileImages";

const listSchema = z.object({
  teamId: z.string().min(1),
  includePending: z
    .string()
    .optional()
    .transform((value) => value === "true")
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  const includePending = searchParams.get("includePending") ?? undefined;
  const parsed = listSchema.parse({ teamId, includePending });

  const actingMembership = await prisma.membership.findFirst({
    where: {
      teamId: parsed.teamId,
      userId: session.user.id,
      status: "ACTIVE"
    },
    select: { role: true }
  });
  if (!actingMembership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const canIncludePending = parsed.includePending && actingMembership.role === "ADMIN";

  const members = await prisma.membership.findMany({
    where: {
      teamId: parsed.teamId,
      ...(canIncludePending ? {} : { status: "ACTIVE" })
    },
    include: { user: true },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }]
  });

  const membersWithResolvedImages = await Promise.all(
    members.map(async (member) => ({
      ...member,
      user: {
        ...member.user,
        image: await resolveProfileImageUrl(member.user.image)
      }
    }))
  );

  return NextResponse.json({ members: membersWithResolvedImages });
}
