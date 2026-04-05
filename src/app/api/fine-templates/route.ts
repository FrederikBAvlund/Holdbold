import { NextResponse } from "next/server";
import { z } from "zod";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const listSchema = z.object({
  teamId: z.string().min(1)
});

const createSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1),
  amount: z.number().int(),
  category: z.enum(["SOME", "FAELLES", "SPILLER", "DIVERSE"]).optional(),
  description: z.string().optional(),
  createdById: z.string().min(1).optional()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  const parsed = listSchema.parse({ teamId });

  const templates = await prisma.fineTemplate.findMany({
    where: { teamId: parsed.teamId },
    include: {
      createdBy: true,
      approvedBy: true,
      rejectedBy: true
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const json = await request.json();
  const body = createSchema.parse(json);

  let status: "APPROVED" | "PENDING" = "APPROVED";
  if (body.createdById) {
    const membership = await prisma.membership.findFirst({
      where: { teamId: body.teamId, userId: body.createdById }
    });
    const role = membership?.role ?? "SPILLER";
    status = role === "BOEDEKASSEFORMAND" || role === "ADMIN" ? "APPROVED" : "PENDING";
  }

  const template = await prisma.fineTemplate.create({
    data: {
      teamId: body.teamId,
      title: body.title,
      amount: body.amount,
      category: body.category ?? "DIVERSE",
      description: body.description,
      createdById: body.createdById,
      status
    }
  });

  if (status === "PENDING") {
    const managers = await prisma.membership.findMany({
      where: { teamId: body.teamId, role: { in: ["ADMIN", "BOEDEKASSEFORMAND"] } },
      select: { userId: true }
    });
    const notifications = managers.map((manager) => ({
      userId: manager.userId,
      teamId: body.teamId,
      type: "FINE_PROPOSED" as const,
      title: "Ny foreslået bødeskabelon",
      body: `${template.title} · ${template.amount} kr`,
      link: "/dashboard/boder"
    }));
    if (notifications.length > 0) {
      await createNotifications(notifications);
    }
  }

  return NextResponse.json({ template });
}
