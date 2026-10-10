import { prisma } from "@/lib/prisma";

/** Nøgler, der knytter en notifikation til den sag, den handler om. */
export const notificationRef = {
  fine: (fineId: string) => `fine:${fineId}`,
  template: (templateId: string) => `template:${templateId}`,
  payment: (teamId: string, userId: string) => `payment:${teamId}:${userId}`,
  membership: (teamId: string, userId: string) => `membership:${teamId}:${userId}`,
  teamRequest: (requestId: string) => `team-request:${requestId}`,
  absence: (absenceId: string) => `absence:${absenceId}`
};

/** Markerer notifikationer om en afgjort sag som læst – for alle modtagere. */
export async function resolveNotifications(refKeys: string[]) {
  if (refKeys.length === 0) return;
  await prisma.notification.updateMany({
    where: { refKey: { in: refKeys }, readAt: null },
    data: { readAt: new Date() }
  });
}

/**
 * Samlede bødeforslag (fx fra automatik) har ingen enkelt sag at pege på.
 * Når der ikke er flere forslag tilbage på holdet, markeres de som læst.
 */
export async function resolveBulkFineProposalNotifications(teamId: string) {
  const remaining = await prisma.fine.count({ where: { teamId, status: "FORESLAET" } });
  if (remaining > 0) return;
  await prisma.notification.updateMany({
    where: { teamId, type: "FINE_PROPOSED", refKey: null, readAt: null },
    data: { readAt: new Date() }
  });
}
