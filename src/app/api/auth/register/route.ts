import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  password: z.string().min(8),
  teamId: z.string().min(1)
});

export async function POST(request: Request) {
  const json = await request.json();
  const body = bodySchema.parse(json);

  if (!body.email && !body.phone) {
    return NextResponse.json({ error: "Email eller telefon er paakraevet" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(body.password, 10);

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
      passwordHash,
      memberships: {
        create: {
          teamId: body.teamId,
          role: "SPILLER"
        }
      }
    }
  });

  return NextResponse.json({ userId: user.id });
}
