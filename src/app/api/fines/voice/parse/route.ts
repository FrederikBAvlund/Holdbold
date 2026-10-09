import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { FINE_AUTOMATION_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { sanitizeSuggestions, type RawSuggestion } from "@/lib/voiceFines/matching";
import { buildSystemPrompt, VOICE_FINES_MODEL, VOICE_FINES_SCHEMA } from "@/lib/voiceFines/prompt";

const bodySchema = z.object({
  teamId: z.string().min(1),
  segment: z.string().trim().min(1).max(2000),
  context: z.string().max(2000).optional(),
  existing: z
    .array(z.object({ userId: z.string(), title: z.string(), amount: z.number().nullable() }))
    .max(200)
    .default([])
});

let client: Anthropic | null = null;

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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Stemmefunktion er ikke sat op (ANTHROPIC_API_KEY mangler)" }, { status: 503 });
  }
  client ??= new Anthropic();

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
    ? existing.map((e) => `- ${nameById.get(e.userId) ?? e.userId}: ${e.title}${e.amount ? ` (${e.amount} kr)` : ""}`).join("\n")
    : "(ingen)";

  try {
    const response = await client.messages.create({
      model: VOICE_FINES_MODEL,
      max_tokens: 2000,
      system: [
        { type: "text", text: buildSystemPrompt(members, templates), cache_control: { type: "ephemeral" } }
      ],
      output_config: { effort: "low", format: { type: "json_schema", schema: VOICE_FINES_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Allerede foreslået:\n${existingText}\n\nTidligere udsagn (kontekst):\n${context || "(ingen)"}\n\nNyt udsagn:\n${segment}`
        }
      ]
    } as Anthropic.MessageCreateParamsNonStreaming);

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    let raw: RawSuggestion[] = [];
    try {
      const json = JSON.parse(textBlock?.text ?? "{}") as { fines?: RawSuggestion[] };
      raw = Array.isArray(json.fines) ? json.fines : [];
    } catch {
      raw = [];
    }

    return NextResponse.json({
      suggestions: sanitizeSuggestions(raw, members, templates),
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
        cacheWrite: response.usage.cache_creation_input_tokens ?? 0
      }
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "For mange forespørgsler – prøv igen" }, { status: 429 });
    }
    return NextResponse.json({ error: "Kunne ikke fortolke udsagn" }, { status: 502 });
  }
}
