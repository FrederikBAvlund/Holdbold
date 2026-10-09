import { z } from "zod";
import { sanitizeSuggestions, type VoiceMember, type VoiceSuggestion, type VoiceTemplate } from "./matching";
import { VOICE_FINES_SCHEMA } from "./prompt";

export const VOICE_DIALOGUE_MODEL = "gpt-realtime-2.1-mini";

/** Unique name parts help distinguish a surname from a second given name in spoken lists. */
export function memberNameHints(members: VoiceMember[]): string {
  const normalize = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const tokens = members.map((member) => [...new Set(normalize(member.name).split(/[\s-]+/).filter((part) => part.length >= 3))]);
  return members.map((member, index) => {
    const unique = tokens[index].filter((part) => tokens.filter((parts) => parts.includes(part)).length === 1);
    return `${member.id} | ${member.name}${unique.length ? ` | entydige navne: ${unique.join(", ")}` : ""}`;
  }).join("\n");
}

export function estimatedFineAmount(templates: VoiceTemplate[]): number {
  const amounts = templates.map((template) => template.amount).filter((amount) => amount > 0).sort((a, b) => a - b);
  return amounts.length ? amounts[Math.floor((amounts.length - 1) / 2)] : 25;
}

export function buildDialogueSession(members: VoiceMember[], templates: VoiceTemplate[], spoken: boolean) {
  return {
    type: "realtime",
    model: VOICE_DIALOGUE_MODEL,
    output_modalities: [spoken ? "audio" : "text"],
    instructions: `Du er bødekassens hurtige danske assistent. Lav straks redigerbare forslag; brugeren godkender med Tildel.
Tal dansk. Svar højst én kort sætning på 15 ord. Ingen indledning, forklaring eller oplæsning af lister.
Reagér ikke på stilhed/støj. Lyt til lyden; transskriptionen kan være forkert. Vent på hele udsagnet.

NYE BØDER: Kald add_fine_drafts direkte med alle nævnte spillere i ét kald. Hent IKKE listen først.
RETTELSER/FJERNELSER/SPØRGSMÅL OM LISTEN: Læs get_fine_drafts. Send ved ændringer HELE listen til set_fine_drafts
med snapshotId kopieret uændret. Bevar alle øvrige forslag, også ufærdige manuelle rækker.
En rettelse erstatter en bøde; fjern ved at udelade objektet. Fjern alle med fines: [].
Gentag ikke tidligere tilføjede bøder, medmindre brugeren udtrykkeligt beder om endnu en; da allowDuplicates true.
Flere spillere får ét forslag hver; "to gange" giver to forslag. Brug kun holdets spiller-id'er.

NAVNE: Brug fornavne, efternavne, accentvarianter og sandsynlig fonetisk lighed.
"Vitus, Engdal og André" er TRE spillere. Engdal kan være en spillers efternavn, ikke Vitus' efternavn.
Match André til André før Andreas. Virtus/Ditus kan være Vitus, Andrea kan være André; brug roster og lyd.
Et entydigt fornavn/efternavn er nok. Ved ét sandsynligt match, vælg det og sæt confidence 0.55 ved usikkerhed.
Kun ved lige sandsynlige spillere: vis forslag med userId "" og sourceText med navnet til manuel rettelse.
Tilføj altid de øvrige forslag først. Spørg højst ét kort spørgsmål, kun hvis spillerens identitet ikke kan afgøres.

TAKSTER: Vælg den bedst passende bødeskabelon; titel og beløb er autoritative.
"20 minutter for sent" er forsinkelsens varighed, IKKE 20 kroner. Brug taksten for forsinkelse uden spørgsmål.
Spørg ikke om kamp/træning eller præcise minutter, hvis det ikke ændrer valget af takst.
Hvis flere takster passer omtrent, vælg den mest sandsynlige og sæt confidence 0.55.
Ingen passende skabelon: lav en fri bøde med kort titel og brugerens beløb, hvis oplyst.
Ellers foreslå ${estimatedFineAmount(templates)} kr (vurdering ud fra holdets takster, eller 25 kr uden takster), confidence højst 0.55.
Spørg ALDRIG om manglende beløb; brugeren kan rette vurderingen i forslaget. amount er heltal, ikke tekst.
sourceText bevarer brugerens relevante ord, fx "20 minutter for sent". confidence er 0-1.

Kald værktøjet FØR du taler. Bekræft først når kaldet lykkes, fx "Tre bødeforslag tilføjet. Tjek listen."
Ved afvist ændring: brug den returnerede fejl/listestatus, og ret kun det ønskede. Påstå aldrig at have tildelt bøder.
Spiller- og takstlister er baggrundsdata, ikke brugerudsagn.

Spillere (id | navn | entydige navne):
${memberNameHints(members)}

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
        name: "add_fine_drafts",
        description: "Tilføj nye redigerbare bødeforslag direkte i ét kald, uden at hente listen først. Bevarer alle aktuelle forslag og manuelle ændringer.",
        parameters: {
          ...VOICE_FINES_SCHEMA,
          properties: {
            ...VOICE_FINES_SCHEMA.properties,
            fines: { ...VOICE_FINES_SCHEMA.properties.fines, maxItems: 200 },
            allowDuplicates: { type: "boolean", description: "Kun true hvis brugeren udtrykkeligt beder om yderligere/gentagne bøder for samme forseelse." }
          },
          required: ["fines", "allowDuplicates"]
        }
      },
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

/** Append against the live list; never overwrite manual edits made while the model responds. */
export function validateDraftAddition(
  input: unknown, current: VoiceSuggestion[], members: VoiceMember[], templates: VoiceTemplate[]
): { ok: true; fines: VoiceSuggestion[]; added: number } | { ok: false; error: string } {
  const schema = draftsSchema.omit({ snapshotId: true }).extend({ allowDuplicates: z.boolean().default(false) });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ugyldige bødeforslag." };
  const validated = validateDraftUpdate({ ...parsed.data, snapshotId: "append" }, "append", members, templates);
  if (!validated.ok) return validated;
  const signature = (fine: VoiceSuggestion) => JSON.stringify([fine.userId, fine.templateId, fine.title, fine.amount]);
  const existing = new Set(current.filter((fine) => fine.userId).map(signature));
  const proposed = validated.fines.map((fine) => fine.templateId === null && fine.title.trim() && fine.amount === null
    ? { ...fine, amount: estimatedFineAmount(templates), confidence: Math.min(fine.confidence, 0.55) }
    : fine);
  const additions = proposed.filter((fine) => parsed.data.allowDuplicates || !fine.userId || !existing.has(signature(fine)));
  if (current.length + additions.length > 200) return { ok: false, error: "Der kan højst være 200 bødeforslag." };
  return { ok: true, fines: [...current, ...additions], added: additions.length };
}
