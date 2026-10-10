import { NextResponse } from "next/server";
import { FINE_MANAGER_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";
import { createNotifications } from "@/lib/notifications";
import { notificationRef, resolveNotifications } from "@/lib/notificationRefs";
import { prisma } from "@/lib/prisma";
import { ensureFineSeasonOpen } from "@/lib/seasons";

/** Bødekassen markerer en andens bøde som betalt (fx kontant eller MobilePay uden om appen). */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const seasonGuard = await ensureFineSeasonOpen(params.id);
  if (seasonGuard) return seasonGuard;

  const session = await requireSession();
  if (!session.ok) return session.response;

  const fine = await prisma.fine.findUnique({
    where: { id: params.id },
    select: { id: true, teamId: true, userId: true, status: true, reason: true, amount: true, markedPaidAt: true }
  });
  if (!fine) {
    return NextResponse.json({ error: "Bøde ikke fundet" }, { status: 404 });
  }

  const manager = await requireActiveTeamMemberWithRoles(session.userId, fine.teamId, FINE_MANAGER_ROLES);
  if (!manager.ok) return manager.response;

  if (fine.status !== "UNPAID" && fine.status !== "PAID_PENDING") {
    return NextResponse.json({ error: "Kun ubetalte bøder kan markeres betalt" }, { status: 400 });
  }

  const now = new Date();
  // Betinget opdatering, så to samtidige afgørelser ikke overskriver hinanden.
  const result = await prisma.fine.updateMany({
    where: { id: fine.id, status: { in: ["UNPAID", "PAID_PENDING"] } },
    data: {
      status: "PAID_APPROVED",
      markedPaidAt: fine.markedPaidAt ?? now,
      markedPaidById: session.userId,
      approvedAt: now,
      approvedById: session.userId
    }
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Bøden er allerede afgjort" }, { status: 409 });
  }

  // Er spillerens øvrige betalinger ikke længere til godkendelse, er sagen i indbakken væk.
  const stillPending = await prisma.fine.count({
    where: { teamId: fine.teamId, userId: fine.userId, status: "PAID_PENDING" }
  });
  if (stillPending === 0) {
    await resolveNotifications([notificationRef.payment(fine.teamId, fine.userId)]);
  }

  if (fine.userId !== session.userId) {
    await createNotifications([
      {
        userId: fine.userId,
        teamId: fine.teamId,
        type: "FINE",
        title: "Bøde markeret som betalt",
        body: `${fine.reason} · ${fine.amount} kr er registreret som betalt.`,
        link: "/dashboard/boder"
      }
    ]);
  }

  return NextResponse.json({ ok: true });
}
