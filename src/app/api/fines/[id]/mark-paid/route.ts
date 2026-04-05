import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  markedById: z.string().min(1)
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const json = await request.json();
  const body = bodySchema.parse(json);
  if (body.markedById !== session.user.id) {
    return NextResponse.json({ error: "Kun egen bruger kan markere betalt" }, { status: 403 });
  }

  const existing = await prisma.fine.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, status: true, teamId: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Bøde ikke fundet" }, { status: 404 });
  }
  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }
  if (existing.status !== "UNPAID") {
    return NextResponse.json({ error: "Kun ubetalte bøder kan markeres betalt" }, { status: 400 });
  }

  const fine = await prisma.fine.update({
    where: { id: params.id },
    data: {
      status: "PAID_PENDING",
      markedPaidAt: new Date(),
      markedPaidById: body.markedById
    }
  });

  return NextResponse.json({ fine });
}
