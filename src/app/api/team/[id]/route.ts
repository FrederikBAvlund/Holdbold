import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  themePreset: z.string().min(1).optional()
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const team = await prisma.team.findUnique({
    where: { id: params.id }
  });

  if (!team) {
    return NextResponse.json({ error: "Team ikke fundet" }, { status: 404 });
  }

  return NextResponse.json({ team });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const json = await request.json();
  const body = updateSchema.parse(json);

  const team = await prisma.team.update({
    where: { id: params.id },
    data: {
      ...(body.themePreset ? { themePreset: body.themePreset } : {})
    }
  });

  return NextResponse.json({ team });
}
