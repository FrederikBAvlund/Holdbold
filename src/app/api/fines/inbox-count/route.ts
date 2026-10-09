import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveSeason } from "@/lib/seasons";

/** Antal ting i bødekassens indbakke (til badge i navigationen). Samme tal som fanen Kassen viser. */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  if (!teamId) return NextResponse.json({ error: "teamId mangler" }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { teamId, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!membership || !["ADMIN", "BOEDEKASSEFORMAND"].includes(membership.role)) {
    return NextResponse.json({ count: 0 });
  }

  const season = await resolveSeason(teamId, searchParams.get("seasonId"));
  if (!season) return NextResponse.json({ count: 0 });

  const [proposed, templates, payments] = await Promise.all([
    prisma.fine.count({ where: { teamId, seasonId: season.id, status: "FORESLAET" } }),
    prisma.fineTemplate.count({ where: { teamId, status: "PENDING" } }),
    // Betalinger til godkendelse kan kun ses af admin (som i indbakken).
    membership.role === "ADMIN"
      ? prisma.fine
          .groupBy({ by: ["userId"], where: { teamId, status: "PAID_PENDING" } })
          .then((rows) => rows.length)
      : Promise.resolve(0)
  ]);

  return NextResponse.json({ count: proposed + templates + payments });
}
