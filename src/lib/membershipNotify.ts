import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { createNotifications } from "@/lib/notifications";
import { membershipActivatedMail } from "@/lib/mailTemplates";
import { newCapabilities } from "@/lib/guide/capabilities";
import { rolesLabel } from "@/lib/roleLabels";
import type { Role } from "@/lib/roles";

/**
 * Giver en bruger besked om, at vedkommende er godkendt til et hold. Har brugeren ikke sat
 * push-notifikationer op, sendes også en mail – ellers ville de ikke høre om godkendelsen.
 */
export async function notifyMembershipActivated(input: { userId: string; teamId: string }) {
  const [user, team, pushCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId }, select: { name: true, email: true } }),
    prisma.team.findUnique({ where: { id: input.teamId }, select: { name: true } }),
    prisma.pushSubscription.count({ where: { userId: input.userId } })
  ]);
  if (!user || !team) return;

  await createNotifications([
    {
      userId: input.userId,
      teamId: input.teamId,
      type: "GENERAL",
      title: "Din adgang er godkendt",
      body: `Du er nu tilmeldt ${team.name}.`,
      link: "/dashboard"
    }
  ]);

  if (pushCount === 0 && user.email) {
    try {
      await sendMail({ to: user.email, ...membershipActivatedMail({ name: user.name, teamName: team.name }) });
    } catch (error) {
      console.error("Kunne ikke sende mail om godkendt tilmelding", error);
    }
  }
}

/** Giver et medlem besked om nye roller, der åbner for noget nyt – så guiden kan vise de nye dele. */
export async function notifyRolesGained(input: {
  userId: string;
  teamId: string;
  previousRoles: readonly Role[];
  roles: readonly Role[];
}) {
  if (newCapabilities(input.previousRoles, input.roles).length === 0) return;
  const gained = input.roles.filter((role) => !input.previousRoles.includes(role));
  const team = await prisma.team.findUnique({ where: { id: input.teamId }, select: { name: true } });
  if (!team) return;

  await createNotifications([
    {
      userId: input.userId,
      teamId: input.teamId,
      type: "GENERAL",
      title: `Du er nu ${rolesLabel(gained).toLowerCase()} 🎉`,
      body: `Se hvad du har fået adgang til på ${team.name}.`,
      link: "/dashboard"
    }
  ]);
}
