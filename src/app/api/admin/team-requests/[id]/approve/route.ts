import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { sendMail } from "@/lib/mail";
import { teamRequestApprovedMail } from "@/lib/mailTemplates";
import { createNotifications } from "@/lib/notifications";
import { notificationRef, resolveNotifications } from "@/lib/notificationRefs";
import { prisma } from "@/lib/prisma";
import { createTeamWithAdmin } from "@/lib/teams";

/** Systemadmin godkender en holdanmodning: holdet oprettes, og anmoderen bliver holdadministrator. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const teamRequest = await prisma.teamRequest.findUnique({
    where: { id: params.id },
    include: { user: { select: { id: true, name: true, email: true } } }
  });
  if (!teamRequest) return NextResponse.json({ error: "Anmodning ikke fundet" }, { status: 404 });
  if (teamRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Anmodningen er allerede behandlet" }, { status: 409 });
  }

  let team;
  try {
    team = await prisma.$transaction(async (tx) => {
      // Betinget opdatering sikrer, at to samtidige godkendelser ikke begge opretter et hold.
      const claimed = await tx.teamRequest.updateMany({
        where: { id: teamRequest.id, status: "PENDING" },
        data: { status: "APPROVED", decidedById: auth.userId, decidedAt: new Date() }
      });
      if (claimed.count !== 1) throw new Error("ALREADY_DECIDED");

      const created = await createTeamWithAdmin(tx, {
        name: teamRequest.name,
        slug: teamRequest.slug,
        themePreset: teamRequest.themePreset,
        adminUserId: teamRequest.userId
      });
      await tx.teamRequest.update({ where: { id: teamRequest.id }, data: { teamId: created.id } });
      return created;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_DECIDED") {
      return NextResponse.json({ error: "Anmodningen er allerede behandlet" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Holdkoden er allerede i brug af et andet hold" }, { status: 409 });
    }
    throw error;
  }

  await resolveNotifications([notificationRef.teamRequest(teamRequest.id)]).catch(() => undefined);
  await createNotifications([
    {
      userId: teamRequest.userId,
      teamId: team.id,
      type: "GENERAL",
      title: "Dit hold er oprettet",
      body: `${team.name} er godkendt, og du er administrator for holdet.`,
      link: "/dashboard"
    }
  ]).catch((error) => console.error("Kunne ikke oprette notifikation om godkendt hold", error));

  if (teamRequest.user.email) {
    try {
      await sendMail({ to: teamRequest.user.email, ...teamRequestApprovedMail({ name: teamRequest.user.name, teamName: team.name }) });
    } catch (error) {
      console.error("Kunne ikke sende mail om godkendt hold", error);
    }
  }

  return NextResponse.json({ team: { id: team.id, name: team.name, slug: team.slug } });
}
