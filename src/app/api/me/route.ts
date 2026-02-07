import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ user: null, memberships: [] }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  });

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { team: true },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json({
    user: {
      id: session.user.id,
      name: user?.name ?? session.user.name ?? null,
      email: user?.email ?? session.user.email ?? null,
      phone: user?.phone ?? null,
      image: user?.image ?? null
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

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(3).optional().nullable(),
  image: imageSchema.optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional()
});

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const json = await request.json();
  const data = updateSchema.parse(json);

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

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: data.name ?? user.name,
        email: data.email === undefined ? user.email : data.email,
        phone: data.phone === undefined ? user.phone : data.phone,
        image: data.image === undefined ? user.image : data.image,
        passwordHash: data.newPassword ? await bcrypt.hash(data.newPassword, 10) : user.passwordHash
      }
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        image: updated.image
      }
    });
  } catch (error) {
    console.error("Failed to update profile", error);
    return NextResponse.json({ error: "Kunne ikke opdatere profil" }, { status: 500 });
  }
}
