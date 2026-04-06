import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

const HOURS_TO_MS = 60 * 60 * 1000;

export async function processDueFineCollections(teamId: string) {
  const fineCollection = (prisma as unknown as { fineCollection?: typeof prisma.fineCollection })
    .fineCollection;
  if (!fineCollection) {
    // Graceful fallback while Prisma client/schema is out of sync.
    return;
  }

  const now = new Date();
  const dueCollections = await fineCollection.findMany({
    where: {
      teamId,
      isActive: true,
      deadlineAt: { lte: now }
    },
    include: {
      template: {
        select: { id: true, title: true, amount: true, description: true }
      }
    },
    orderBy: { createdAt: "asc" },
    take: 50
  });

  for (const collection of dueCollections) {
    const intervalHours = Math.max(1, collection.intervalHours || 24);
    const threshold = new Date(now.getTime() - intervalHours * HOURS_TO_MS);

    const claimed = await fineCollection.updateMany({
      where: {
        id: collection.id,
        isActive: true,
        deadlineAt: { lte: now },
        OR: [{ lastRunAt: null }, { lastRunAt: { lte: threshold } }]
      },
      data: { lastRunAt: now }
    });

    if (claimed.count === 0) continue;

    const debtors = await prisma.fine.groupBy({
      by: ["userId"],
      where: {
        teamId,
        status: "UNPAID"
      }
    });

    if (debtors.length === 0) continue;

    const managers = await prisma.membership.findMany({
      where: {
        teamId,
        status: "ACTIVE",
        role: { in: ["ADMIN", "BOEDEKASSEFORMAND"] }
      },
      select: { userId: true }
    });

    await prisma.fine.createMany({
      data: debtors.map((debtor) => ({
        teamId,
        userId: debtor.userId,
        templateId: collection.template.id,
        amount: collection.template.amount,
        reason: collection.template.title,
        description: collection.template.description ?? null,
        // Automated bøder oprettes som forslag, så en bødekasseformand/admin skal godkende dem.
        status: "FORESLAET" as const,
        createdById: null,
        createdByLabel: "System"
      }))
    });

    const managerNotifications = managers.map((manager) => ({
      userId: manager.userId,
      teamId,
      type: "FINE_PROPOSED" as const,
      title: "System foreslår bøder",
      body: `${debtors.length} spiller(e) mangler betaling. ${collection.template.title} (${collection.template.amount} kr) afventer godkendelse.`,
      link: "/dashboard/boder"
    }));

    await createNotifications(managerNotifications);
  }
}
