import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { createNotifications } from "@/lib/notifications";
import { notificationRef } from "@/lib/notificationRefs";
import { teamRequestReceivedMail } from "@/lib/mailTemplates";
import { isSuperAdminEmail } from "@/lib/superAdmin";

export const MAX_PENDING_TEAM_REQUESTS_PER_USER = 3;

/** Systemadministratorernes e-mails (SUPER_ADMIN_EMAILS, ellers standardadressen). */
export function superAdminEmails(): string[] {
  const configured = process.env.SUPER_ADMIN_EMAILS?.trim() || "frederikavlund@gmail.com";
  return configured
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((email) => email && isSuperAdminEmail(email));
}

/** Giver systemadministratorerne besked om en ny holdanmodning (app-notifikation + mail). */
export async function notifySuperAdminsOfTeamRequest(request: {
  id: string;
  name: string;
  slug: string;
  requesterName: string;
  requesterEmail: string;
}) {
  const emails = superAdminEmails();
  const admins = await prisma.user.findMany({
    where: { OR: emails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })) },
    select: { id: true }
  });

  if (admins.length > 0) {
    await createNotifications(
      admins.map((admin) => ({
        userId: admin.id,
        teamId: null,
        type: "GENERAL" as const,
        title: "Ny holdanmodning",
        body: `${request.requesterName} har anmodet om holdet ${request.name} (${request.slug})`,
        link: "/dashboard/admin",
        refKey: notificationRef.teamRequest(request.id)
      }))
    );
  }

  const mail = teamRequestReceivedMail({
    requesterName: request.requesterName,
    requesterEmail: request.requesterEmail,
    teamName: request.name,
    slug: request.slug
  });
  await Promise.all(
    emails.map((to) =>
      sendMail({ to, ...mail }).catch((error) => console.error("Kunne ikke sende mail om holdanmodning", error))
    )
  );
}
