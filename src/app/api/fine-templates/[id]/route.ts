import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  title: z.string().min(1),
  amount: z.number().int(),
  category: z.enum(["SOME", "FAELLES", "SPILLER", "DIVERSE"]).optional(),
  description: z.string().optional().nullable()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const json = await request.json();
  const body = updateSchema.parse(json);

  const template = await prisma.fineTemplate.findUnique({
    where: { id: params.id }
  });

  if (!template) {
    return NextResponse.json({ error: "Skabelon ikke fundet" }, { status: 404 });
  }

  const membership = await prisma.membership.findFirst({
    where: { teamId: template.teamId, userId: session.user.id }
  });
  const role = membership?.role ?? "SPILLER";
  if (!["ADMIN", "BOEDEKASSEFORMAND"].includes(role)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const updated = await prisma.fineTemplate.update({
    where: { id: params.id },
    data: {
      title: body.title,
      amount: body.amount,
      category: body.category ?? template.category,
      description: body.description ?? null
    }
  });

  return NextResponse.json({ template: updated });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const template = await prisma.fineTemplate.findUnique({
    where: { id: params.id }
  });

  if (!template) {
    return NextResponse.json({ error: "Skabelon ikke fundet" }, { status: 404 });
  }

  const membership = await prisma.membership.findFirst({
    where: { teamId: template.teamId, userId: session.user.id, status: "ACTIVE" }
  });
  const role = membership?.role ?? "SPILLER";
  if (!["ADMIN", "BOEDEKASSEFORMAND"].includes(role)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const [, deleted] = await prisma.$transaction([
    prisma.fine.updateMany({
      where: { templateId: template.id },
      data: { templateId: null }
    }),
    prisma.fineTemplate.delete({
      where: { id: template.id }
    })
  ]);

  return NextResponse.json({ deleted: true, templateId: deleted.id });
}
