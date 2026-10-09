import type { VoiceMember, VoiceSuggestion, VoiceTemplate } from "./matching";

export type TextFine = { playerName?: unknown; templateTitle?: unknown; title?: unknown; amount?: unknown; confidence?: unknown; sourceText?: unknown };
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9æøå]+/g, " ").trim();

function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    const next = [i];
    for (let j = 1; j <= right.length; j++) {
      next[j] = Math.min(next[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
    previous = next;
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

/** Prefer full names, then given names/surnames, then the closest spelling. Ties remain reviewable guesses. */
export function closestName(query: string, names: string[]): { index: number; confidence: number } | null {
  const value = normalize(query);
  if (!value || !names.length) return null;
  const ranked = names.map((name, index) => {
    const candidate = normalize(name);
    const parts = candidate.split(" ");
    const score = value === candidate ? 1 : parts.includes(value) ? 0.98 : Math.max(
      similarity(value, candidate),
      ...parts.map((part) => similarity(value, part) * 0.9)
    );
    return { index, score };
  }).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const uncertain = best.score < 0.95 || (ranked[1] && best.score - ranked[1].score < 0.08);
  return { index: best.index, confidence: uncertain ? Math.min(0.55, best.score) : best.score };
}

export function normalFineAmount(templates: VoiceTemplate[]): number {
  const amounts = templates.map((template) => template.amount).filter((amount) => amount > 0).sort((a, b) => a - b);
  return amounts.length ? amounts[Math.floor((amounts.length - 1) / 2)] : 25;
}

/** A bad name never discards other fines in the batch. Only code handles database IDs. */
export function resolveTextFines(raw: TextFine[], members: VoiceMember[], templates: VoiceTemplate[]): VoiceSuggestion[] {
  return raw.slice(0, 200).filter((fine) => fine && typeof fine === "object").map((fine) => {
    const playerName = typeof fine.playerName === "string" ? fine.playerName : "";
    const player = closestName(playerName, members.map((member) => member.name));
    const templateTitle = typeof fine.templateTitle === "string" ? fine.templateTitle : "";
    const match = closestName(templateTitle, templates.map((template) => template.title));
    // Prefer a free fine if the model did not identify a plausible tariff.
    const template = match && match.confidence >= 0.5 ? templates[match.index] : undefined;
    const explicitAmount = typeof fine.amount === "number" && Number.isInteger(fine.amount) && fine.amount !== 0 ? fine.amount : null;
    const estimated = !template && explicitAmount === null;
    const confidence = typeof fine.confidence === "number" && Number.isFinite(fine.confidence) ? Math.max(0, Math.min(1, fine.confidence)) : 0.5;
    const sourceText = typeof fine.sourceText === "string" ? fine.sourceText.slice(0, 2000) : playerName;
    return {
      userId: player ? members[player.index].id : "",
      templateId: template?.id ?? null,
      title: template?.title ?? (typeof fine.title === "string" && fine.title.trim() ? fine.title.trim().slice(0, 500) : "Indtalt bøde"),
      amount: template?.amount ?? explicitAmount ?? normalFineAmount(templates),
      confidence: Math.min(confidence, player?.confidence ?? 0.2, template ? match!.confidence : estimated ? 0.55 : 1),
      sourceText
    };
  });
}
