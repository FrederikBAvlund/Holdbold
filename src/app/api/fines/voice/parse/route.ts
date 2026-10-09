import { NextResponse } from "next/server";
import { z } from "zod";
import { FINE_AUTOMATION_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { getTeamOpenAiKey } from "@/lib/teamOpenAiKey";
import { resolveTextFines, type TextFine } from "@/lib/voiceFines/textMatching";
import { textFinePrompt, TEXT_FINES_SCHEMA } from "@/lib/voiceFines/textPrompt";
import { getActiveSeason, seasonClosedResponse } from "@/lib/seasons";
import { VOICE_FINES_MODEL } from "@/lib/voiceFines/prompt";

const bodySchema = z.object({
  teamId: z.string().min(1),
  segment: z.string().min(1).max(6000),
  context: z.string().max(2000).optional(),
  existing: z
    .array(z.object({ userId: z.string(), title: z.string(), amount: z.number().nullable() }))
    .max(200)
    .default([])
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldigt input" }, { status: 400 });
  }
  const { teamId, segment, context, existing } = parsed.data;

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
    return NextResponse.json({ error: "Tilføj holdets OpenAI API-nøgle under Holdindstillinger for at bruge stemmefunktionen" }, { status: 503 });
  }

  const [memberships, templates] = await Promise.all([
    prisma.membership.findMany({
      where: { teamId, status: "ACTIVE" },
      select: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } }
    }),
    prisma.fineTemplate.findMany({
      where: { teamId, status: "APPROVED" },
      select: { id: true, title: true, amount: true },
      orderBy: { title: "asc" }
    })
  ]);
  const members = memberships.map((m) => ({ id: m.user.id, name: m.user.name ?? "" })).filter((m) => m.name);

  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const existingText = existing.length
    ? existing.map((e) => `- ${nameById.get(e.userId) ?? "Ukendt spiller"}: ${e.title}${e.amount ? ` (${e.amount} kr)` : ""}`).join("\n")
    : "(ingen)";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VOICE_FINES_MODEL,
      reasoning_effort: "none",
      max_completion_tokens: 2000,
      response_format: {
        type: "json_schema",
        json_schema: { name: "fines", strict: true, schema: TEXT_FINES_SCHEMA }
      },
      messages: [
        { role: "system", content: textFinePrompt(members, templates) },
        {
          role: "user",
          content: `Allerede foreslået:\n${existingText}\n\nTidligere udsagn (kontekst):\n${context || "(ingen)"}\n\nNyt udsagn:\n${segment}`
        }
      ]
    })
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ error: "Kunne ikke fortolke udsagn" }, { status: 502 });
  }
  if (response.status === 429) {
    return NextResponse.json({ error: "For mange forespørgsler – prøv igen" }, { status: 429 });
  }
  if (!response.ok) {
    return NextResponse.json({ error: "Kunne ikke fortolke udsagn" }, { status: 502 });
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
  };

  let raw: TextFine[] = [];
  try {
    const json = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as { fines?: TextFine[] };
    raw = Array.isArray(json.fines) ? json.fines : [];
  } catch {
    raw = [];
  }

  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const cached = data.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  return NextResponse.json({
    suggestions: resolveTextFines(raw, members, templates),
    usage: {
      input: Math.max(0, promptTokens - cached),
      output: data.usage?.completion_tokens ?? 0,
      cacheRead: cached,
      cacheWrite: 0
    }
  });
}
