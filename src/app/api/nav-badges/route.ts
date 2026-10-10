import { NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { getNavBadges } from "@/lib/navBadges";

/** Tal til badges i navigationen (ting, brugeren skal tage stilling til). */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  if (!teamId) return NextResponse.json({ error: "teamId mangler" }, { status: 400 });

  const badges = await getNavBadges(session.userId, teamId, searchParams.get("seasonId"));
  return NextResponse.json(badges);
}
