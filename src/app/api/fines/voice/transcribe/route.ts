import { NextResponse } from "next/server";
import { FINE_AUTOMATION_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { getTeamOpenAiKey } from "@/lib/teamOpenAiKey";
import { getActiveSeason, seasonClosedResponse } from "@/lib/seasons";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;
  const form = await request.formData().catch(() => null);
  const teamId = form?.get("teamId");
  const audio = form?.get("audio");
  if (typeof teamId !== "string" || !teamId || !audio || typeof audio === "string") {
    return NextResponse.json({ error: "Lydoptagelse mangler" }, { status: 400 });
  }
  const member = await requireActiveTeamMemberWithRoles(session.userId, teamId, FINE_AUTOMATION_ROLES);
  if (!member.ok) return member.response;
  const closed = seasonClosedResponse(await getActiveSeason(teamId));
  if (closed) return closed;
  if (audio.size === 0 || audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Optagelsen skal være mellem 1 byte og 25 MB" }, { status: 400 });
  }
  const extension = ({ "audio/webm": "webm", "audio/mp4": "mp4", "audio/ogg": "ogg", "audio/wav": "wav" } as Record<string, string>)[audio.type.split(";")[0]];
  if (!extension) return NextResponse.json({ error: "Lydformatet understøttes ikke" }, { status: 400 });
  let apiKey: string | null;
  try { apiKey = await getTeamOpenAiKey(teamId); } catch {
    return NextResponse.json({ error: "Holdets API-nøgle kunne ikke indlæses" }, { status: 503 });
  }
  if (!apiKey) return NextResponse.json({ error: "Tilføj holdets OpenAI API-nøgle under Indstillinger" }, { status: 503 });
  const memberships = await prisma.membership.findMany({
    where: { teamId, status: "ACTIVE" }, select: { user: { select: { name: true } } }
  });
  const upstream = new FormData();
  upstream.set("file", audio, `recording.${extension}`);
  upstream.set("model", "gpt-4o-transcribe");
  upstream.set("language", "da");
  upstream.set("response_format", "json");
  // A glossary for a deliberately held utterance, rather than an always-open microphone.
  upstream.set("prompt", `Danske bøder på et fodboldhold. Navne kan nævnes ved fornavn eller efternavn. Navneordliste: ${memberships.map((m) => m.user.name).join(", ").slice(0, 4000)}. Transskriber kun den talte lyd; tilføj ikke ord fra ordlisten ved stilhed.`);
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: upstream
  }).catch(() => null);
  if (!response?.ok) return NextResponse.json({ error: "Kunne ikke transskribere optagelsen. Prøv igen." }, { status: 502 });
  const data = await response.json().catch(() => null);
  if (typeof data?.text !== "string" || !data.text.trim()) {
    return NextResponse.json({ error: "Ingen tale genkendt. Hold knappen nede og prøv igen." }, { status: 422 });
  }
  if (data.text.length > 6000) return NextResponse.json({ error: "Optagelsen er for lang. Indtal færre bøder ad gangen." }, { status: 422 });
  return NextResponse.json({ text: data.text, usage: {
    audioIn: data.usage?.input_token_details?.audio_tokens ?? 0,
    textIn: data.usage?.input_token_details?.text_tokens ?? 0,
    textOut: data.usage?.output_tokens ?? 0
  } });
}
