import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Navn er paakraevet"),
  email: z.string().trim().email("Email er ugyldig"),
  password: z.string().min(8, "Adgangskode skal vaere mindst 8 tegn"),
  teamSlug: z.string().trim().min(1, "Hold slug er paakraevet")
});

function toFieldErrors(error: z.ZodError) {
  const flattened = error.flatten().fieldErrors;
  const result: Record<string, string> = {};

  for (const [field, messages] of Object.entries(flattened)) {
    if (Array.isArray(messages) && messages.length > 0) {
      result[field] = messages[0];
    }
  }

  return result;
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig request body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Ugyldige input",
        fieldErrors: toFieldErrors(parsed.error)
      },
      { status: 400 }
    );
  }

  const body = {
    ...parsed.data,
    email: parsed.data.email.toLowerCase()
  };

  const team = await prisma.team.findUnique({
    where: { slug: body.teamSlug.trim().toLowerCase() }
  });
  if (!team) {
    return NextResponse.json(
      {
        error: "Holdslug findes ikke",
        fieldErrors: { teamSlug: "Holdslug findes ikke" }
      },
      { status: 404 }
    );
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      email: { equals: body.email, mode: "insensitive" }
    }
  });
  if (existingUser) {
    return NextResponse.json(
      {
        error: "Bruger med email findes allerede",
        fieldErrors: {
          email: "Email er allerede i brug"
        }
      },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(body.password, 10);

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      memberships: {
        create: {
          teamId: team.id,
          role: "SPILLER",
          status: "PENDING"
        }
      }
    }
  });

  const admins = await prisma.membership.findMany({
    where: {
      teamId: team.id,
      status: "ACTIVE",
      role: "ADMIN"
    },
    select: { userId: true }
  });

  if (admins.length > 0) {
    await createNotifications(
      admins.map((admin) => ({
        userId: admin.userId,
        teamId: team.id,
        type: "GENERAL",
        title: "Ny bruger afventer godkendelse",
        body: `${body.name} har oprettet sig med slug ${team.slug}`,
        link: "/dashboard/indstillinger"
      }))
    );
  }

  return NextResponse.json({
    userId: user.id,
    message: "Bruger oprettet. En administrator skal godkende din adgang."
  });
}
