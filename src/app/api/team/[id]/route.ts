import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { FINE_MANAGER_ROLES } from "@/lib/apiAuth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkSlugAvailable, SLUG_ERROR_MESSAGES } from "@/lib/reservedSlugs";
import { hasAnyRole, isAdminRoles } from "@/lib/roles";

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
  mobilePayBox: z.string().trim().min(1).max(200).optional().nullable(),
  slug: z.string().trim().min(1).max(40).optional()
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({
    where: { teamId: params.id, userId: session.user.id, status: { in: ["ACTIVE", "PENDING"] } },
    select: { id: true, status: true }
  });
  if (!membership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  // Afventende medlemmer får kun holdets navn og tema, så appen allerede har holdets udseende.
  if (membership.status === "PENDING") {
    const themeOnly = await prisma.team.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, themePreset: true, themeConfig: true }
    });
    if (!themeOnly) return NextResponse.json({ error: "Team ikke fundet" }, { status: 404 });
    return NextResponse.json({ team: themeOnly });
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

  const json = await request.json();
  const body = updateSchema.parse(json);

  const membership = await prisma.membership.findFirst({
    where: { teamId: params.id, userId: session.user.id, status: "ACTIVE" },
    select: { roles: true }
  });
  // Bødekasseformanden må selv sætte MobilePay Box, men ikke resten af holdindstillingerne
  const onlyMobilePay =
    body.mobilePayBox !== undefined &&
    body.themePreset === undefined &&
    body.themeConfig === undefined &&
    body.slug === undefined;
  const allowed = membership && (isAdminRoles(membership.roles) || (onlyMobilePay && hasAnyRole(membership.roles, FINE_MANAGER_ROLES)));
  if (!allowed) {
    return NextResponse.json({ error: "Kun admin kan opdatere holdindstillinger" }, { status: 403 });
  }
  const themeConfigValue =
    body.themeConfig === undefined
      ? undefined
      : body.themeConfig === null
        ? Prisma.JsonNull
      : (body.themeConfig as Prisma.InputJsonValue);
  const mobilePayBox = body.mobilePayBox === undefined ? undefined : body.mobilePayBox;

  let slug: string | undefined;
  if (body.slug !== undefined) {
    const check = await checkSlugAvailable(body.slug, { ignoreTeamId: params.id });
    if (!check.ok) {
      const message = SLUG_ERROR_MESSAGES[check.reason];
      return NextResponse.json(
        { error: message, fieldErrors: { slug: message } },
        { status: check.reason === "too_short" ? 400 : 409 }
      );
    }
    slug = check.slug;
  }

  const updateData = {
    ...(slug !== undefined ? { slug } : {}),
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
    // To admins kan ramme samme kode samtidig – den unikke indeks afgør det.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Holdkoden er allerede i brug", fieldErrors: { slug: "Holdkoden er allerede i brug" } },
        { status: 409 }
      );
    }
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
