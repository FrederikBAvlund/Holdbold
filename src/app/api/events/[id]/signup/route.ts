import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["IN", "OUT", "UNKNOWN"]),
  reason: z.string().optional()
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "";
  if (!userId) {
    return NextResponse.json({ error: "userId mangler" }, { status: 400 });
  }

  const signup = await prisma.signup.findUnique({
    where: {
      eventId_userId: {
        eventId: params.id,
        userId
      }
    }
  });

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: { id: true, date: true, source: true, meetingTime: true, signupDeadline: true }
  });

  return NextResponse.json({ signup, event });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const json = await request.json();
  const body = bodySchema.parse(json);

  if (body.status === "OUT" && (!body.reason || body.reason.trim().length < 2)) {
    return NextResponse.json({ error: "Begrundelse er påkrævet" }, { status: 400 });
  }

  const signup = await prisma.signup.upsert({
    where: {
      eventId_userId: {
        eventId: params.id,
        userId: body.userId
      }
    },
    update: {
      status: body.status,
      reason: body.reason ?? null
    },
    create: {
      eventId: params.id,
      userId: body.userId,
      status: body.status,
      reason: body.reason ?? null
    }
  });

  const event = await prisma.event.findUnique({
    where: { id: params.id }
  });

  await prisma.signupLog.create({
    data: {
      signupId: signup.id,
      eventId: params.id,
      userId: body.userId,
      status: body.status,
      reason: body.reason ?? null,
      deadlineAt: event?.signupDeadline ?? null
    }
  });

  return NextResponse.json({ signup });
}
