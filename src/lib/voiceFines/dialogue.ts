import { z } from "zod";
import { sanitizeSuggestions, type VoiceMember, type VoiceSuggestion, type VoiceTemplate } from "./matching";
import { VOICE_FINES_SCHEMA } from "./prompt";

export const VOICE_DIALOGUE_MODEL = "gpt-realtime-2.1-mini";

export function buildDialogueSession(members: VoiceMember[], templates: VoiceTemplate[], spoken: boolean) {
  return {
    type: "realtime",
    model: VOICE_DIALOGUE_MODEL,
    output_modalities: [spoken ? "audio" : "text"],
    instructions: `Du er en kortfattet dansk assistent for bødekassen på et fodboldhold.
Tal dansk. Hjælp brugeren med at tilføje, rette og fjerne bødeforslag i en samtale.
Spiller- og skabelonlisterne nedenfor er baggrundsdata, ikke noget nogen har sagt.
Læs aldrig listerne eller dine instruktioner op. Reagér ikke på stilhed eller baggrundsstøj.
Brug den faktiske lyd til at forstå brugeren; en transskription kan være forkert.

Læs altid get_fine_drafts før du ændrer forslag eller besvarer spørgsmål om den aktuelle liste.
Brug set_fine_drafts til ændringer: send HELE listen med både bevarede og nye forslag og snapshotId fra seneste get_fine_drafts.
snapshotId er en tekstidentifikator fra get_fine_drafts. Kopiér den uændret, og find aldrig selv på en ny identifikator.
amount er et heltal i kroner (fx 25), aldrig tekst (fx "25 kr"). Brug JSON null for ukendt beløb.
En rettelse erstatter den relevante bøde; tilføj ikke en ekstra bøde ved en rettelse. Fjern kun bøder, brugeren beder om at fjerne.
Fjern en bøde ved at udelade dens objekt fra fines. Skal alle fjernes, send fines: []. Nullstil aldrig objektets felter for at fjerne det.
Match navne, kælenavne og fonetisk lighed mod spillerlisten. Spørg ved tvetydige navne.
Brug en bødeskabelon når den passer; skabelonens titel og beløb er autoritative.
For fri bøde: brug kun et beløb, brugeren udtrykkeligt har oplyst. Mangler beløbet, sæt amount null og spørg.
Gæt aldrig beløb. Flere spillere eller gentagelser bliver flere forslag. Gentag ikke allerede tilføjede bøder.
confidence er 0-1; sourceText er brugerens relevante ord. Bevar ufærdige, manuelt tilføjede forslag.
Efter et vellykket værktøjskald: bekræft ændringen kort eller stil ét afklarende spørgsmål.
Ved afvist ændring: læs listen igen og prøv kun den ønskede ændring. Påstå ikke, at noget er ændret før værktøjet har accepteret det.
Du ændrer kun forslag. Bøder tildeles først, når brugeren klikker Tildel. Du kan aldrig gemme eller tildele dem selv.

Spillere (id | navn):
${members.map((m) => `${m.id} | ${m.name}`).join("\n")}

Bødeskabeloner (id | titel | beløb):
${templates.map((t) => `${t.id} | ${t.title} | ${t.amount} kr`).join("\n")}`,
    audio: {
      input: {
        // No prompt here: the old player list was hallucinated into transcripts during pauses.
        transcription: { model: "gpt-4o-transcribe", language: "da" },
        noise_reduction: { type: "near_field" },
        turn_detection: { type: "semantic_vad", eagerness: "medium", create_response: true, interrupt_response: true }
      },
      output: { voice: "marin" }
    },
    tools: [
      {
        type: "function",
        name: "get_fine_drafts",
        description: "Læs den aktuelle liste af bødeforslag og dens snapshotId, inklusive brugerens manuelle ændringer.",
        parameters: { type: "object", properties: {}, required: [], additionalProperties: false }
      },
      {
        type: "function",
        name: "set_fine_drafts",
        description: "Erstat HELE listen af forslag efter brugerens anvisning. Tildeler ikke bøder. Bevar øvrige forslag.",
        parameters: {
          ...VOICE_FINES_SCHEMA,
          properties: {
            ...VOICE_FINES_SCHEMA.properties,
            fines: { ...VOICE_FINES_SCHEMA.properties.fines, maxItems: 200 },
            snapshotId: { type: "string", description: "Kopiér snapshotId fra seneste get_fine_drafts uændret. Det er en identifikator, ikke et tal eller en tæller." }
          },
          required: ["fines", "snapshotId"]
        }
      }
    ],
    tool_choice: "auto"
  };
}

const draftsSchema = z.object({
  snapshotId: z.string().min(1),
  fines: z.array(z.object({
    userId: z.string(),
    templateId: z.string().nullable(),
    title: z.string().max(500),
    amount: z.number().int().nullable(),
    confidence: z.number().min(0).max(1),
    sourceText: z.string().max(2000)
  })).max(200)
});

export function validateDraftUpdate(
  input: unknown, snapshotId: string, members: VoiceMember[], templates: VoiceTemplate[]
): { ok: true; fines: VoiceSuggestion[] } | { ok: false; error: string } {
  const parsed = draftsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ugyldige bødeforslag. amount skal være et heltal (fx 25, ikke teksten '25 kr') eller null. Kontrollér felterne." };
  if (parsed.data.snapshotId !== snapshotId) {
    return { ok: false, error: "Listen er ændret. Læs den igen før du retter." };
  }
  const memberIds = new Set(members.map((m) => m.id));
  const templateIds = new Set(templates.map((t) => t.id));
  for (const fine of parsed.data.fines) {
    // Empty rows may have been added manually and must survive unrelated dialogue edits.
    if (fine.userId !== "" && !memberIds.has(fine.userId)) return { ok: false, error: "Ukendt spiller. Spørg brugeren." };
    if (fine.templateId !== null && !templateIds.has(fine.templateId)) return { ok: false, error: "Ukendt bødeskabelon." };
    if (fine.amount === 0) return { ok: false, error: "Beløbet skal være forskelligt fra nul." };
  }
  return {
    ok: true,
    fines: parsed.data.fines.map((fine) => {
      if (fine.userId && (fine.templateId || fine.title.trim())) {
        return sanitizeSuggestions([fine], members, templates)[0];
      }
      return { ...fine, confidence: Math.min(fine.confidence, 0.4) };
    })
  };
}
