import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveProfileImageUrl } from "@/lib/profileImages";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ user: null, memberships: [] }, { status: 401 });
  }

  const [user, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id }
    }),
    prisma.membership.findMany({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: { team: true },
      orderBy: { createdAt: "asc" }
    })
  ]);

  const resolvedImage = await resolveProfileImageUrl(user?.image ?? null);

  return NextResponse.json({
    user: {
      id: session.user.id,
      name: user?.name ?? session.user.name ?? null,
      email: user?.email ?? session.user.email ?? null,
      image: resolvedImage,
      themePreset: user?.themePreset ?? null,
      themeConfig: user?.themeConfig ?? null
    },
    memberships
  });
}

const imageSchema = z
  .string()
  .refine(
    (value) => value.startsWith("/") || /^https?:\/\//.test(value),
    "Invalid image path"
  );

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
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  image: imageSchema.optional().nullable(),
  themePreset: z.string().min(1).optional().nullable(),
  themeConfig: themeConfigSchema.nullable().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional()
});

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  let data: z.infer<typeof updateSchema>;
  try {
    const json = await request.json();
    data = updateSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ugyldigt input", fieldErrors: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  });

  if (!user) {
    return NextResponse.json({ error: "Bruger ikke fundet" }, { status: 404 });
  }

  if (data.newPassword) {
    if (user.passwordHash) {
      const current = data.currentPassword ?? "";
      const valid = await bcrypt.compare(current, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Nuværende adgangskode er forkert" }, { status: 400 });
      }
    }
  }

  const normalizedEmail =
    data.email === undefined ? undefined : data.email === null ? null : data.email.trim().toLowerCase();

  try {
    const themeConfigValue =
      data.themeConfig === undefined
        ? undefined
        : data.themeConfig === null
          ? Prisma.JsonNull
          : (data.themeConfig as Prisma.InputJsonValue);

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: data.name ?? user.name,
        email: normalizedEmail === undefined ? user.email : normalizedEmail,
        image: data.image === undefined ? user.image : data.image,
        passwordHash: data.newPassword ? await bcrypt.hash(data.newPassword, 10) : user.passwordHash,
        ...(data.themePreset !== undefined ? { themePreset: data.themePreset } : {}),
        ...(themeConfigValue !== undefined ? { themeConfig: themeConfigValue } : {})
      }
    });

    const resolvedImage = await resolveProfileImageUrl(updated.image);

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        image: resolvedImage,
        themePreset: updated.themePreset ?? null,
        themeConfig: updated.themeConfig ?? null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const isUserThemeSchemaMismatch =
      message.includes("Unknown argument `themePreset`") ||
      message.includes("Unknown argument `themeConfig`");

    if (isUserThemeSchemaMismatch) {
      try {
        // Retry without theme fields for stale Prisma clients.
        const updated = await prisma.user.update({
          where: { id: session.user.id },
          data: {
            name: data.name ?? user.name,
            email: normalizedEmail === undefined ? user.email : normalizedEmail,
            image: data.image === undefined ? user.image : data.image,
            passwordHash: data.newPassword ? await bcrypt.hash(data.newPassword, 10) : user.passwordHash
          }
        });

        const resolvedImage = await resolveProfileImageUrl(updated.image);

        if (data.themePreset !== undefined) {
          await prisma.$executeRaw(
            Prisma.sql`UPDATE "User" SET "themePreset" = ${data.themePreset} WHERE "id" = ${session.user.id}`
          );
        }

        if (data.themeConfig !== undefined) {
          if (data.themeConfig === null) {
            await prisma.$executeRaw(
              Prisma.sql`UPDATE "User" SET "themeConfig" = NULL WHERE "id" = ${session.user.id}`
            );
          } else {
            await prisma.$executeRaw(
              Prisma.sql`UPDATE "User" SET "themeConfig" = ${data.themeConfig as Prisma.InputJsonValue} WHERE "id" = ${session.user.id}`
            );
          }
        }

        return NextResponse.json({
          user: {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            image: resolvedImage,
            themePreset: data.themePreset ?? null,
            themeConfig: data.themeConfig ?? null
          },
          warning:
            "Tema gemt via SQL-fallback. Kør prisma generate og genstart serveren for fuld Prisma-synk."
        });
      } catch (fallbackError) {
        console.error("Failed to update profile fallback", fallbackError);
        return NextResponse.json(
          { error: "Kunne ikke opdatere profil. Kør prisma migrate + prisma generate og genstart serveren." },
          { status: 500 }
        );
      }
    }

    console.error("Failed to update profile", error);
    return NextResponse.json({ error: "Kunne ikke opdatere profil" }, { status: 500 });
  }
}
