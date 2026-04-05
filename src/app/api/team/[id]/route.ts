import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
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
  themeConfig: themeConfigSchema.nullable().optional(),
  mobilePayBox: z.string().trim().min(1).max(32).optional().nullable()
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({
    where: { teamId: params.id, userId: session.user.id, status: "ACTIVE" },
    select: { id: true }
  });
  if (!membership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const team = await prisma.team.findUnique({
    where: { id: params.id }
  });

  if (!team) {
    return NextResponse.json({ error: "Team ikke fundet" }, { status: 404 });
  }

  return NextResponse.json({ team });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({
    where: { teamId: params.id, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Kun admin kan opdatere holdindstillinger" }, { status: 403 });
  }

  const json = await request.json();
  const body = updateSchema.parse(json);
  const themeConfigValue =
    body.themeConfig === undefined
      ? undefined
      : body.themeConfig === null
        ? Prisma.JsonNull
      : (body.themeConfig as Prisma.InputJsonValue);
  const mobilePayBox = body.mobilePayBox === undefined ? undefined : body.mobilePayBox;
  const updateData = {
    ...(body.themePreset ? { themePreset: body.themePreset } : {}),
    ...(themeConfigValue !== undefined ? { themeConfig: themeConfigValue } : {}),
    ...(mobilePayBox !== undefined ? { mobilePayBox } : {})
  };

  try {
    const team = await prisma.team.update({
      where: { id: params.id },
      data: updateData
    });
    return NextResponse.json({ team });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const isTeamThemeSchemaMismatch =
      message.includes("Unknown argument `mobilePayBox`") ||
      message.includes("Unknown argument `themePreset`") ||
      message.includes("Unknown argument `themeConfig`");

    if (!isTeamThemeSchemaMismatch) {
      throw error;
    }

    // Fallback for temporarily stale Prisma client in a running dev server.
    try {
      if (body.themePreset !== undefined) {
        await prisma.$executeRaw(
          Prisma.sql`UPDATE "Team" SET "themePreset" = ${body.themePreset} WHERE "id" = ${params.id}`
        );
      }
      if (themeConfigValue !== undefined) {
        if (body.themeConfig === null) {
          await prisma.$executeRaw(
            Prisma.sql`UPDATE "Team" SET "themeConfig" = NULL WHERE "id" = ${params.id}`
          );
        } else {
          await prisma.$executeRaw(
            Prisma.sql`UPDATE "Team" SET "themeConfig" = ${body.themeConfig as Prisma.InputJsonValue} WHERE "id" = ${params.id}`
          );
        }
      }
      if (mobilePayBox !== undefined) {
        await prisma.$executeRaw(
          Prisma.sql`UPDATE "Team" SET "mobilePayBox" = ${mobilePayBox} WHERE "id" = ${params.id}`
        );
      }
    } catch {
      return NextResponse.json(
        {
          error:
            "Kunne ikke gemme holdindstillinger. Kør prisma migrate + prisma generate og genstart serveren."
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      team: null,
      mobilePayBox,
      warning:
        "Gemt via SQL-fallback. Kør prisma generate og genstart serveren for fuld Prisma-synk."
    });
  }
}
