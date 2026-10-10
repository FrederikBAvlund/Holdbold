import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

/** Systemadmin: alle holdanmodninger, afventende først. */
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const requests = await prisma.teamRequest.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: { user: { select: { name: true, email: true } } }
  });
  requests.sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"));

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      themePreset: r.themePreset,
      status: r.status,
      rejectionReason: r.rejectionReason,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
      requester: { name: r.user.name, email: r.user.email }
    }))
  });
}
