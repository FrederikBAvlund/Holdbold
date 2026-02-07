import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const listSchema = z.object({
  teamId: z.string().min(1)
});

const createSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1),
  amount: z.number().int().positive(),
  description: z.string().optional(),
  createdById: z.string().min(1).optional()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  const parsed = listSchema.parse({ teamId });

  const templates = await prisma.fineTemplate.findMany({
    where: { teamId: parsed.teamId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const json = await request.json();
  const body = createSchema.parse(json);

  const template = await prisma.fineTemplate.create({
    data: {
      teamId: body.teamId,
      title: body.title,
      amount: body.amount,
      description: body.description,
      createdById: body.createdById
    }
  });

  return NextResponse.json({ template });
}
