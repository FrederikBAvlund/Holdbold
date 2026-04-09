import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { getOrCreateMissedSignupTemplate } from "@/lib/autoFines";

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
    select: {
      id: true,
      teamId: true,
      title: true,
      date: true,
      source: true,
      meetingTime: true,
      signupDeadline: true,
      thingCarrierId: true,
      beerCarrierId: true
    }
  });

  return NextResponse.json({ signup, event });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const json = await request.json();
  const body = bodySchema.parse(json);

  if (body.status === "OUT" && (!body.reason || body.reason.trim().length < 2)) {
    return NextResponse.json({ error: "Begrundelse er påkrævet" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      teamId: true,
      title: true,
      date: true,
      signupDeadline: true
    }
  });
  if (!event) {
    return NextResponse.json({ error: "Begivenhed ikke fundet" }, { status: 404 });
  }

  const actingMembership = await prisma.membership.findFirst({
    where: {
      teamId: event.teamId,
      userId: session.user.id,
      status: "ACTIVE"
    },
    select: { role: true }
  });
  if (!actingMembership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const isOwnSignup = body.userId === session.user.id;
  const canManageOtherSignups =
    actingMembership.role === "ADMIN" || actingMembership.role === "BOEDEKASSEFORMAND";
  if (!isOwnSignup && !canManageOtherSignups) {
    return NextResponse.json({ error: "Kun admin/bødekasseformand kan opdatere andres svar" }, { status: 403 });
  }

  const eventStartMs = new Date(event.date).getTime();
  if (isOwnSignup && eventStartMs <= Date.now()) {
    return NextResponse.json(
      { error: "Begivenheden er afviklet, så dit svar kan ikke ændres." },
      { status: 400 }
    );
  }

  const targetMembership = await prisma.membership.findFirst({
    where: {
      teamId: event.teamId,
      userId: body.userId,
      status: "ACTIVE"
    },
    select: { role: true, userId: true, createdAt: true }
  });
  if (!targetMembership) {
    return NextResponse.json({ error: "Spiller ikke fundet på holdet" }, { status: 404 });
  }

  const existingSignup = await prisma.signup.findUnique({
    where: {
      eventId_userId: {
        eventId: params.id,
        userId: body.userId
      }
    }
  });

  if (existingSignup && existingSignup.status === body.status && (existingSignup.reason ?? null) === (body.reason ?? null)) {
    return NextResponse.json({ signup: existingSignup, unchanged: true });
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

  await prisma.signupLog.create({
    data: {
      signupId: signup.id,
      eventId: params.id,
      userId: body.userId,
      status: body.status,
      reason: body.reason ?? null,
      deadlineAt: event.signupDeadline
    }
  });

  if (!isOwnSignup) {
    const targetUser = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { name: true }
    });
    await prisma.eventLog.create({
      data: {
        eventId: event.id,
        actorId: session.user.id,
        type: "SIGNUP",
        message: `${targetUser?.name ?? "Bruger"} sat til ${body.status === "IN" ? "Jeg kommer" : body.status === "OUT" ? "Jeg kan ikke" : "Mangler svar"}`
      }
    });
  }

  const deadlinePassed = new Date(event.signupDeadline).getTime() <= Date.now();
  const wasMemberAtDeadline = targetMembership.createdAt <= event.signupDeadline;
  if (deadlinePassed && wasMemberAtDeadline && (body.status === "IN" || body.status === "OUT")) {
    if (targetMembership.role !== "SOME") {
      const existingFine = await prisma.fine.findFirst({
        where: {
          teamId: event.teamId,
          eventId: event.id,
          userId: body.userId
        },
        select: { id: true }
      });

      if (!existingFine) {
        const template = await getOrCreateMissedSignupTemplate(event.teamId);
        await prisma.fine.create({
          data: {
            teamId: event.teamId,
            userId: body.userId,
            eventId: event.id,
            templateId: template.id,
            amount: template.amount,
            reason: template.title,
            description: template.description ?? null,
            status: "FORESLAET",
            createdById: null,
            createdByLabel: "System"
          }
        });

        const managers = await prisma.membership.findMany({
          where: {
            teamId: event.teamId,
            status: "ACTIVE",
            role: { in: ["ADMIN", "BOEDEKASSEFORMAND"] }
          },
          select: { userId: true }
        });

        const managerNotifications = managers
          .filter((manager) => manager.userId !== body.userId)
          .map((manager) => ({
            userId: manager.userId,
            teamId: event.teamId,
            type: "FINE_PROPOSED" as const,
            title: "System foreslår bøde",
            body: `${template.title} · ${template.amount} kr (${event.title})`,
            link: "/dashboard/boder"
          }));

        if (managerNotifications.length > 0) {
          await createNotifications(managerNotifications);
        }
      }
    }
  }

  return NextResponse.json({ signup });
}
