import { NextResponse } from "next/server";
import { z } from "zod";
import { FINE_AUTOMATION_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { getTeamOpenAiKey } from "@/lib/teamOpenAiKey";
import { getActiveSeason, seasonClosedResponse } from "@/lib/seasons";
import { buildDialogueSession } from "@/lib/voiceFines/dialogue";

const bodySchema = z.object({ teamId: z.string().min(1), spoken: z.boolean().default(true) });

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldigt input" }, { status: 400 });
  }
  const { teamId, spoken } = parsed.data;

  const member = await requireActiveTeamMemberWithRoles(session.userId, teamId, FINE_AUTOMATION_ROLES);
  if (!member.ok) return member.response;

  const closed = seasonClosedResponse(await getActiveSeason(teamId));
  if (closed) return closed;

  let apiKey: string | null;
  try {
    apiKey = await getTeamOpenAiKey(teamId);
  } catch {
    return NextResponse.json({ error: "Holdets API-nøgle kunne ikke indlæses. Kontakt systemadministratoren." }, { status: 503 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "Tilføj holdets OpenAI API-nøgle under Indstillinger for at bruge stemmefunktionen" }, { status: 503 });
  }

  const [memberships, templates] = await Promise.all([
    prisma.membership.findMany({
      where: { teamId, status: "ACTIVE" },
      select: { user: { select: { id: true, name: true } } }
    }),
    prisma.fineTemplate.findMany({
      where: { teamId, status: "APPROVED" },
      select: { id: true, title: true, amount: true }
    })
  ]);
  const members = memberships.map((m) => ({ id: m.user.id, name: m.user.name ?? "" })).filter((m) => m.name);

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 600 },
      session: buildDialogueSession(members, templates, spoken)
    })
  });

  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    // Log metadata only: upstream messages may contain credentials or player names.
    console.error("OpenAI transcription session failed", {
      status: response.status,
      requestId: response.headers.get("x-request-id"),
      code: failure?.error?.code,
      type: failure?.error?.type,
      param: failure?.error?.param
    });
    let error = "Kunne ikke starte transskription. Prøv igen senere.";
    if (response.status === 401) {
      error = "OpenAI API-nøglen er ugyldig. Kontakt holdets administrator.";
    } else if (response.status === 403) {
      error = "OpenAI API-nøglen har ikke adgang til transskription. Kontakt holdets administrator.";
    } else if (failure?.error?.code === "insufficient_quota") {
      error = "OpenAI-kontoen mangler kredit eller har nået sin forbrugsgrænse. Kontakt holdets administrator.";
    } else if (response.status === 429) {
      error = "OpenAI modtager for mange forespørgsler. Vent lidt og prøv igen.";
    }
    return NextResponse.json({ error }, { status: 502 });
  }
  const data = (await response.json()) as { value?: string; expires_at?: number };
  const token = data.value;
  if (!token) {
    return NextResponse.json({ error: "Kunne ikke starte transskription" }, { status: 502 });
  }
  return NextResponse.json({ token, expiresAt: data.expires_at ?? null });
}
