import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const listSchema = z.object({
  teamId: z.string().min(1)
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  const parsed = listSchema.parse({ teamId });

  const members = await prisma.membership.findMany({
    where: { teamId: parsed.teamId },
    include: { user: true },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json({ members });
}
