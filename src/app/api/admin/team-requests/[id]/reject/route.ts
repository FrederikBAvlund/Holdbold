import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { sendMail } from "@/lib/mail";
import { teamRequestRejectedMail } from "@/lib/mailTemplates";
import { createNotifications } from "@/lib/notifications";
import { notificationRef, resolveNotifications } from "@/lib/notificationRefs";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ reason: z.string().trim().max(500).optional() });

/** Systemadmin afviser en holdanmodning. Holdkoden frigives igen. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ugyldigt input" }, { status: 400 });
  const reason = parsed.data.reason || null;

  const teamRequest = await prisma.teamRequest.findUnique({
    where: { id: params.id },
    include: { user: { select: { name: true, email: true } } }
  });
  if (!teamRequest) return NextResponse.json({ error: "Anmodning ikke fundet" }, { status: 404 });

  const updated = await prisma.teamRequest.updateMany({
    where: { id: teamRequest.id, status: "PENDING" },
    data: { status: "REJECTED", rejectionReason: reason, decidedById: auth.userId, decidedAt: new Date() }
  });
  if (updated.count !== 1) return NextResponse.json({ error: "Anmodningen er allerede behandlet" }, { status: 409 });

  await resolveNotifications([notificationRef.teamRequest(teamRequest.id)]).catch(() => undefined);
  await createNotifications([
    {
      userId: teamRequest.userId,
      teamId: null,
      type: "GENERAL",
      title: "Din holdanmodning blev afvist",
      body: reason ? `${teamRequest.name}: ${reason}` : teamRequest.name,
      link: "/dashboard/opret-hold"
    }
  ]).catch((error) => console.error("Kunne ikke oprette notifikation om afvist hold", error));

  if (teamRequest.user.email) {
    try {
      await sendMail({
        to: teamRequest.user.email,
        ...teamRequestRejectedMail({ name: teamRequest.user.name, teamName: teamRequest.name, reason })
      });
    } catch (error) {
      console.error("Kunne ikke sende mail om afvist hold", error);
    }
  }

  return NextResponse.json({ ok: true });
}
