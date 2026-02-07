import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const listSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().optional()
});

const createSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
  amount: z.number().int().positive().optional(),
  reason: z.string().min(1).optional(),
  templateId: z.string().min(1).optional(),
  createdById: z.string().min(1).optional(),
  createdByLabel: z.string().min(1).optional(),
  eventId: z.string().optional(),
  status: z.enum(["UNPAID", "PAID_PENDING", "PAID_APPROVED", "FORESLAET", "AFVIST"]).optional()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  const userId = searchParams.get("userId") ?? undefined;
  const parsed = listSchema.parse({ teamId, userId });

  const fines = await prisma.fine.findMany({
    where: {
      teamId: parsed.teamId,
      ...(parsed.userId ? { userId: parsed.userId } : {})
    },
    include: {
      user: true,
      createdBy: true,
      template: true
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return NextResponse.json({ fines });
}

export async function POST(request: Request) {
  const json = await request.json();
  const body = createSchema.parse(json);

  if (!body.templateId && (!body.amount || !body.reason)) {
    return NextResponse.json({ error: "Der mangler belob eller aarsag" }, { status: 400 });
  }

  let amount = body.amount ?? 0;
  let reason = body.reason ?? "";
  let templateId: string | undefined = body.templateId;

  let status: "UNPAID" | "FORESLAET" = "UNPAID";
  if (body.createdById) {
    const membership = await prisma.membership.findFirst({
      where: { teamId: body.teamId, userId: body.createdById }
    });
    const role = membership?.role ?? "SPILLER";
    status = role === "BOEDEKASSEFORMAND" || role === "ADMIN" ? "UNPAID" : "FORESLAET";
  }

  if (body.templateId) {
    const template = await prisma.fineTemplate.findFirst({
      where: { id: body.templateId, teamId: body.teamId }
    });
    if (!template) {
      return NextResponse.json({ error: "Boedeskabelon ikke fundet" }, { status: 404 });
    }
    amount = template.amount;
    reason = template.title;
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
      status,
      createdById: body.createdById,
      createdByLabel: body.createdByLabel ?? (body.createdById ? null : "System")
    }
  });

  return NextResponse.json({ fine });
}
