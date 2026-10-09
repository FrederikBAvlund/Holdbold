import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { createNotifications } from "@/lib/notifications";

const bodySchema = z.object({
  teamSlug: z.string().trim().min(1, "Hold slug er paakraevet")
});

/** Giver en indlogget bruger (fx via Facebook) et afventende medlemskab på et hold. */
export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig request body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ugyldige input" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { slug: parsed.data.teamSlug.toLowerCase() }
  });
  if (!team) {
    return NextResponse.json({ error: "Holdslug findes ikke" }, { status: 404 });
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_teamId: { userId: auth.userId, teamId: team.id } },
    select: { status: true }
  });
  if (existing) {
    return NextResponse.json({ status: existing.status, created: false });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });

  await prisma.membership.create({
    data: { userId: auth.userId, teamId: team.id, role: "SPILLER", status: "PENDING" }
  });

  const admins = await prisma.membership.findMany({
    where: { teamId: team.id, status: "ACTIVE", role: "ADMIN" },
    select: { userId: true }
  });
  if (admins.length > 0) {
    await createNotifications(
      admins.map((admin) => ({
        userId: admin.userId,
        teamId: team.id,
        type: "GENERAL",
        title: "Ny bruger afventer godkendelse",
        body: `${user?.name ?? "En ny bruger"} har tilmeldt sig med Facebook og slug ${team.slug}`,
        link: "/dashboard/indstillinger"
      }))
    );
  }

  return NextResponse.json({ status: "PENDING", created: true });
}
