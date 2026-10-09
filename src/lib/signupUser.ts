import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

/** Opretter en bruger med et afventende medlemskab efter bekræftet e-mail. Returnerer null, hvis e-mailen allerede findes. */
export async function createUserFromSignup(input: { email: string; name: string; teamId: string }) {
  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        memberships: { create: { teamId: input.teamId, role: "SPILLER", status: "PENDING" } }
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }

  const [team, admins] = await Promise.all([
    prisma.team.findUnique({ where: { id: input.teamId }, select: { slug: true } }),
    prisma.membership.findMany({
      where: { teamId: input.teamId, status: "ACTIVE", role: "ADMIN" },
      select: { userId: true }
    })
  ]);

  if (admins.length > 0) {
    await createNotifications(
      admins.map((admin) => ({
        userId: admin.userId,
        teamId: input.teamId,
        type: "GENERAL" as const,
        title: "Ny bruger afventer godkendelse",
        body: `${input.name} har oprettet sig med slug ${team?.slug ?? ""}`,
        link: "/dashboard/indstillinger"
      }))
    );
  }

  return user;
}
