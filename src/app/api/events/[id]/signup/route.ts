import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["IN", "OUT", "UNKNOWN"])
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

  return NextResponse.json({ signup });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const json = await request.json();
  const body = bodySchema.parse(json);

  const signup = await prisma.signup.upsert({
    where: {
      eventId_userId: {
        eventId: params.id,
        userId: body.userId
      }
    },
    update: {
      status: body.status
    },
    create: {
      eventId: params.id,
      userId: body.userId,
      status: body.status
    }
  });

  return NextResponse.json({ signup });
}
