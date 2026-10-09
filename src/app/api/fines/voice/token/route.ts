import { NextResponse } from "next/server";
import { z } from "zod";
import { FINE_AUTOMATION_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { getActiveSeason, seasonClosedResponse } from "@/lib/seasons";

const bodySchema = z.object({ teamId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldigt input" }, { status: 400 });
  }
  const { teamId } = parsed.data;

  const member = await requireActiveTeamMemberWithRoles(session.userId, teamId, FINE_AUTOMATION_ROLES);
  if (!member.ok) return member.response;

  const closed = seasonClosedResponse(await getActiveSeason(teamId));
  if (closed) return closed;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Stemmefunktion er ikke sat op (OPENAI_API_KEY mangler)" }, { status: 503 });
  }

  const memberships = await prisma.membership.findMany({
    where: { teamId, status: "ACTIVE" },
    select: { user: { select: { name: true } } }
  });
  const names = memberships.map((m) => m.user.name).filter(Boolean).slice(0, 60);

  const response = await fetch("https://api.openai.com/v1/realtime/transcription_sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input_audio_transcription: {
        model: "gpt-4o-transcribe",
        language: "da",
        prompt: `Danske bøder på et fodboldhold. Spillere: ${names.join(", ")}.`
      },
      turn_detection: { type: "server_vad", silence_duration_ms: 450, prefix_padding_ms: 200 },
      input_audio_noise_reduction: { type: "near_field" }
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Kunne ikke starte transskription" }, { status: 502 });
  }
  const data = (await response.json()) as { client_secret?: { value?: string; expires_at?: number } };
  const token = data.client_secret?.value;
  if (!token) {
    return NextResponse.json({ error: "Kunne ikke starte transskription" }, { status: 502 });
  }
  return NextResponse.json({ token, expiresAt: data.client_secret?.expires_at ?? null });
}
