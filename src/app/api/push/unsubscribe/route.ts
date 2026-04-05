import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  endpoint: z.string().url()
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    body = bodySchema.parse(json);
  } catch {
    return NextResponse.json({ error: "Ugyldig endpoint" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: {
      endpoint: body.endpoint,
      userId: session.user.id
    }
  });

  return NextResponse.json({ ok: true });
}

