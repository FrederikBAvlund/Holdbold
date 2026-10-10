import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/superAdmin";

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const [teams, mine] = await Promise.all([
    prisma.team.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } }
      }
    }),
    prisma.membership.findMany({
      where: { userId: auth.userId, status: "ACTIVE" },
      select: { teamId: true }
    })
  ]);
  const mineIds = new Set(mine.map((m) => m.teamId));
  const others = await prisma.membership.groupBy({
    by: ["teamId"],
    where: { userId: { not: auth.userId } },
    _count: { _all: true }
  });
  const otherCounts = new Map(others.map((row) => [row.teamId, row._count._all]));

  return NextResponse.json({
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
      createdAt: team.createdAt,
      activeMembers: team._count.memberships,
      isMember: mineIds.has(team.id),
      otherMembers: otherCounts.get(team.id) ?? 0
    }))
  });
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Navn skal have mindst 2 tegn").max(60),
  slug: z.string().trim().min(2, "Holdkode skal have mindst 2 tegn").max(40)
});

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : "Ugyldigt input";
    return NextResponse.json({ error: message ?? "Ugyldigt input" }, { status: 400 });
  }

  const slug = slugify(body.slug);
  if (slug.length < 2) {
    return NextResponse.json({ error: "Holdkoden skal indeholde mindst 2 bogstaver eller tal" }, { status: 400 });
  }
  if (await prisma.team.findUnique({ where: { slug }, select: { id: true } })) {
    return NextResponse.json({ error: "Holdkoden er allerede i brug af et andet hold" }, { status: 409 });
  }

  try {
    const team = await prisma.$transaction(async (tx) => {
      const created = await tx.team.create({ data: { name: body.name, slug } });
      await tx.season.create({ data: { teamId: created.id, name: "Sæson 1" } });
      await tx.membership.create({
        data: { teamId: created.id, userId: auth.userId, role: "ADMIN", status: "ACTIVE" }
      });
      return created;
    });
    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Holdkoden er allerede i brug af et andet hold" }, { status: 409 });
    }
    throw error;
  }
}
