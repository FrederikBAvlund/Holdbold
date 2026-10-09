export type VoiceMember = { id: string; name: string };
export type VoiceTemplate = { id: string; title: string; amount: number };

export type RawSuggestion = {
  userId?: unknown;
  templateId?: unknown;
  title?: unknown;
  amount?: unknown;
  confidence?: unknown;
  sourceText?: unknown;
};

export type VoiceSuggestion = {
  userId: string;
  templateId: string | null;
  title: string;
  amount: number | null;
  confidence: number;
  sourceText: string;
};

/**
 * Validerer modellens forslag mod holdets rigtige spillere og bødetyper.
 * Ukendte spillere droppes; ukendte skabeloner bliver til fri bøde; skabelonens
 * titel og beløb er altid autoritative.
 */
export function sanitizeSuggestions(
  raw: RawSuggestion[],
  members: VoiceMember[],
  templates: VoiceTemplate[]
): VoiceSuggestion[] {
  const memberIds = new Set(members.map((m) => m.id));
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const out: VoiceSuggestion[] = [];

  for (const item of raw) {
    if (typeof item.userId !== "string" || !memberIds.has(item.userId)) continue;
    const template = typeof item.templateId === "string" ? templateById.get(item.templateId) : undefined;
    const confidenceRaw = typeof item.confidence === "number" ? item.confidence : 0.5;
    const confidence = Math.min(1, Math.max(0, confidenceRaw));
    const sourceText = typeof item.sourceText === "string" ? item.sourceText : "";

    if (template) {
      out.push({
        userId: item.userId,
        templateId: template.id,
        title: template.title,
        amount: template.amount,
        confidence,
        sourceText
      });
      continue;
    }

    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (!title) continue;
    const amount =
      typeof item.amount === "number" && Number.isInteger(item.amount) && item.amount !== 0 ? item.amount : null;
    out.push({
      userId: item.userId,
      templateId: null,
      title,
      amount,
      confidence: amount === null ? Math.min(confidence, 0.4) : confidence,
      sourceText
    });
  }
  return out;
}
