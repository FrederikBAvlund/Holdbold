import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { resolveAutomationTemplate, roleExcludedFromFineAutomation } from "@/lib/fineAutomation";
import type { MotmSelectionInput } from "@/lib/motm";

export async function syncMotmSelfVoteProposedFines(params: {
  teamId: string;
  eventId: string;
  voterId: string;
  voterRole: Role;
  selections: MotmSelectionInput[];
}) {
  const { teamId, eventId, voterId, voterRole, selections } = params;

  await prisma.fine.deleteMany({
    where: {
      teamId,
      eventId,
      userId: voterId,
      automationAction: "MATCH_MOTM_SELF_VOTE",
      status: "FORESLAET"
    }
  });

  const resolved = await resolveAutomationTemplate(teamId, "MATCH_MOTM_SELF_VOTE", "MATCH");
  if (!resolved || roleExcludedFromFineAutomation(voterRole, resolved.excludedRoles)) {
    return;
  }

  const selfEntry = selections.find((s) => s.userId === voterId);
  const selfWeight = selfEntry?.weight ?? 0;
  if (selfWeight < 1) {
    return;
  }

  const voter = await prisma.user.findUnique({
    where: { id: voterId },
    select: { name: true }
  });

  await prisma.fine.createMany({
    data: Array.from({ length: selfWeight }, () => ({
      teamId,
      userId: voterId,
      eventId,
      templateId: resolved.template.id,
      amount: resolved.template.amount,
      reason: resolved.template.title,
      description: resolved.template.description ?? null,
      status: "FORESLAET" as const,
      createdById: null,
      createdByLabel: "System",
      automationAction: resolved.automationAction
    }))
  });

  const managers = await prisma.membership.findMany({
    where: { teamId, role: { in: ["ADMIN", "BOEDEKASSEFORMAND"] } },
    select: { userId: true }
  });
  if (managers.length > 0) {
    const voterName = voter?.name ?? "Medlem";
    await createNotifications(
      managers.map((manager) => ({
        userId: manager.userId,
        teamId,
        type: "FINE_PROPOSED" as const,
        title: "Foreslået bøde",
        body: `${voterName} · ${resolved.template.title} · ${resolved.template.amount} kr (${selfWeight}× stem på sig selv i MOTM)`,
        link: "/dashboard/boder"
      }))
    );
  }
}
