import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { processDueFineCollections } from "@/lib/fineCollections";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const listSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().optional()
});

const createSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
  amount: z.number().int().positive().optional(),
  title: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  description: z.string().trim().optional(),
  templateId: z.string().min(1).optional(),
  eventId: z.string().optional()
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  const userId = searchParams.get("userId") ?? undefined;
  const parsed = listSchema.parse({ teamId, userId });

  const actingMembership = await prisma.membership.findFirst({
    where: { teamId: parsed.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!actingMembership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  await processDueFineCollections(parsed.teamId);

  if (
    parsed.userId &&
    parsed.userId !== session.user.id &&
    !["ADMIN", "BOEDEKASSEFORMAND"].includes(actingMembership.role)
  ) {
    return NextResponse.json({ error: "Ikke adgang til andre spilleres bøder" }, { status: 403 });
  }

  const fines = await prisma.fine.findMany({
    where: {
      teamId: parsed.teamId,
      ...(parsed.userId
        ? {
            userId: parsed.userId,
            status: { in: ["UNPAID", "PAID_PENDING", "PAID_APPROVED"] }
          }
        : {})
    },
    include: {
      user: true,
      createdBy: true,
      approvedBy: true,
      template: true
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return NextResponse.json({ fines });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const json = await request.json();
  const body = createSchema.parse(json);

  if (!body.templateId && (!body.amount || (!body.title && !body.reason))) {
    return NextResponse.json({ error: "Der mangler beløb eller titel" }, { status: 400 });
  }

  let amount = body.amount ?? 0;
  let reason = body.title ?? body.reason ?? "";
  let description = body.description?.trim() || null;
  const actingMembership = await prisma.membership.findFirst({
    where: { teamId: body.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!actingMembership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const targetMembership = await prisma.membership.findFirst({
    where: { teamId: body.teamId, userId: body.userId, status: "ACTIVE" },
    select: { id: true }
  });
  if (!targetMembership) {
    return NextResponse.json({ error: "Spiller ikke fundet på holdet" }, { status: 404 });
  }

  let templateId: string | undefined = body.templateId;
  const canDirectAssign = ["ADMIN", "BOEDEKASSEFORMAND"].includes(actingMembership.role);
  const status: "UNPAID" | "FORESLAET" = canDirectAssign ? "UNPAID" : "FORESLAET";

  if (body.templateId) {
    const template = await prisma.fineTemplate.findFirst({
      where: {
        id: body.templateId,
        teamId: body.teamId,
        status: "APPROVED"
      }
    });
    if (!template) {
      return NextResponse.json({ error: "Boedeskabelon ikke fundet" }, { status: 404 });
    }
    amount = template.amount;
    reason = template.title;
    description = template.description?.trim() || null;
    templateId = template.id;
  }

  const fine = await prisma.fine.create({
    data: {
      teamId: body.teamId,
      userId: body.userId,
      eventId: body.eventId,
      templateId,
      amount,
      reason,
      description,
      status,
      createdById: session.user.id,
      createdByLabel: null
    }
  });

  const notifications: Array<{
    userId: string;
    teamId: string;
    type: "FINE" | "FINE_PROPOSED" | "FINE_SYSTEM";
    title: string;
    body: string;
    link: string;
  }> = [];

  // Only a real assigned fine should notify recipient and count as debt.
  if (status === "UNPAID") {
    notifications.push({
      userId: body.userId,
      teamId: body.teamId,
      type: "FINE",
      title: "Ny bøde",
      body: `${reason} · ${amount} kr`,
      link: "/dashboard/boder"
    });
  }

  if (status === "FORESLAET") {
    const managers = await prisma.membership.findMany({
      where: { teamId: body.teamId, status: "ACTIVE", role: { in: ["ADMIN", "BOEDEKASSEFORMAND"] } },
      select: { userId: true }
    });

    const managerNotifications = managers
      .filter((manager) => manager.userId !== body.userId && manager.userId !== session.user.id)
      .map((manager) => ({
        userId: manager.userId,
        teamId: body.teamId,
        type: "FINE_PROPOSED" as const,
        title: "Foreslået bøde",
        body: `${reason} · ${amount} kr`,
        link: "/dashboard/boder"
      }));
    notifications.push(...managerNotifications);
  }

  if (notifications.length > 0) {
    await createNotifications(notifications);
  }

  return NextResponse.json({ fine });
}
