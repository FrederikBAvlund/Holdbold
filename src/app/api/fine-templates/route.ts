import { NextResponse } from "next/server";
import { z } from "zod";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireActiveTeamMember, requireSession } from "@/lib/apiAuth";

const listSchema = z.object({
  teamId: z.string().min(1)
});

const createSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1),
  amount: z.number().int(),
  category: z.enum(["SOME", "FAELLES", "SPILLER", "DIVERSE"]).optional(),
  description: z.string().optional()
});

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  const parsed = listSchema.parse({ teamId });

  const member = await requireActiveTeamMember(session.userId, parsed.teamId);
  if (!member.ok) return member.response;

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
  const session = await requireSession();
  if (!session.ok) return session.response;

  const json = await request.json();
  const body = createSchema.parse(json);

  const membership = await requireActiveTeamMember(session.userId, body.teamId);
  if (!membership.ok) return membership.response;

  const status: "APPROVED" | "PENDING" =
    membership.role === "BOEDEKASSEFORMAND" || membership.role === "ADMIN" ? "APPROVED" : "PENDING";

  const template = await prisma.fineTemplate.create({
    data: {
      teamId: body.teamId,
      title: body.title,
      amount: body.amount,
      category: body.category ?? "DIVERSE",
      description: body.description,
      createdById: session.userId,
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
