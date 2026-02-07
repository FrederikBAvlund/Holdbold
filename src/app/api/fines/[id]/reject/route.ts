import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  rejectedById: z.string().min(1)
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const json = await request.json();
  const body = bodySchema.parse(json);

  const fine = await prisma.fine.update({
    where: { id: params.id },
    data: {
      status: "AFVIST",
      rejectedAt: new Date(),
      rejectedById: body.rejectedById
    }
  });

  return NextResponse.json({ fine });
}
