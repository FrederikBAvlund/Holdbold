import { NextResponse } from "next/server";
import { getLeaderboardRows, getLeaderboardSummary } from "@/lib/leaderboards";
import { isLeaderboardCategory } from "@/lib/leaderboardsShared";
import { resolveSeason } from "@/lib/seasons";
import { requireActiveTeamMember, requireSession } from "@/lib/apiAuth";

export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const member = await requireActiveTeamMember(session.userId, params.teamId);
  if (!member.ok) return member.response;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "";
  const season = await resolveSeason(params.teamId, searchParams.get("seasonId"));
  if (!season) {
    return NextResponse.json({ error: "Sæson ikke fundet" }, { status: 404 });
  }

  if (category) {
    if (!isLeaderboardCategory(category)) {
      return NextResponse.json({ error: "Ugyldig kategori" }, { status: 400 });
    }
    const rows = await getLeaderboardRows(params.teamId, category, season.id);
    return NextResponse.json({ category, rows });
  }

  const { summary } = await getLeaderboardSummary(params.teamId, season.id);
  return NextResponse.json({ summary });
}
