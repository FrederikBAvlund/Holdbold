/** Priser pr. 1M tokens i USD. Justér hvis udbyderne ændrer satser. */
export const USD_TO_DKK = 6.9;

export const TRANSCRIBE_RATES = {
  audioIn: 6.0,
  textIn: 2.5,
  textOut: 10.0
} as const;

export const PARSE_RATES = {
  input: 0.1,
  output: 0.5,
  cacheRead: 0.01,
  cacheWrite: 0.125
} as const;

export type TranscribeUsage = {
  audioIn: number;
  textIn: number;
  textOut: number;
};

export type ParseUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

export const emptyTranscribeUsage = (): TranscribeUsage => ({ audioIn: 0, textIn: 0, textOut: 0 });
export const emptyParseUsage = (): ParseUsage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

// gpt-realtime-2.1-mini, USD per 1M tokens.
export const DIALOGUE_RATES = { audioIn: 10, audioOut: 20, textIn: 0.6, textOut: 2.4, cachedAudio: 0.3, cachedText: 0.06 };
export type DialogueUsage = Record<keyof typeof DIALOGUE_RATES, number>;
export const emptyDialogueUsage = (): DialogueUsage => ({ audioIn: 0, audioOut: 0, textIn: 0, textOut: 0, cachedAudio: 0, cachedText: 0 });
export function dialogueCostUsd(u: DialogueUsage): number {
  return (Object.keys(DIALOGUE_RATES) as Array<keyof DialogueUsage>)
    .reduce((sum, key) => sum + u[key] * DIALOGUE_RATES[key], 0) / 1_000_000;
}

export function transcribeCostUsd(u: TranscribeUsage): number {
  return (
    (u.audioIn * TRANSCRIBE_RATES.audioIn + u.textIn * TRANSCRIBE_RATES.textIn + u.textOut * TRANSCRIBE_RATES.textOut) /
    1_000_000
  );
}

export function parseCostUsd(u: ParseUsage): number {
  return (
    (u.input * PARSE_RATES.input +
      u.output * PARSE_RATES.output +
      u.cacheRead * PARSE_RATES.cacheRead +
      u.cacheWrite * PARSE_RATES.cacheWrite) /
    1_000_000
  );
}

export function usdToDkk(usd: number): number {
  return usd * USD_TO_DKK;
}
