import { NextResponse } from "next/server";
import { getLeaderboardRows, getLeaderboardSummary } from "@/lib/leaderboards";
import { isLeaderboardCategory } from "@/lib/leaderboardsShared";
import { resolveSeason } from "@/lib/seasons";
import { requireActiveTeamMember, requireSession } from "@/lib/apiAuth";
import { resolveProfileImageUrl } from "@/lib/profileImages";

// Profilbilleder gemmes som storage-stier; klienten skal have en signeret URL (som /api/team-members).
async function withResolvedImages<T extends { image: string | null }>(rows: T[]): Promise<T[]> {
  return Promise.all(rows.map(async (row) => ({ ...row, image: await resolveProfileImageUrl(row.image) })));
}

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
    return NextResponse.json({ category, rows: await withResolvedImages(rows) });
  }

  const { summary } = await getLeaderboardSummary(params.teamId, season.id);
  const resolved = Object.fromEntries(
    await Promise.all(
      Object.entries(summary).map(async ([category, top]) => [category, await withResolvedImages(top)] as const)
    )
  );
  return NextResponse.json({ summary: resolved });
}
