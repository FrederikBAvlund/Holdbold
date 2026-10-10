import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { notifyAdminsOfPendingMember } from "@/lib/signupUser";

const bodySchema = z.object({
  teamSlug: z.string().trim().min(1, "Holdkode er påkrævet")
});

/** Tilmelder den indloggede bruger et ekstra hold. Medlemskabet afventer godkendelse fra holdets admin. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }
  const userId = session.user.id;

  const limit = await checkRateLimit(`join-team:user:${userId}`, 10, 10 * 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "For mange forsøg. Vent lidt, og prøv igen." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig request body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ugyldigt input" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { slug: parsed.data.teamSlug.toLowerCase() },
    select: { id: true, name: true }
  });
  if (!team) {
    return NextResponse.json({ error: "Holdkode findes ikke" }, { status: 404 });
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_teamId: { userId, teamId: team.id } },
    select: { status: true }
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          existing.status === "ACTIVE"
            ? "Du er allerede med på det hold"
            : "Du har allerede bedt om at komme på det hold og afventer godkendelse"
      },
      { status: 409 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  await prisma.membership.create({ data: { userId, teamId: team.id, role: "SPILLER", status: "PENDING" } });
  await notifyAdminsOfPendingMember({ teamId: team.id, userId, name: user?.name ?? session.user.name ?? "En bruger" });

  return NextResponse.json({ ok: true, team: { id: team.id, name: team.name } }, { status: 201 });
}
