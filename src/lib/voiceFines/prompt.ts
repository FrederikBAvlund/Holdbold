import type { VoiceMember, VoiceTemplate } from "./matching";

export const VOICE_FINES_MODEL = "gpt-6-luna";

export function buildSystemPrompt(members: VoiceMember[], templates: VoiceTemplate[]): string {
  const players = members.map((m) => `${m.id} | ${m.name}`).join("\n");
  const types = templates.map((t) => `${t.id} | ${t.title} | ${t.amount} kr`).join("\n");
  return `Du hjælper bødekassen på et dansk fodboldhold med at omsætte indtalte bøder til struktureret data.
Input er en transskription af tale (kan indeholde stavefejl og kælenavne). Udtræk KUN nye bøder fra "Nyt udsagn".

Regler:
- Match spillere på navn (fornavn, efternavn, kælenavn, fonetisk lighed). Brug kun id'er fra spillerlisten. Kan spilleren ikke afgøres, så udelad bøden.
- Match bødetype fra listen når det passer. Sæt templateId. Ellers templateId null og giv en kort titel og beløb (heltal kr) hvis nævnt, ellers amount null.
- Nævnes flere spillere for samme bøde, lav én bøde pr. spiller.
- Nævnes et antal ("to gange"), lav tilsvarende antal bøder.
- Bøder der allerede findes under "Allerede foreslået" må ikke gentages, medmindre det tydeligt er en ny bøde.
- confidence er 0-1. sourceText er det udsnit af udsagnet bøden bygger på.
- Svar kun med JSON.

Spillere (id | navn):
${players}

Bødetyper (id | titel | beløb):
${types}`;
}

export const VOICE_FINES_SCHEMA = {
  type: "object",
  properties: {
    fines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          userId: { type: "string" },
          templateId: { type: ["string", "null"] },
          title: { type: "string" },
          amount: { type: ["integer", "null"] },
          confidence: { type: "number" },
          sourceText: { type: "string" }
        },
        required: ["userId", "templateId", "title", "amount", "confidence", "sourceText"],
        additionalProperties: false
      }
    }
  },
  required: ["fines"],
  additionalProperties: false
} as const;
