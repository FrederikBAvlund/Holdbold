import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  endDate: z.string().nullable().optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const json = await request.json();
  const body = updateSchema.parse(json);

  const series = await prisma.eventSeries.update({
    where: { id: params.id },
    data: {
      ...(body.endDate !== undefined ? { endDate: body.endDate ? new Date(body.endDate) : null } : {})
    }
  });

  return NextResponse.json({ series });
}
