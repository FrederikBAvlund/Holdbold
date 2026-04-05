import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  teamId: z.string().min(1)
});

const createSchema = z.object({
  teamId: z.string().min(1),
  templateId: z.string().min(1),
  deadlineAt: z.string().datetime()
});

async function requireManager(teamId: string, userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { teamId, userId, status: "ACTIVE" },
    select: { role: true }
  });
  if (!membership || !["ADMIN", "BOEDEKASSEFORMAND"].includes(membership.role)) {
    return null;
  }
  return membership;
}

function fineCollectionDelegate() {
  return (prisma as unknown as { fineCollection?: typeof prisma.fineCollection }).fineCollection;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.parse({ teamId: searchParams.get("teamId") ?? "" });

  const manager = await requireManager(parsed.teamId, session.user.id);
  if (!manager) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const fineCollection = fineCollectionDelegate();
  if (!fineCollection) {
    return NextResponse.json({ collections: [] });
  }

  const collections = await fineCollection.findMany({
    where: { teamId: parsed.teamId, isActive: true },
    include: { template: true, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ collections });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const json = await request.json();
  const body = createSchema.parse(json);

  const manager = await requireManager(body.teamId, session.user.id);
  if (!manager) {
    return NextResponse.json({ error: "Kun admin/bødekasseformand kan oprette indsamlingsflow" }, { status: 403 });
  }

  const fineCollection = fineCollectionDelegate();
  if (!fineCollection) {
    return NextResponse.json(
      { error: "FineCollection er ikke tilgængelig endnu. Kør prisma migrate + prisma generate og genstart serveren." },
      { status: 503 }
    );
  }

  const template = await prisma.fineTemplate.findFirst({
    where: {
      id: body.templateId,
      teamId: body.teamId,
      status: "APPROVED"
    },
    select: { id: true, title: true, amount: true }
  });

  if (!template) {
    return NextResponse.json({ error: "Godkendt bødeskabelon ikke fundet" }, { status: 404 });
  }

  const deadlineAt = new Date(body.deadlineAt);
  if (Number.isNaN(deadlineAt.getTime())) {
    return NextResponse.json({ error: "Ugyldig deadline" }, { status: 400 });
  }

  const collection = await fineCollection.create({
    data: {
      teamId: body.teamId,
      templateId: template.id,
      deadlineAt,
      intervalHours: 24,
      createdById: session.user.id
    },
    include: {
      template: true
    }
  });

  const members = await prisma.membership.findMany({
    where: { teamId: body.teamId, status: "ACTIVE" },
    include: { user: { select: { id: true } } }
  });

  const notifications = members
    .filter((member) => member.userId !== session.user.id)
    .map((member) => ({
      userId: member.user.id,
      teamId: body.teamId,
      type: "FINE_SYSTEM" as const,
      title: "Ny indsamlingsrunde",
      body: `Fra ${deadlineAt.toLocaleString("da-DK")} gives ${template.title} (${template.amount} kr) dagligt ved ubetalte bøder.`,
      link: "/dashboard/boder"
    }));

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  return NextResponse.json({ collection });
}
