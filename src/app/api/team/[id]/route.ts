import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const themeConfigSchema = z
  .object({
    ink: z.string().optional(),
    clay: z.string().optional(),
    moss: z.string().optional(),
    ember: z.string().optional(),
    fog: z.string().optional(),
    button: z.string().optional(),
    buttonText: z.string().optional(),
    gradientStart: z.string().optional(),
    gradientMid: z.string().optional(),
    gradientEnd: z.string().optional()
  })
  .partial();

const updateSchema = z.object({
  themePreset: z.string().min(1).optional(),
  themeConfig: themeConfigSchema.nullable().optional()
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
      ...(body.themePreset ? { themePreset: body.themePreset } : {}),
      ...(body.themeConfig !== undefined ? { themeConfig: body.themeConfig } : {})
    }
  });

  return NextResponse.json({ team });
}
